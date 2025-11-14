"""
AI analysis microservice (Gemini + optional Firestore save)

Endpoints:
 - POST /api/analyzeMeals   (demo analyzer)
 - POST /api/summarizeDaily (Gemini summary; optionally saved to Firestore)
 - GET  /api/summarizeDaily/status (check if summary ready)

Environment:
 - GEMINI_API_KEY  (required)
 - SAVE_TO_FIRESTORE = "1" (optional)
 - GOOGLE_APPLICATION_CREDENTIALS for firebase_admin
 - PORT (default 5050)
"""

import os
import json
import random
import re
import time
import threading
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()

# === Gemini client ===
try:
    import google.generativeai as genai
except Exception as e:
    genai = None
    print("Warning: google.generativeai not available:", e)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY not set in environment")

if genai is not None:
    genai.configure(api_key=GEMINI_API_KEY)

# === Firestore (optional) ===
SAVE_TO_FIRESTORE = os.getenv("SAVE_TO_FIRESTORE", "") in ("1", "true", "True")
if SAVE_TO_FIRESTORE:
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except Exception as e:
        print("Firestore saving requested but firebase_admin not installed:", e)
        SAVE_TO_FIRESTORE = False

# === Flask app setup ===
app = Flask(__name__)
from flask_cors import CORS
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3001", "http://localhost:3000"]}},
     supports_credentials=True, allow_headers=["Content-Type"], methods=["GET", "POST", "OPTIONS"])


# ---------- Helpers ----------

def call_gemini_text(prompt: str, model: str = "gemini-2.5-flash", temperature: float = 0.4) -> str:
    """Call Gemini and return text content."""
    if genai is None:
        raise RuntimeError("google.generativeai not installed")
    model_client = genai.GenerativeModel(model)
    response = model_client.generate_content(prompt, generation_config={"temperature": temperature})
    text = getattr(response, "text", None) or (response if isinstance(response, str) else None)
    if not text:
        try:
            text = response.candidates[0].content[0].text
        except Exception:
            text = str(response)
    return text


def extract_json_from_text(text: str):
    """Extract JSON from Gemini response text."""
    if not text:
        raise ValueError("Empty text")
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.I)
    text = re.sub(r"\s*```$", "", text, flags=re.I)
    m = re.search(r"(\{[\s\S]*\})", text)
    if not m:
        raise ValueError("No JSON found")
    json_text = re.sub(r",\s*(\}|\])", r"\1", m.group(1))
    try:
        return json.loads(json_text)
    except Exception:
        return json.loads(json_text.replace("'", '"'))


def init_firestore_if_needed():
    """Initialize firebase_admin if needed."""
    if not SAVE_TO_FIRESTORE:
        return None
    if firebase_admin._apps:
        return firestore.client()
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()
    return firestore.client()


# ---------- Simple analyzer ----------
@app.route("/api/analyzeMeals", methods=["POST"])
def analyze_meals():
    data = request.json or {}
    meals = data.get("meals", [])
    analyzed = []
    for m in meals:
        qty = float(m.get("quantity", 1) or 1)
        base = 450
        calories = max(0, int(base * qty + random.randint(-90, 90)))
        macros = {
            "protein": max(1, int(0.18 * calories / 4)),
            "carbs": max(1, int(0.52 * calories / 4)),
            "fats": max(1, int(0.30 * calories / 9)),
        }
        analyzed.append({"id": m.get("id"), "calories": calories, "macros": macros})
    return jsonify(analyzed), 200


# ---------- Async summarization ----------
@app.route("/api/summarizeDaily", methods=["POST"])
def summarize_daily_fast():
    """Instant response; runs Gemini in background."""
    payload = request.json or {}
    user_id = payload.get("user_id") or payload.get("uid") or "unknown"
    date = payload.get("date") or payload.get("day") or time.strftime("%Y-%m-%d")
    logs = payload.get("logs", [])

    # quick totals for preview
    totals = {"calories": 0.0, "protein": 0.0, "carbs": 0.0, "fats": 0.0}
    for l in logs:
        totals["calories"] += float(l.get("calories") or 0)
        m = l.get("macros") or {}
        totals["protein"] += float(m.get("protein") or m.get("total_protein") or 0)
        totals["carbs"] += float(m.get("carbs") or m.get("total_carbs") or 0)
        totals["fats"] += float(m.get("fats") or m.get("total_fat") or 0)

    # run in background
    threading.Thread(target=_generate_summary_background,
                     args=(user_id, date, logs, totals),
                     daemon=True).start()

    return jsonify({
        "status": "processing",
        "msg": f"Started summary generation for {date}",
        "preview_totals": totals,
        "expected_time_sec": 15
    }), 202


def _generate_summary_background(user_id, date, logs, totals):
    """Worker that runs Gemini + optional Firestore + local cache."""
    try:
        app.logger.info(f"[BG] Generating summary for {user_id} on {date}...")

        # shorter prompt for faster generation
        prompt = prompt = f"""
You are a professional digital nutrition assistant, inspired by HealthifyMe and MyFitnessPal.
Given a user's full daily meal log (including detailed nutrient info), create BOTH:
1️⃣ A structured JSON summary (matching the schema below)
2️⃣ A natural-language daily recap (2–4 short paragraphs, friendly, encouraging, and specific).

---
Schema for JSON (return exactly this format first):
{{
  "summary_date": "{date}",
  "user_id": "{user_id}",
  "totals": {{
    "calories_kcal": <float>,
    "protein_g": <float>,
    "carbs_g": <float>,
    "fats_g": <float>,
    "fiber_g": <float>,
    "sodium_mg": <float>,
    ...
  }},
  "percent_dv": {{
    "calories_kcal": <float>,
    "protein_g": <float>,
    "sodium_mg": <float>,
    "vitamin_c_mg": <float>,
    "iron_mg": <float>,
    ...
  }},
  "meal_cards": [
    {{
      "id": "<id>",
      "item": "<name>",
      "calories": <float>,
      "macros": {{
        "protein_g": <float>,
        "carbs_g": <float>,
        "fats_g": <float>
      }},
      "highlights": ["e.g., high protein", "low sodium"],
      "micros_of_interest": {{
        "sodium_mg": <float>,
        "iron_mg": <float>,
        "vitamin_c_mg": <float>,
        "calcium_mg": <float>
      }}
    }}
  ],
  "insights": {{
    "wins": ["...", "..."],
    "improvements": ["...", "..."],
    "quick_tips": ["...", "..."]
  }},
  "confidence": "low|medium|high"
}}

---
Daily Food Data (raw):
{json.dumps(logs, indent=2)[:7000]}

---
Guidelines for analysis:
- Use actual macro and micro totals.
- Detect patterns like high carbs, low protein, excessive sodium, or vitamin deficiencies.
- Highlight 2–3 *wins* (e.g., "great protein intake", "balanced breakfast").
- Highlight 2–3 *areas to improve* (e.g., "too much sodium", "low fiber").
- Suggest 1–2 *quick fixes* (e.g., "Add more fruits for vitamin C", "drink 1L more water").
- Keep tone positive, empathetic, and informative — like a friendly coach.
- Avoid generic text like “You logged 3 items today.” Instead, be specific:
  e.g. “Your day was carb-heavy (62% carbs), but great protein intake at lunch!”

Output format:
1. JSON summary (fully valid JSON)
2. A human-friendly 2–4 paragraph summary (after JSON, separated by a newline)
"""


        ai_text = call_gemini_text(prompt)
        try:
            parsed_json = extract_json_from_text(ai_text)
        except Exception as e:
            parsed_json = {"summary_text": ai_text, "totals": totals, "error": str(e)}

        firestore_saved = None
        if SAVE_TO_FIRESTORE:
            try:
                db = init_firestore_if_needed()
                doc_ref = db.collection("users").document(user_id).collection("daily_summary").document(date)
                doc_ref.set({
                    "date": date,
                    "generated_at": firestore.SERVER_TIMESTAMP if 'firestore' in globals() else None,
                    "summary": parsed_json,
                    "totals": totals,
                    "raw_ai_text": ai_text,
                    "logs_count": len(logs),
                    "status": "complete"
                })
                firestore_saved = True
            except Exception as e:
                app.logger.exception("Firestore save failed")
                firestore_saved = False

        os.makedirs("cache", exist_ok=True)
        cache_path = f"cache/summary_{user_id}_{date}.json"
        with open(cache_path, "w") as f:
            json.dump({
                "parsed": parsed_json,
                "totals": totals,
                "firestore_saved": firestore_saved
            }, f, indent=2)

        app.logger.info(f"[BG] ✅ Summary for {user_id} ({date}) complete")

    except Exception as e:
        app.logger.exception(f"[BG] Summary generation failed: {e}")


# ---------- Check summary status ----------
@app.get("/api/summarizeDaily/status")
def summarize_status():
    user_id = request.args.get("user_id", "unknown")
    date = request.args.get("date", time.strftime("%Y-%m-%d"))
    cache_path = f"cache/summary_{user_id}_{date}.json"
    if os.path.exists(cache_path):
        with open(cache_path) as f:
            data = json.load(f)
        return jsonify({"status": "complete", "summary": data})
    return jsonify({"status": "pending"}), 202


# ---------- Run ----------
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5050))
    print(f"⚡ AI service running on port {port} (SAVE_TO_FIRESTORE={SAVE_TO_FIRESTORE})")
    app.run(host="0.0.0.0", port=port, debug=True)
