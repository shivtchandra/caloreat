"""
app.py — Food AI API (FastAPI) with:
- Local nutrition search + heuristics
- SQLite logs (meals, scans)
- Evidence Knowledge Base (EKB) for research-backed coaching
- Deterministic summary + LLM enhancer (Groq -> Gemini fallback)
- Hydration & Sleep habits persisted to Firestore:
  users/{uid}/daily/{YYYY-MM-DD}/water/current
  users/{uid}/daily/{YYYY-MM-DD}/sleep/current

Run:
  uvicorn app:app --reload --port 8000

.env:
  GROQ_API_KEY=...
  GEMINI_API_KEY=...
  FIREBASE_CREDENTIALS=/abs/path/serviceAccount.json
"""
import os, re, json, datetime, logging, base64, math
from typing import Dict, Any, List, Optional
from functools import lru_cache

from fastapi import FastAPI, Body, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# Try to import optional libs (Groq / google genai / firebase)
try:
    from groq import Groq
except Exception:
    Groq = None

try:
    import google.generativeai as genai
except Exception:
    genai = None

try:
    import firebase_admin
    from firebase_admin import credentials, firestore as fs
except Exception:
    firebase_admin = None
    fs = None

# SQLAlchemy for local persistence (meals + scans)
from sqlalchemy import create_engine, Column, Integer, String, DateTime, JSON as SAJSON
from sqlalchemy.orm import sessionmaker, declarative_base

# ---------- Setup ----------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("food-ai")
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS", "").strip()

APP_VERSION = 0
LOCAL_FOOD_CACHE: List[Dict[str, Any]] = []

# ---------- Firestore init (optional) ----------
FIRESTORE_OK = False
fs_client = None
if FIREBASE_CREDENTIALS and firebase_admin and fs:
    try:
        cred = credentials.Certificate(FIREBASE_CREDENTIALS)
        firebase_admin.initialize_app(cred)
        fs_client = fs.client()
        FIRESTORE_OK = True
        log.info("✅ Firestore initialized")
    except Exception as e:
        log.warning("⚠️ Firestore init failed: %s", e)

# ---------- DB (SQLite) ----------
Base = declarative_base()
engine = create_engine("sqlite:///food_app.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)

class MealLog(Base):
    __tablename__ = "meal_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, index=True)
    item_name = Column(String)
    nutrients = Column(SAJSON)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class ScanLog(Base):
    __tablename__ = "scan_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, index=True)
    barcode = Column(String, index=True)
    product_name = Column(String)
    result = Column(SAJSON)     # full result payload saved
    image_path = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(engine)

# ---------- FastAPI ----------
app = FastAPI(title="Food AI API")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# ---------- Utilities ----------
def _normalize_name(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", "", (s or "").lower()).strip()

def _to_float(v):
    try:
        return float(v)
    except:
        return None

def _is_number(v):
    try:
        float(v)
        return True
    except:
        return False

def _safe_float(x, default=0.0):
    try:
        if x is None:
            return float(default)
        if isinstance(x, (list, tuple)) and x:
            x = x[0]
        if isinstance(x, str):
            y = re.sub(r"[,\s]+", "", x)
            y = re.sub(r"(kg|kgs|cm|years|yrs|y|h|hr|hrs|ml)$", "", y, flags=re.IGNORECASE)
            return float(y)
        return float(x)
    except Exception:
        return float(default)

def iso_date(dt: Optional[datetime.datetime] = None) -> str:
    dt = dt or datetime.datetime.utcnow()
    return dt.date().isoformat()

def _ensure_dir(path): os.makedirs(path, exist_ok=True)

# ---------- Local food DB loader ----------
def load_local_foods(path="foods_data.json"):
    global LOCAL_FOOD_CACHE, APP_VERSION
    APP_VERSION += 1
    LOCAL_FOOD_CACHE = []
    if not os.path.exists(path):
        log.warning("⚠️ foods_data.json not found at %s", path)
        return
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    CARB_KEYS = ("carbohydrate", "carb", "carbs", "cho")
    PROT_KEYS = ("protein",)
    FAT_KEYS  = ("fat",)
    KCAL_KEYS = ("energy_kcal", "kcal", "calorie")
    KJ_KEYS   = ("energy_kj",)

    for item in data:
        name = item.get("food_name") or item.get("description") or item.get("name") or ""
        if not name: continue
        nutrients: Dict[str, float] = {}

        for k, v in item.items():
            kl = k.lower()
            if v in (None, "", "NA"): continue

            if any(s in kl for s in KCAL_KEYS):
                val = _to_float(v)
                if val is not None: nutrients["calories_kcal"] = val
                continue
            if any(s in kl for s in KJ_KEYS) and "calories_kcal" not in nutrients:
                val = _to_float(v)
                if val is not None: nutrients["calories_kcal"] = val / 4.184
                continue
            if any(s in kl for s in PROT_KEYS) and "non" not in kl:
                val = _to_float(v)
                if val is not None: nutrients["protein_g"] = val
                continue
            if any(s in kl for s in CARB_KEYS) and "fiber" not in kl:
                val = _to_float(v)
                if val is not None: nutrients["total_carbohydrate_g"] = val
                continue
            if any(s in kl for s in FAT_KEYS) and "saturated" not in kl:
                val = _to_float(v)
                if val is not None: nutrients["total_fat_g"] = val
                continue

        for k, v in item.items():
            kl = k.lower()
            if v in (None, "", "NA") or kl in nutrients: continue
            if re.search(r"_(g|mg|ug|µg|kcal|kj)$", kl):
                val = _to_float(v)
                if val is not None:
                    kl = kl.replace("µg","ug")
                    nutrients[kl] = val

        if "total_carbohydrate_g" not in nutrients:
            kcal = nutrients.get("calories_kcal"); prot = nutrients.get("protein_g"); fat = nutrients.get("total_fat_g")
            if all(_to_float(x) is not None for x in (kcal, prot, fat)):
                est = (float(kcal) - prot*4 - fat*9) / 4
                nutrients["total_carbohydrate_g"] = max(0, round(est, 3))

        if nutrients:
            LOCAL_FOOD_CACHE.append({
                "name": name.strip(),
                "norm": _normalize_name(name),
                "nutrients": nutrients
            })
    log.info("✅ Loaded %d local foods", len(LOCAL_FOOD_CACHE))

load_local_foods(os.path.join(os.path.dirname(__file__), "foods_data.json"))

# ---------- Fuzzy search ----------
try:
    from rapidfuzz import fuzz
except Exception:
    fuzz = None

def _closest_local_food(name: str, min_score=60):
    if not LOCAL_FOOD_CACHE: return None
    q = _normalize_name(name)
    best, best_score = None, 0

    for e in LOCAL_FOOD_CACHE:
        if q in e["norm"] or e["norm"] in q:
            if 85 > best_score: best, best_score = e, 85

    if fuzz:
        for e in LOCAL_FOOD_CACHE:
            sc = int(fuzz.token_set_ratio(q, e["norm"]))
            if sc > best_score:
                best, best_score = e, sc

    if best_score >= min_score:
        return {**best, "score": best_score}
    return None

def biryani_pulao_fallback(name):
    if "biryani" not in (name or "").lower(): return None
    for e in LOCAL_FOOD_CACHE:
        if "pulao" in e["norm"] and ("chicken" in e["norm"] or "veg" in e["norm"]):
            return {**e, "score": 60}
    return None

# ---------- Evidence Knowledge Base (EKB) ----------
EKB: List[Dict[str, Any]] = [
    {"id":"prot_1","tag":"protein_per_meal",
     "gist":"Aim ~0.4 g protein/kg per main meal (2–4 meals) to maximize MPS.",
     "when":"protein_gap>=20 or prot_pct<0.18",
     "strength":"high",
     "cite":"Morton et al., 2018; Moore et al., 2015"},
    {"id":"prot_2","tag":"protein_distribution",
     "gist":"Distribute protein evenly across the day rather than 1 heavy dose.",
     "when":"protein_gap>=15",
     "strength":"high",
     "cite":"Areta et al., 2013"},
    {"id":"hydr_1","tag":"hydration_min",
     "gist":"Baseline ~30–35 ml/kg/day water; more in heat/activity.",
     "when":"water_ml<water_target_ml",
     "strength":"moderate",
     "cite":"EFSA 2010; ISSN Position Stand"},
    {"id":"hydr_2","tag":"hydration_timing",
     "gist":"Sip ~500 ml with meals; keep a bottle visible to nudge intake.",
     "when":"water_ml<water_target_ml",
     "strength":"moderate",
     "cite":"Practical hydration habit guidance"},
    {"id":"carb_1","tag":"carb_gap",
     "gist":"Add easy carbs (rice/oats/fruit) if >200 kcal below target.",
     "when":"cal_gap<=-200",
     "strength":"moderate",
     "cite":"Carb intake and performance: Burke et al."},
    {"id":"fat_1","tag":"fat_floor",
     "gist":"Keep fats ≥0.6–0.8 g/kg to support hormones.",
     "when":"fat_gap<-15",
     "strength":"moderate",
     "cite":"ISSN Position Stand 2017"},
    {"id":"fiber_1","tag":"fiber",
     "gist":"Target 25–38 g/day fiber for appetite & cardiometabolic health.",
     "when":"carbs_g>150",
     "strength":"moderate",
     "cite":"US DGA 2020–2025"},
    {"id":"sleep_1","tag":"sleep_min",
     "gist":"7–9 h sleep supports recovery, appetite regulation, glucose control.",
     "when":"sleep_h<7",
     "strength":"high",
     "cite":"Watson et al., Sleep Health 2015"},
    {"id":"sleep_2","tag":"sleep_consistency",
     "gist":"Keep consistent sleep/wake windows ±60 min for better HRV/performance.",
     "when":"sleep_h<7 or sleep_irregular",
     "strength":"moderate",
     "cite":"Buysse et al."},
    {"id":"prot_3","tag":"leucine_trigger",
     "gist":"Include leucine-rich sources (whey, dairy, eggs, soy) per meal.",
     "when":"protein_gap>=20",
     "strength":"moderate",
     "cite":"Wolfe 2017"},
    {"id":"micros_1","tag":"fruit_veg",
     "gist":"Get ≥400 g fruit/veg/day for micronutrients & fiber.",
     "when":"carbs_g<300 or protein_gap>0",
     "strength":"high",
     "cite":"WHO recommendations"},
    {"id":"meal_1","tag":"breakfast_protein",
     "gist":"Add ~25–35 g protein at breakfast to improve satiety.",
     "when":"protein_gap>=20",
     "strength":"moderate",
     "cite":"Leidy et al."},
    {"id":"omega_1","tag":"omega3",
     "gist":"2–3 servings/week fatty fish or 1–2 g EPA+DHA for heart health.",
     "when":"fat_gap<0",
     "strength":"moderate",
     "cite":"AHA Science Advisory"},
    {"id":"sodium_1","tag":"sodium",
     "gist":"Keep sodium ~1500–2300 mg/day; adjust with sweat losses.",
     "when":"water_ml>water_target_ml",
     "strength":"moderate",
     "cite":"US DGA / AHA"},
    {"id":"carb_2","tag":"pre_workout",
     "gist":"1–4 g/kg carbs 1–4 h pre-hard training; add sodium/fluid.",
     "when":"cal_gap<=-300",
     "strength":"moderate",
     "cite":"IOC consensus on sports nutrition"},
    {"id":"prot_4","tag":"pre_sleep_protein",
     "gist":"~30–40 g casein before bed may aid overnight MPS.",
     "when":"protein_gap>=20 and sleep_h>=7",
     "strength":"emerging",
     "cite":"Trommelen & van Loon 2016"},
    {"id":"meal_2","tag":"snack_construct",
     "gist":"Quick snack: Greek yogurt + fruit + honey; ~20 g protein + carbs.",
     "when":"cal_gap<=-300 or protein_gap>=20",
     "strength":"practical",
     "cite":"Practical coaching recipe"},
    {"id":"habit_1","tag":"fruit_bottle",
     "gist":"Keep a 1 L bottle at desk; finish two by 6 pm.",
     "when":"water_ml<water_target_ml",
     "strength":"practical",
     "cite":"Habit formation literature"},
    {"id":"habit_2","tag":"walk_after_meal",
     "gist":"10-min post-meal walk improves glucose excursion.",
     "when":"carbs_g>=200",
     "strength":"moderate",
     "cite":"DiPietro et al., 2013"},
    {"id":"timing_1","tag":"protein_window",
     "gist":"Total daily protein matters most; timing is secondary.",
     "when":"protein_gap<10",
     "strength":"high",
     "cite":"Schoenfeld & Aragon 2018"},
]

# ---------- Firestore helpers ----------
def _fs_water_doc(uid: str, date_iso: str):
    return (
        fs_client.collection("users").document(uid)
        .collection("daily").document(date_iso)
        .collection("water").document("current")
    )

def _fs_sleep_doc(uid: str, date_iso: str):
    return (
        fs_client.collection("users").document(uid)
        .collection("daily").document(date_iso)
        .collection("sleep").document("current")
    )

def upsert_habits_firestore(uid: str, date_iso: str, water_ml: Optional[float], sleep_h: Optional[float]):
    if not FIRESTORE_OK:
        raise HTTPException(501, "Firestore not configured on server")
    now = datetime.datetime.utcnow()
    if water_ml is not None:
        _fs_water_doc(uid, date_iso).set({"value_ml": float(water_ml), "updatedAt": now}, merge=True)
    if sleep_h is not None:
        _fs_sleep_doc(uid, date_iso).set({"value_h": float(sleep_h), "updatedAt": now}, merge=True)

def read_habits_firestore(uid: str, date_iso: str) -> Dict[str, float]:
    if not FIRESTORE_OK:
        return {"water_ml": 0.0, "sleep_h": 0.0}
    w = _fs_water_doc(uid, date_iso).get()
    s = _fs_sleep_doc(uid, date_iso).get()
    water_ml = (w.to_dict() or {}).get("value_ml", 0.0) if w.exists else 0.0
    sleep_h  = (s.to_dict() or {}).get("value_h", 0.0) if s.exists else 0.0
    return {"water_ml": float(water_ml or 0.0), "sleep_h": float(sleep_h or 0.0)}

# ---------- Targets / Summary core ----------
def _activity_factor(a: str) -> float:
    key = (a or "").strip().lower()
    m = {
        "sedentary": 1.2, "light": 1.375, "lightly_active": 1.375,
        "moderate": 1.55, "moderately_active": 1.55,
        "very": 1.725, "very_active": 1.725,
        "extra": 1.9, "athlete": 1.9, "": 1.55
    }
    return m.get(key, 1.55)

def _bmr(sex: str, age, h, w) -> float:
    age_f = _safe_float(age, 25); h_f = _safe_float(h, 170); w_f = _safe_float(w, 70)
    s = 5 if str(sex or "").lower().startswith("m") else -161
    return 10.0*w_f + 6.25*h_f - 5.0*age_f + s

def compute_targets(profile: Dict[str, Any]) -> Dict[str, Any]:
    sex = (profile.get("sex") or profile.get("gender") or "male")
    age = profile.get("age") or profile.get("years") or 25
    h   = profile.get("height_cm") or profile.get("height") or 170
    w   = profile.get("weight_kg") or profile.get("weight") or 70
    act = (profile.get("activity_level") or profile.get("activity") or "moderately_active")
    goal= (profile.get("goal") or "maintenance").lower()

    b = _bmr(sex, age, h, w)
    tdee = b * _activity_factor(act)
    if "loss" in goal or "cut" in goal: cal = tdee - 400
    elif "gain" in goal or "bulk" in goal: cal = tdee + 300
    else: cal = tdee

    prot = round((1.8 if ("loss" in goal or "cut" in goal) else 1.6) * _safe_float(w, 70))
    fat  = round(0.8 * _safe_float(w, 70))
    carbs= max(0, round((cal - (prot*4 + fat*9)) / 4))

    return {
        "bmr": round(b), "tdee": round(tdee), "calorie_target": round(cal),
        "protein_target_g": prot, "fat_target_g": fat, "carb_target_g": carbs,
        "goal": goal, "activity_level": str(act), "weight_kg": _safe_float(w,70),
        "height_cm": _safe_float(h,170), "age": _safe_float(age,25), "sex": sex
    }

def sum_logs(logs: List[Dict[str,Any]]) -> Dict[str,float]:
    t={"calories":0.0,"protein_g":0.0,"carbs_g":0.0,"fats_g":0.0}
    meals=[]
    for l in logs or []:
        m=l.get("macros") or {}
        p=float(m.get("protein_g",0)); c=float(m.get("total_carbohydrate_g",0)); f=float(m.get("total_fat_g",0))
        cal=float(l.get("calories",0))
        t["calories"]+=cal; t["protein_g"]+=p; t["carbs_g"]+=c; t["fats_g"]+=f
        meals.append({"item":l.get("item") or l.get("name") or "Meal","calories":round(cal),"protein_g":p,"carbs_g":c,"fats_g":f})
    for k in t: t[k]=round(t[k],1)
    return t

def top_meals_by_cal(logs: List[Dict[str,Any]], k=3):
    meals=[]
    for l in logs or []:
        cal=float(l.get("calories") or (l.get("macros") or {}).get("calories_kcal") or 0.0)
        meals.append({"item":l.get("item") or l.get("name") or "Meal","calories":round(cal)})
    return sorted(meals, key=lambda x:x["calories"], reverse=True)[:k]

def water_target_ml(profile: Dict[str,Any]) -> float:
    w = _safe_float(profile.get("weight_kg") or profile.get("weight") or 70, 70)
    return round(35.0 * w)

def rank_evidence(tot: Dict[str,float], targets: Dict[str,Any], habits: Dict[str,float], top_n=6):
    prot_gap = max(0.0, targets["protein_target_g"] - tot["protein_g"])
    carb_gap = max(0.0, targets["carb_target_g"] - tot["carbs_g"])
    fat_gap  = targets["fat_target_g"] - tot["fats_g"]
    cal_gap  = tot["calories"] - targets["calorie_target"]
    water_ml = habits.get("water_ml",0.0); sleep_h = habits.get("sleep_h",0.0)
    w_tar    = water_target_ml(targets)

    scored=[]
    for it in EKB:
        expr = it["when"]
        env = {
            "protein_gap": prot_gap, "carb_gap": carb_gap, "fat_gap": fat_gap,
            "cal_gap": cal_gap, "water_ml": water_ml, "water_target_ml": w_tar,
            "sleep_h": sleep_h, "sleep_irregular": False, "carbs_g": tot["carbs_g"],
            "prot_pct": (tot["protein_g"]*4/max(1, tot["calories"])) if tot["calories"]>0 else 0.0
        }
        ok=False
        try:
            ok = bool(eval(expr, {"__builtins__": {}}, env))
        except Exception:
            ok=False
        if ok:
            base = {"high":3,"moderate":2,"emerging":1,"practical":1}.get(it["strength"],1)
            boost = 0.0
            boost += max(0, -cal_gap/200) if "cal_gap" in expr else 0
            boost += prot_gap/10 if "protein_gap" in expr else 0
            boost += (w_tar - water_ml)/500 if "water_ml" in expr else 0
            scored.append( (base+boost, it) )
    scored.sort(key=lambda x: x[0], reverse=True)
    return [s[1] for s in scored[:top_n]]

def format_coach_md(tot, targets, meals_top, habits, ekb_items, long=False):
    cal_gap = targets["calorie_target"] - tot["calories"]
    sign = "under" if cal_gap>0 else "over"
    calgap_abs = abs(round(cal_gap))

    lines=[]
    lines.append(f"**Daily Nutrition Summary** — Goal {targets['calorie_target']} kcal. "
                 f"You logged **{int(tot['calories'])} kcal** today.")
    lines.append(f"You're **{calgap_abs} kcal {sign}** target; adjust with carbs/protein as needed.")

    lines.append("**Macros**")
    lines.append(f"- **Protein (g)**: {int(tot['protein_g'])} / {targets['protein_target_g']} — {targets['protein_target_g']-int(tot['protein_g'])} {'below' if targets['protein_target_g']>tot['protein_g'] else 'over'}")
    lines.append(f"- **Carbs (g)**: {int(tot['carbs_g'])} / {targets['carb_target_g']} — {targets['carb_target_g']-int(tot['carbs_g'])} {'below' if targets['carb_target_g']>tot['carbs_g'] else 'over'}")
    lines.append(f"- **Fats (g)**: {int(tot['fats_g'])} / {targets['fat_target_g']} — {targets['fat_target_g']-int(tot['fats_g'])} {'below' if targets['fat_target_g']>tot['fats_g'] else 'over'}")

    if meals_top:
        lines.append("**Top meals by calories**")
        for m in meals_top:
            lines.append(f"- {m['item']} — {m['calories']} kcal")

    w_tar = water_target_ml(targets)
    lines.append("**Habits**")
    lines.append(f"- Water: {int(habits.get('water_ml',0))}/{int(w_tar)} ml")
    lines.append(f"- Sleep: {habits.get('sleep_h',0):.0f}/8 h")

    lines.append("**Evidence-backed nudges**")
    for it in ekb_items:
        lines.append(f"- {it['gist']} _(Evidence: {it['cite']}; {it['strength']})_")

    if long:
        lines.append("\n**Why these help**")
        lines.append("• Protein supports muscle protein synthesis (MPS) and satiety; fat/carbs balance total energy.\n"
                     "• Adequate hydration (~35 ml/kg) supports performance and appetite regulation.\n"
                     "• Sufficient sleep improves recovery, glucose control, and decision-making around food.")

    return "\n".join(lines)

# ---------- LLM enhancer (GROQ -> GEMINI fallback) ----------
def enhance_with_llm(system_prompt: str, user_prompt: str, evidence_db: list = None) -> Optional[str]:
    """
    Call an LLM to improve the summary.
    Signature: (system_prompt, user_prompt, evidence_db)
    Returns the generated text or None on failure.
    """
    evidence_db = evidence_db or []

    # Build evidence block (if present)
    try:
        evidence_text = "\n".join(
            [f"- {e.get('gist') or ''} _(Evidence: {e.get('cite','unknown')}; strength: {e.get('strength','')})_"
             for e in evidence_db]
        )
    except Exception:
        evidence_text = ""

    final_input = user_prompt
    if evidence_text:
        final_input = f"{user_prompt}\n\nEvidence:\n{evidence_text}"

    # GROQ first
    try:
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if api_key and Groq is not None:
            client = Groq(api_key=api_key)
            log.info("Calling GROQ...")
            resp = client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": final_input},
                ],
                max_tokens=600,
                temperature=0.35,
            )
            out = None
            try:
                out = resp.choices[0].message.get("content") if resp.choices else None
            except Exception:
                out = None
            if out:
                log.info("GROQ returned text (len=%d)", len(out))
                return out
            log.warning("GROQ returned no content")
    except Exception as e:
        log.warning("GROQ failed: %s", e)

    # Gemini fallback
    try:
        gkey = os.getenv("GEMINI_API_KEY", "").strip()
        if gkey and genai is not None:
            try:
                genai.configure(api_key=gkey)
                log.info("Calling Gemini fallback...")
                model = genai.GenerativeModel("gemini-1.5")
                resp = model.generate_content(final_input)
                out = getattr(resp, "text", None)
                if out:
                    log.info("Gemini returned text (len=%d)", len(out))
                    return out
            except Exception as e:
                log.warning("Gemini fallback failed: %s", e)
    except Exception:
        pass

    log.warning("No LLM produced output; returning None (use base summary).")
    return None

# ---------- Summary job store ----------
_summary_jobs: Dict[tuple, Dict[str, Any]] = {}

def _build_summary(uid: str, date_iso: str, logs: List[Dict[str,Any]], profile: Dict[str,Any], habits: Dict[str,float]) -> Dict[str,Any]:
    targets = compute_targets(profile or {})
    totals  = sum_logs(logs or [])
    meals3  = top_meals_by_cal(logs or [], 3)

    gaps = {
        "cal": round(totals["calories"] - targets["calorie_target"], 1),
        "protein": round(totals["protein_g"] - targets["protein_target_g"], 1),
        "carb": round(totals["carbs_g"] - targets["carb_target_g"], 1),
        "fat": round(totals["fats_g"] - targets["fat_target_g"], 1),
    }

    ekb = rank_evidence(totals, targets, habits, top_n=6)
    base_md = format_coach_md(totals, targets, meals3, habits, ekb, long=True)

    # LLM enhancement (pass system + user prompts correctly)
    system_prompt = (
        "You are a nutrition & habit coach. Improve the user's markdown summary: preserve numbers, "
        "be specific, motivational, and cite the evidence where appropriate. Do not invent data; do not change logged numbers."
    )
    user_prompt = base_md + "\n\nPlease rewrite the summary into a clear, professional coaching message (about 180-220 words). Keep all numeric values exactly as shown and retain section headers."
    llm_out = enhance_with_llm(system_prompt, user_prompt, evidence_db=ekb)
    coach = llm_out if llm_out else base_md

    parsed = {
        "date": date_iso,
        "profile_used": targets,
        "totals": totals,
        "gaps_vs_target": gaps,
        "top_meals_by_cal": meals3,
        "habits_today": {
            "water_ml": habits.get("water_ml",0.0),
            "water_target_ml": water_target_ml(targets),
            "sleep_h": habits.get("sleep_h",0.0),
            "sleep_target_h": 8.0
        },
        "ekb_ids": [x["id"] for x in ekb],
        "coach_summary": coach,
        "generated_at": datetime.datetime.utcnow().isoformat()+"Z"
    }
    return {"parsed": parsed, "totals": {"calories_kcal": totals["calories"]}}

def _enqueue_done(uid: str, date_iso: str, payload: Dict[str,Any]):
    _summary_jobs[(uid, date_iso)] = {"status":"complete", "summary": payload}

def _enqueue_fail(uid: str, date_iso: str, err: str):
    _summary_jobs[(uid, date_iso)] = {"status":"failed", "error": err}

# ---------- API endpoints ----------
@app.get("/api/meta/version")
def meta_version(): return {"version": APP_VERSION}

@app.get("/ping")
def ping(): return {"ok": True}

@app.get("/api/food/search_local")
def search_local(q: str):
    qn = _normalize_name(q)
    hits = [f for f in LOCAL_FOOD_CACHE if qn in f["norm"]][:15]
    return [{"name": f["name"], **f["nutrients"]} for f in hits]

@app.post("/api/run_nutrients")
def run_nutrients(payload: Dict[str, Any] = Body(...)):
    totals, results = {}, []
    items = payload.get("items", []) or []
    for i, it in enumerate(items):
        name = (it.get("name") or "").strip()
        qty = float(it.get("quantity", 1))
        portion = float(it.get("portion_mult", 1))
        mult = qty * portion
        if not name: continue

        local = _closest_local_food(name) or biryani_pulao_fallback(name)
        if local:
            base = local["nutrients"]
            scaled = {k: float(v) * mult for k, v in base.items() if _is_number(v)}
            for k, v in scaled.items(): totals[k] = totals.get(k, 0) + v
            results.append({
                "id": f"item-{i}", "item": name, "macros": scaled,
                "calories": scaled.get("calories_kcal"), "quantity": qty,
                "provenance": {"source":"local_match","score":local.get("score")}
            })
        else:
            base = 350
            low = name.lower()
            if "salad" in low: base = 220
            elif "biryani" in low: base = 420
            elif "pizza" in low: base = 700
            elif "paneer" in low: base = 450
            est = {
                "calories_kcal": base * mult,
                "protein_g": (base * 0.12 / 4) * mult,
                "total_carbohydrate_g": (base * 0.45 / 4) * mult,
                "total_fat_g": (base * 0.43 / 9) * mult
            }
            for k, v in est.items(): totals[k] = totals.get(k, 0) + v
            results.append({
                "id": f"item-{i}", "item": name, "macros": est,
                "calories": est["calories_kcal"], "quantity": qty,
                "provenance": {"source":"heuristic"}
            })

    macros = {
        "total_calories": round(totals.get("calories_kcal", 0), 1),
        "total_protein": round(totals.get("protein_g", 0), 1),
        "total_carbs": round(totals.get("total_carbohydrate_g", 0), 1),
        "total_fat": round(totals.get("total_fat_g", 0), 1),
    }
    return {"results": results, "totals": totals, "macros": macros}

@app.post("/api/scan")
def scan_endpoint(payload: Dict[str, Any] = Body(...), bg: BackgroundTasks = None):
    user_id = (payload.get("user_id") or "").strip()
    barcode = (payload.get("barcode") or "").strip()
    image_b64 = payload.get("image_base64")
    auto_log = bool(payload.get("auto_log", False))
    ts = datetime.datetime.utcnow()

    if not user_id or not barcode:
        raise HTTPException(400, "user_id and barcode required")

    match = None
    for e in LOCAL_FOOD_CACHE:
        if barcode in e["name"] or barcode in e["norm"]:
            match = {**e, "score": 95}; break
    if not match: match = _closest_local_food(barcode, 60)
    if match:
        product_name = match["name"]; nutrients = match["nutrients"]; prov={"source":"local_match","score":match.get("score")}
    else:
        product_name = f"Scanned product {barcode}"
        nutrients = {"calories_kcal":250,"protein_g":8,"total_carbohydrate_g":30,"total_fat_g":10}
        prov={"source":"heuristic"}

    image_path=None
    if image_b64:
        try:
            b64 = image_b64.split(",",1)[1] if image_b64.startswith("data:") else image_b64
            img = base64.b64decode(b64)
            dirp = os.path.join("scans", user_id); _ensure_dir(dirp)
            fname = f"scan_{ts.strftime('%Y%m%dT%H%M%S%f')}.jpg"
            pth = os.path.join(dirp,fname)
            with open(pth,"wb") as fh: fh.write(img)
            image_path=pth
        except Exception as e:
            log.warning("scan image save failed: %s", e)

    db = SessionLocal()
    try:
        rec = ScanLog(user_id=user_id, barcode=barcode, product_name=product_name,
                      result={"nutrients":nutrients,"provenance":prov}, image_path=image_path,
                      timestamp=ts)
        db.add(rec); db.commit(); db.refresh(rec)
        scan_id = rec.id
        logged_id=None
        if auto_log:
            ml = MealLog(user_id=user_id, item_name=product_name, nutrients=nutrients, timestamp=ts)
            db.add(ml); db.commit(); db.refresh(ml); logged_id=ml.id
    finally:
        db.close()

    date_iso = iso_date(ts)
    if bg:
        bg.add_task(_do_summary_job, user_id, date_iso, [], {}, None)

    return {
        "scan_id": scan_id, "barcode": barcode, "product_name": product_name,
        "nutrients": nutrients, "provenance": prov, "image_path": image_path,
        "auto_logged_id": logged_id
    }

@app.get("/api/scan/{scan_id}")
def get_scan(scan_id: int):
    db = SessionLocal()
    try:
        rec = db.query(ScanLog).filter(ScanLog.id == scan_id).first()
        if not rec: raise HTTPException(404,"scan not found")
        return {
            "id": rec.id, "user_id": rec.user_id, "barcode": rec.barcode,
            "product_name": rec.product_name, "result": rec.result,
            "image_path": rec.image_path, "timestamp": rec.timestamp.isoformat()
        }
    finally:
        db.close()

@app.post("/api/habits/upsert")
def upsert_habits(payload: Dict[str,Any] = Body(...), bg: BackgroundTasks = None):
    uid = (payload.get("user_id") or "").strip()
    if not uid: raise HTTPException(400, "user_id required")
    date_iso = (payload.get("date") or iso_date()).strip()
    water_ml = payload.get("water_ml")
    sleep_h  = payload.get("sleep_h")
    trig     = bool(payload.get("trigger_summary", True))

    if water_ml is None and sleep_h is None:
        raise HTTPException(400, "Provide water_ml and/or sleep_h")

    try:
        upsert_habits_firestore(uid, date_iso, water_ml, sleep_h)
    except HTTPException as he:
        raise he
    except Exception as e:
        log.warning("Habit upsert failed: %s", e)
        raise HTTPException(500, "habit upsert failed")

    if trig and bg:
        bg.add_task(_do_summary_job, uid, date_iso, [], {}, None)

    return {"ok": True, "date": date_iso, "water_ml": water_ml, "sleep_h": sleep_h}

@app.get("/api/habits/today")
def get_habits_today(user_id: str, date: Optional[str] = None):
    date_iso = (date or iso_date()).strip()
    return {"date": date_iso, **read_habits_firestore(user_id, date_iso)}

@app.get("/api/analytics/summary")
def summary(user_id: str, db=Depends(SessionLocal)):
    logs = db.query(MealLog).filter(MealLog.user_id == user_id).all()
    total: Dict[str, float] = {}
    for l in logs:
        for k, v in (l.nutrients or {}).items():
            if _is_number(v):
                total[k] = total.get(k, 0) + float(v)
    macros = {
        "total_calories": total.get("calories_kcal", 0.0),
        "total_protein": total.get("protein_g", 0.0),
        "total_carbs": total.get("total_carbohydrate_g", 0.0),
        "total_fat": total.get("total_fat_g", 0.0),
    }
    return {"totals": total, "macros": macros}

# ---------- Summary orchestration ----------
def _do_summary_job(uid: str, date_iso: str, logs: Optional[List[Dict[str,Any]]], profile: Optional[Dict[str,Any]], habits_override: Optional[Dict[str,float]]):
    try:
        habits = habits_override or read_habits_firestore(uid, date_iso)
        payload = _build_summary(uid, date_iso, logs or [], profile or {}, habits)
        _enqueue_done(uid, date_iso, payload)
    except Exception as e:
        log.exception("Summary job failed")
        _enqueue_fail(uid, date_iso, str(e))

@app.post("/api/summarizeDaily")
def start_summary(data: dict = Body(...), bg: BackgroundTasks = None):
    u = (data.get("user_id") or "").strip()
    d = (data.get("date") or "").strip()
    logs = data.get("logs", []) or []
    profile = data.get("profile", {}) or {}
    if not u or not d: raise HTTPException(400, "user_id & date required")
    _summary_jobs[(u,d)] = {"status":"pending"}
    if bg:
        bg.add_task(_do_summary_job, u, d, logs, profile, None)
    return {"status":"queued"}

@app.get("/api/summarizeDaily/status")
def status(user_id: str, date: str):
    return _summary_jobs.get((user_id, date), {"status": "pending"})
