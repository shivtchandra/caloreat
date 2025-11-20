// src/App.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Routes, Route, Link, useNavigate, Navigate } from "react-router-dom";
import { motion, useScroll, useSpring, useTransform, AnimatePresence } from "framer-motion";

import StickerField from "./StickerField.jsx";
import run from "./assets/stickers/run.png";
import burger from "./assets/stickers/burger.png";
import boy from "./assets/stickers/boy.png";
import salad from "./assets/stickers/salad.png";
import eat from "./assets/stickers/eat.png";
import "./App.css";

import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "./LoginPage";
import ResultsPage from "./ResultsPage.jsx";
import DailyLogPage from "./DailyLogPage.jsx";
import NutritionPage from "./NutritionPage.jsx";
import ProfilePage from "./ProfilePage.jsx";
import MetricsPage from "./MetricsPage.jsx";
import ActivityGraph from "./ActivityGraph.jsx";
import Home from "./Home.js";
import FriendsHub from "./FriendsHub.jsx";
import BarcodeScannerPage from "./BarcodeScannerPage.jsx";

// 🔗 Firestore
import { db } from "./firebaseConfig";
import { doc, getDoc, collection, onSnapshot } from "firebase/firestore";
import { getDailyLogs } from "./firebaseHelpers";

/* ------------------ Small utilities ------------------ */
const safeEntries = (obj) => (obj && typeof obj === "object" ? Object.entries(obj) : []);
const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
const safeObject = (obj) => (obj && typeof obj === "object" ? obj : {});
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ---------- simple helpers ---------- */
const pctToLabel = (pct) => {
  if (pct === null || pct === undefined) return { label: "No data", category: "unknown" };
  if (pct >= 20) return { label: "High", category: "high" };
  if (pct >= 5) return { label: "Moderate", category: "moderate" };
  return { label: "Low", category: "low" };
};

function Badge({ category, label }) {
  const base = { padding: "4px 8px", borderRadius: 12, fontSize: 12, display: "inline-block" };
  const style =
    category === "high"
      ? { background: "#dff8e6", color: "#12621a" }
      : category === "moderate"
        ? { background: "#fff4d0", color: "#7a5a00" }
        : category === "low"
          ? { background: "#ffecec", color: "#7a231f" }
          : { background: "#eee", color: "#333" };
  return <span style={{ ...base, ...style }}>{label}</span>;
}

/* ---------- Network helper (throws on non-200) ---------- */
const handleFetchJson = async (url, options) => {
  const res = await fetch(url, options);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
};


/* ---------- Glass Cards (v2: fixed spacing, aspect, image fallback) ---------- */

const glass = {
  card: {
    position: "relative",
    borderRadius: 22,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.28)",
    boxShadow: "0 22px 80px rgba(11,22,40,0.14)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.14))",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    transition: "transform 220ms ease, box-shadow 220ms ease",
  },
  cardHover: {
    transform: "translateY(-3px)",
    boxShadow: "0 36px 120px rgba(11,22,40,0.22)",
  },
  // Maintain a fixed 16:9 aspect ratio and let the image fill it.
  media: {
    position: "relative",
    width: "100%",
    paddingTop: "56.25%", // 16:9
    overflow: "hidden",
  },
  img: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  footer: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    padding: "12px 14px",
    borderRadius: 16,
    background: "linear-gradient(180deg, rgba(0,0,0,.20), rgba(0,0,0,.40))",
    border: "1px solid rgba(255,255,255,.18)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  leftCol: { display: "grid", gap: 4, lineHeight: 1.05 },
  label: { fontSize: 12, opacity: 0.9 },
  big: { fontSize: 28, fontWeight: 900, letterSpacing: 0.2 },
  sub: { fontSize: 12, opacity: 0.9 },
  btn: {
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.3)",
    color: "#fff",
    background: "rgba(0,0,0,.25)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  chip: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 12,
    background: "rgba(255,255,255,.14)",
    border: "1px solid rgba(255,255,255,.24)",
    whiteSpace: "nowrap",
  },
};

// Very reliable stock images with a guaranteed fallback
const IMAGES = {
  bmr: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
  score: "https://images.unsplash.com/photo-1514517220036-1f91fd91c9e1?auto=format&fit=crop&w=1200&q=80",
  calories: "https://images.unsplash.com/photo-1543353071-087092ec393b?auto=format&fit=crop&w=1200&q=80",
  protein: "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
  carbs: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
  fats: "https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=1200&q=80",
};
const FALLBACK = "https://picsum.photos/1200/675?random=12";

function CardImage({ src, alt = "" }) {
  const [s, setS] = React.useState(src || FALLBACK);
  return <img src={s} alt={alt} style={glass.img} onError={() => setS(FALLBACK)} />;
}

function GlassCard({ src, footerLeft, footerRight, style, delay = 0 }) {
  const [hover, setHover] = React.useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      style={{ ...glass.card, ...(hover ? glass.cardHover : {}), ...style }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={glass.media}>
        <CardImage src={src} />
      </div>
      <div style={glass.footer}>
        <div style={glass.leftCol}>{footerLeft}</div>
        {footerRight}
      </div>
    </motion.div>
  );
}

async function doShare(text, url) {
  try { if (navigator.share) { await navigator.share({ title: "Food Analysis", text, url }); return; } } catch { }
  try { await navigator.clipboard.writeText(`${text}${url ? `\n${url}` : ""}`); } catch { }
  alert("Share text copied!");
}


/* ---------- Quantity parsing helper ---------- */
const parseQuantityPrefix = (s) => {
  if (!s || typeof s !== "string") return { qty: null, text: s || "" };
  const normalized = s.replace(/\u00D7/g, "x").replace(/×/g, "x").replace(/\s+/g, " ").trim();
  const m = normalized.match(/^\s*(\d+)\s*(?:[xX]|[×]|[.\-:)]|\b)\s*(.*)$/);
  if (m) {
    const qty = Number(m[1]) || null;
    const rest = (m[2] || "").trim();
    return { qty, text: rest || normalized };
  }
  const m2 = normalized.match(/^\s*(\d+)\s+(.+)$/);
  if (m2) {
    const qty = Number(m2[1]) || null;
    const rest = (m2[2] || "").trim();
    return { qty, text: rest || normalized };
  }
  return { qty: null, text: normalized };
};

const extractMealMacros = (macros) => {
  if (!macros) return { protein: 0, carbs: 0, fats: 0, calories: 0 };
  const protein = Number(macros.protein_g ?? macros.total_protein ?? macros.protein ?? 0) || 0;
  const carbs =
    Number(
      macros.total_carbohydrate_g ??
      macros.total_carbs ??
      macros.carbs_g ??
      macros.carbs ??
      0
    ) || 0;
  const fats = Number(macros.total_fat_g ?? macros.total_fat ?? macros.fats ?? 0) || 0;
  const calories = Number(macros.calories_kcal ?? macros.calories ?? macros.total_calories ?? 0) || 0;
  return { protein, carbs, fats, calories };
};

const computeBMR = ({ sex = "male", weight_kg = 70, height_cm = 170, age = 25 }) => {
  const w = Number(weight_kg) || 70;
  const h = Number(height_cm) || 170;
  const a = Number(age) || 25;
  if ((sex || "male").toLowerCase().startsWith("f"))
    return 10 * w + 6.25 * h - 5 * a - 161;
  return 10 * w + 6.25 * h - 5 * a + 5;
};

const activityFactor = (level = "moderately_active") => {
  const map = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
    athlete: 1.9,
  };
  return map[level] || 1.55;
};

const computeGoals = ({
  sex,
  weight_kg,
  height_cm,
  age,
  activity_level = "moderately_active",
  goal = "maintenance",
}) => {
  const bmr = computeBMR({ sex, weight_kg, height_cm, age });
  let tdee = bmr * activityFactor(activity_level);
  if (goal === "weight_loss") tdee *= 0.85;
  if (goal === "weight_gain") tdee *= 1.1;

  const protein_g = Math.round((Number(weight_kg) || 70) * 1.6);
  const fats_g = Math.round((Number(weight_kg) || 70) * 0.8);
  const kcal_from_protein = protein_g * 4;
  const kcal_from_fats = fats_g * 9;
  const leftover = Math.max(0, tdee - (kcal_from_protein + kcal_from_fats));
  const carbs_g = Math.round(leftover / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    macro_goals: {
      calories: Math.round(tdee),
      protein_g,
      carbs_g,
      fats_g,
    },
  };
};

const dateKey = (ts) =>
  ts ? new Date(ts).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

/* ------------------ Presentational subcomponents ------------------ */
function Navbar() {
  return (
    <header className="header" style={{ marginBottom: 36, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>Food Analysis</h1>
          <span style={{ color: "#6b7280", fontSize: 14, display: "none", sm: { display: "inline" } }}>— AI-powered meal analysis</span>
        </div>
      </div>

      {/* ONLY Metrics + Profile in top nav */}
      <nav style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        overflowX: "auto",
        paddingBottom: 4,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        whiteSpace: "nowrap",
        WebkitOverflowScrolling: "touch",
      }}>
        <style>{`nav::-webkit-scrollbar { display: none; }`}</style>
        <Link to="/app/metricspage" className="nav-link" style={{ flexShrink: 0 }}>About metrics</Link>
        <Link to="/app/profile" className="nav-link" style={{ flexShrink: 0 }}>Profile</Link>
        <Link to="/app/friends" className="nav-link" style={{ flexShrink: 0 }}>Friends</Link>
      </nav>
    </header>
  );
}

function FeatureCard({ title, children, ctaText, onClick }) {
  return (
    <div className="ui-card" style={{ padding: 24 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={{ color: "#4b5563" }}>{children}</p>
      <div style={{ marginTop: 12 }}>
        <button className="btn-map" onClick={onClick} style={{ padding: "8px 14px" }}>
          {ctaText}
        </button>
      </div>
    </div>
  );
}

/* ---------- Stacked cards that "blast sideways" on scroll ---------- */
function StackedBlastCards() {
  const navigate = useNavigate();
  const sectionRef = useRef(null);

  // Scroll progress through this section (0 -> 1)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 85%", "end 25%"],
  });
  const prog = useSpring(scrollYProgress, { stiffness: 160, damping: 22, mass: 0.35 });

  // Responsive spread + compact for tiny screens
  const [spread, setSpread] = useState(220);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const compute = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 1200;
      setSpread(Math.max(110, Math.min(280, Math.floor(w * 0.34))));
      setCompact(w < 380);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const maxRight = compact ? Math.min(90, spread * 0.45) : spread;
  const maxLeft = compact ? -Math.min(90, spread * 0.45) : -spread;

  // Phased reveal:
  // Card 0 stays centered; Card 1 reveals right; Card 2 reveals left (both start under Card 0)
  // center stays put
  const x0 = useTransform(prog, [0, 1], [0, 0]);

  // BOTH side cards start at the same time (0.30)
  const x1 = useTransform(prog, [0.00, 0.30, 1.00], [0, 0, maxRight]); // right
  const x2 = useTransform(prog, [0.00, 0.30, 1.00], [0, 0, maxLeft]);  // left

  // fade in together
  const op1 = useTransform(prog, [0.00, 0.30, 0.45, 1.00], [0, 0, 1, 1]);
  const op2 = useTransform(prog, [0.00, 0.30, 0.45, 1.00], [0, 0, 1, 1]);

  // unstack together
  const y0 = useTransform(prog, [0, 1], [0, 0]);
  const y1 = useTransform(prog, [0.00, 0.30, 1.00], [12, 0, 0]);
  const y2 = useTransform(prog, [0.00, 0.30, 1.00], [24, 0, 0]);

  // rotate together
  const r1 = useTransform(prog, [0.30, 1.00], [0, compact ? 2 : 3]);
  const r2 = useTransform(prog, [0.30, 1.00], [0, compact ? -2 : -3]);

  const cardStyle = {
    position: "relative",
    borderRadius: 18,
    background: "white",
    padding: 22,
    width: "min(680px, 92vw)",
    margin: "0 auto",
    border: "1px solid rgba(0,0,0,0.06)",
    touchAction: "manipulation",
    boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
  };

  const Row = ({ icon, title, desc, onClick, aria, cta = "Go →" }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>{title}</div>
        <div style={{ color: "#6b7280", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis" }}>
          {desc}
        </div>
      </div>
      <button className="btn-map" onClick={onClick} aria-label={aria}>
        {cta}
      </button>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      style={{
        marginBottom: 48,
        padding: "36px 12px 60px",
        background:
          "radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,0.10), transparent 60%)",
        overflow: "visible",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Your Daily Tools</h3>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Two cards sit under the first, then reveal sideways as you scroll.
        </p>
      </div>

      {/* Top card visible, two tucked underneath (negative margins create the stack) */}
      <div style={{ display: "grid", gap: 0 }}>
        {/* Card 1 — stays centered */}
        <div style={{ zIndex: 9 }}>
          <motion.div style={{ ...cardStyle, x: x0, y: y0, zIndex: 9 }}>
            <Row
              icon="🗓"
              title="Daily Log"
              desc="Add meals, water, workouts & more."
              onClick={() => navigate("/app/dailylog")}
              aria="Open Daily Log"
            />
          </motion.div>
        </div>

        {/* Card 2 — tucked under, then reveal right */}
        <div style={{ marginTop: -18, zIndex: 8 }}>
          <motion.div
            style={{
              ...cardStyle,
              x: x1,
              y: y1,
              rotate: r1,
              opacity: op1,
              zIndex: 8,
            }}
          >
            <Row
              icon="📈"
              title="Activity"
              desc="Track your movement and habits."
              onClick={() => navigate("/app/activity")}
              aria="Open Activity"
              cta="View →"
            />
          </motion.div>
        </div>

        {/* Card 3 — tucked further, then reveal left */}
        <div style={{ marginTop: -18, zIndex: 7 }}>
          <motion.div
            style={{
              ...cardStyle,
              x: x2,
              y: y2,
              rotate: r2,
              opacity: op2,
              zIndex: 7,
            }}
          >
            <Row
              icon="🍽"
              title="Nutrition"
              desc="Detailed nutrient breakdowns & history."
              onClick={() => navigate("/app/nutrition")}
              aria="Open Nutrition"
              cta="Open →"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ---- profile completeness helpers ----
const REQUIRED_PROFILE_KEYS = ["sex", "age", "height_cm", "weight_kg", "activity_level", "goal"];

const isProfileComplete = (p = {}) =>
  REQUIRED_PROFILE_KEYS.every(k => p[k] !== undefined && p[k] !== null && String(p[k]).toString().trim() !== "");

const prettyGoal = (g) => {
  if (!g) return "—";
  const s = String(g).toLowerCase();
  if (s.includes("loss") || s.includes("cut")) return "Weight loss";
  if (s.includes("gain") || s.includes("bulk")) return "Weight gain";
  return "Maintenance";
};



/* ------------------ Main app (protected) ------------------ */
function MainApp() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid || null;

  // Analysis state
  const [report, setReport] = useState(null);
  const [mapped, setMapped] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState([]);
  const [final, setFinal] = useState(null);
  const [micros, setMicros] = useState(null);

  // manual add states
  const [manualName, setManualName] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualPortion, setManualPortion] = useState(1);
  const [manualCalories, setManualCalories] = useState("");

  // personalization states
  const [profile, setProfile] = useState(null);
  const [goals, setGoals] = useState(null); // local computed
  const [todayTotals, setTodayTotals] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [healthScore, setHealthScore] = useState(null);
  const [persoLoading, setPersoLoading] = useState(false);

  // backend summary states (from /api/summarizeDaily/status)
  const [profileStats, setProfileStats] = useState(null); // bmr/tdee/targets (server)
  const [dayStats, setDayStats] = useState(null); // totals (server)
  const [loadingSummary, setLoadingSummary] = useState(false);

  // new: streaks + friends realtime
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendsStreaksCount, setFriendsStreaksCount] = useState(0);

  // UI: active tab ("meals" | "friends" | "streaks")
  const [activeTab, setActiveTab] = useState("meals");

  // meals list for today
  const [mealsTodayRows, setMealsTodayRows] = useState([]);

  // ----- UI state for greeting/banner -----
  const displayName = (profile?.name && profile.name.trim()) || user?.displayName || user?.email || "there";
  const profileDone = isProfileComplete(profile || {});
  const bmrVal = profileStats?.bmr ?? goals?.bmr ?? null;
  const tdeeVal = profileStats?.tdee ?? goals?.tdee ?? null;


  // ---------- manual add ----------
  const addManualItem = () => {
    const name = (manualName || "").trim();
    if (!name) {
      alert("Please enter an item name.");
      return;
    }
    const qty = Number(manualQty) || 1;
    const portion = Number(manualPortion) || 1;
    const manual_cal = manualCalories === "" ? null : Number(manualCalories);
    const newItem = {
      id: Date.now(),
      raw_text: `${qty}x ${name}`,
      extracted_text: name,
      quantity: qty,
      portion_mult: portion,
      candidates: [],
      selected: name,
      selected_score: 100,
      manual_calories: manual_cal,
      model_prob: null,
    };
    setConfirmed((prev) => [...prev, newItem]);
    setManualName("");
    setManualQty(1);
    setManualPortion(1);
    setManualCalories("");
  };

  // ---------- Load profile + compute local goals + aggregate today's Firestore totals ----------
  useEffect(() => {
    if (!uid) return;
    let mounted = true;
    (async () => {
      try {
        setPersoLoading(true);
        // Profile (Firestore)
        const profileRef = doc(db, "users", uid, "profile", "main");
        const snap = await getDoc(profileRef);
        const pf = snap.exists() ? snap.data() : {};

        // Normalize fields from Firestore keys + localStorage
        const ls = {
          sex: localStorage.getItem("profile_sex"),
          age: localStorage.getItem("profile_age"),
          height_cm: localStorage.getItem("profile_height_cm"),
          weight_kg: localStorage.getItem("profile_weight_kg"),
          activity_level: localStorage.getItem("profile_activity_level"),
          goal: localStorage.getItem("profile_goal"),
          name: localStorage.getItem("profile_name"),
          location: localStorage.getItem("profile_location"),
        };

        // canonical mapping: accept older keys that your ProfilePage may still use
        const normalized = {
          // prefer Firestore canonical, else try older variants, else localStorage, else undefined
          name: pf.name ?? pf.displayName ?? pf.fullName ?? ls.name ?? undefined,
          email: pf.email ?? undefined,
          sex:
            (pf.sex || pf.gender || pf.profile_sex || "").toString().toLowerCase() ||
            (ls.sex || undefined),
          age: pf.age ?? pf.years ?? (ls.age ? Number(ls.age) : undefined),
          height_cm: pf.height_cm ?? pf.height ?? (ls.height_cm ? Number(ls.height_cm) : undefined),
          weight_kg: pf.weight_kg ?? pf.weight ?? (ls.weight_kg ? Number(ls.weight_kg) : undefined),
          activity_level:
            pf.activity_level ?? pf.activity ?? ls.activity_level ?? ls.activity ?? undefined,
          goal: pf.goal ?? ls.goal ?? undefined,
          location: pf.location ?? ls.location ?? undefined,
        };

        // Soft fallback to any local stored bits (keeps previous behavior)
        const mergedProfile = { ...normalized };

        // Local goals (fast)
        const computed = computeGoals({
          sex: mergedProfile.sex || "male",
          weight_kg: mergedProfile.weight_kg || 70,
          height_cm: mergedProfile.height_cm || 170,
          age: mergedProfile.age || 25,
          activity_level: mergedProfile.activity_level || "moderately_active",
          goal: mergedProfile.goal || "maintenance",
        });

        // Today's totals from Firestore
        const rows = await getDailyLogs(uid).catch(() => []);
        const today = new Date().toLocaleDateString("en-CA");
        let totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
        const todayRows = [];
        rows.forEach((l) => {
          const dkey = l.date || dateKey(l.timestamp);
          if (dkey !== today) return;
          if ((l.category || "meal") !== "meal") return;
          const cal = Number(l.calories ?? l.macros?.calories_kcal ?? 0) || 0;
          const m = extractMealMacros(l.macros);
          totals.calories += cal;
          totals.protein += m.protein;
          totals.carbs += m.carbs;
          totals.fats += m.fats;
          todayRows.push(l);
        });
        totals = {
          calories: Math.round(totals.calories),
          protein: Math.round(totals.protein),
          carbs: Math.round(totals.carbs),
          fats: Math.round(totals.fats),
        };

        // Health score 0–100
        const g = computed.macro_goals;
        const calRatio = g.calories ? clamp(totals.calories / g.calories, 0, 2) : 0;
        const calScore = 40 * (1 - Math.min(Math.abs(1 - calRatio), 1));
        const macroPart = (actual, goal) =>
          goal > 0 ? 1 - Math.min(Math.abs(actual - goal) / goal, 1) : 0;
        const pScore = macroPart(totals.protein, g.protein_g);
        const cScore = macroPart(totals.carbs, g.carbs_g);
        const fScore = macroPart(totals.fats, g.fats_g);
        const macroScore = 45 * ((pScore + cScore + fScore) / 3);
        const compScore = 15 * (totals.calories > 0 ? 1 : 0);
        const finalScore = Math.round(calScore + macroScore + compScore);

        if (!mounted) return;
        setProfile(mergedProfile);
        setGoals(computed);
        setTodayTotals(totals);
        setHealthScore(finalScore);
        setMealsTodayRows(todayRows);
      } catch (e) {
        console.warn("personalization load failed:", e);
      } finally {
        if (mounted) setPersoLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [uid]);

  // ---------- Backend Daily Summary (personalized, non-LLM) ----------
  const fetchDailySummary = async () => {
    if (!uid) return;
    try {
      setLoadingSummary(true);
      const date = new Date().toISOString().slice(0, 10);

      // Build logs from Firestore for TODAY
      const rows = await getDailyLogs(uid).catch(() => []);
      const mealsToday = rows
        .filter((l) => (l.date || dateKey(l.timestamp)) === date && (l.category || "meal") === "meal")
        .map((l) => {
          const m = extractMealMacros(l.macros);
          const cal = Number(l.calories ?? l.macros?.calories_kcal ?? 0) || 0;
          return {
            item: l.item || l.name || l.item_name || "Meal",
            calories: cal,
            macros: {
              protein_g: m.protein,
              total_carbohydrate_g: m.carbs,
              total_fat_g: m.fats,
            },
          };
        });

      // Profile payload for better targets
      const profileRef = doc(db, "users", uid, "profile", "main");
      const snap = await getDoc(profileRef);
      const pf = snap.exists() ? snap.data() : {};
      const profilePayload = {
        sex: pf.sex || pf.gender || "male",
        age: Number(pf.age ?? pf.years ?? 25),
        height_cm: Number(pf.height_cm ?? pf.height ?? 170),
        weight_kg: Number(pf.weight_kg ?? pf.weight ?? 70),
        activity_level: (pf.activity_level || pf.activity || "moderately_active").toString().toLowerCase(),
        goal: (pf.goal || "maintenance").toString().toLowerCase(),
      };

      // Start summary
      await fetch("https://caloreat.onrender.com/api/summarizeDaily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: uid,
          date,
          logs: mealsToday,
          profile: profilePayload,
        }),
      });

      // Poll status once (your backend completes almost immediately)
      const res = await fetch(
        `https://caloreat.onrender.com/api/summarizeDaily/status?user_id=${encodeURIComponent(
          uid
        )}&date=${encodeURIComponent(date)}`
      );
      const js = await res.json();
      if (js?.status === "complete" && js.summary?.parsed) {
        const parsed = js.summary.parsed;
        setProfileStats(parsed.profile_used);
        setDayStats(parsed.totals);
      }
    } catch (e) {
      console.warn("fetchDailySummary failed:", e);
    } finally {
      setLoadingSummary(false);
    }
  };

  // Run backend summary whenever totals change (after Analyze) or on mount
  useEffect(() => {
    if (!uid) return;
    fetchDailySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, todayTotals.calories, todayTotals.protein, todayTotals.carbs, todayTotals.fats]);

  // ---------- Streaks calculation helper (from logs) ----------
  const computeStreaksFromLogs = (rows = []) => {
    // Build a Set of ISO dates (YYYY-MM-DD) where user logged at least one meal
    const datesSet = new Set();
    rows.forEach((r) => {
      if ((r.category || "meal") !== "meal") return;
      const d = r.date || dateKey(r.timestamp);
      if (!d) return;
      datesSet.add(String(d));
    });

    if (datesSet.size === 0) return { current: 0, best: 0 };

    // Convert to sorted array (descending)
    const dates = Array.from(datesSet)
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => b - a);

    // Helper to format date to YYYY-MM-DD
    const fmt = (dt) => dt.toISOString().slice(0, 10);

    // Current streak: starting from today, count consecutive present dates
    let cur = 0;
    const todayKey = fmt(new Date());
    let check = new Date(); // start at today
    while (true) {
      const k = fmt(check);
      if (datesSet.has(k)) {
        cur += 1;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }

    // Best streak: find longest consecutive run in the set
    // Convert set to array of keys and sort ascending to scan
    const ascDates = Array.from(datesSet).sort();
    let best = 0, run = 0, prev = null;
    ascDates.forEach((dstr) => {
      const d = new Date(dstr);
      if (prev === null) {
        run = 1;
      } else {
        const diff = (d - prev) / (1000 * 60 * 60 * 24); // days diff
        if (diff === 1) {
          run += 1;
        } else {
          run = 1;
        }
      }
      best = Math.max(best, run);
      prev = d;
    });

    return { current: cur, best };
  };

  // ---------- Realtime friends listener & streak computation ----------
  useEffect(() => {
    if (!uid) {
      setFriendsCount(0);
      setFriendsStreaksCount(0);
      setCurrentStreak(0);
      setBestStreak(0);
      return;
    }

    let unsubFriends = null;
    try {
      const friendsCol = collection(db, "users", uid, "friends");
      // realtime friends count
      unsubFriends = onSnapshot(friendsCol, (snap) => {
        setFriendsCount(snap.size);
        // optionally compute friends' streaks count if friend docs contain `current_streak` field
        let friendStreaks = 0;
        snap.forEach((d) => {
          const data = d.data();
          if (data?.current_streak && Number(data.current_streak) > 0) friendStreaks++;
        });
        setFriendsStreaksCount(friendStreaks);
      });
    } catch (e) {
      console.warn("friends onSnapshot failed:", e);
    }

    // also compute streaks from logs (non-realtime but updated when logs change)
    let mounted = true;
    (async () => {
      try {
        const rows = await getDailyLogs(uid).catch(() => []);
        if (!mounted) return;
        const s = computeStreaksFromLogs(rows);
        setCurrentStreak(s.current);
        setBestStreak(s.best);
      } catch (e) {
        console.warn("compute streaks failed:", e);
      }
    })();

    return () => {
      if (unsubFriends) unsubFriends();
      mounted = false;
    };
    // run when uid changes or when today's totals update (so streaks recalc after new logs)
  }, [uid, todayTotals.calories, todayTotals.protein, todayTotals.carbs, todayTotals.fats]);

  /* ---------- Submit confirmed to nutrient endpoint (still available for other flows) ---------- */
  const submitConfirmed = async () => {
    if (!confirmed.length) {
      alert("No items to confirm.");
      return;
    }
    const payload = {
      items: confirmed.map((c) => {
        const out = {
          name: c.selected,
          quantity: Number((c.quantity * c.portion_mult).toFixed(3)),
          portion_mult: c.portion_mult,
        };
        if (c.manual_calories !== null && c.manual_calories !== "")
          out.manual_calories = Number(c.manual_calories);
        return out;
      }),
    };
    setLoading(true);
    try {
      const data = await handleFetchJson("https://caloreat.onrender.com/api/run_nutrients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setFinal(safeObject(data));
      setMicros(safeObject(data));

      try {
        sessionStorage.setItem("food_results", JSON.stringify({ final: data, confirmed }));
      } catch (_) { }

      navigate("/app/results");
    } catch (err) {
      console.error("submitConfirmed error", err);
      alert("Submit failed — see console.");
    } finally {
      setLoading(false);
    }
  };

  const updateConfirmed = (id, patch) => {
    setConfirmed((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeConfirmed = (id) => setConfirmed((prev) => prev.filter((c) => c.id !== id));

  // 🆕 derived values for the small cards (fall back to local goals if server hasn't returned yet)
  const activeTargets = profileStats
    ? {
      calories: profileStats.calorie_target,
      protein_g: profileStats.protein_target_g,
      carbs_g: profileStats.carb_target_g,
      fats_g: profileStats.fat_target_g, // <-- fixed typo (was profile_stats)
    }
    : goals?.macro_goals || { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 };

  const displayTotals = dayStats
    ? {
      calories: Math.round(dayStats.calories || 0),
      protein: Math.round(dayStats.protein_g || 0),
      carbs: Math.round(dayStats.carbs_g || 0),
      fats: Math.round(dayStats.fats_g || 0),
    }
    : todayTotals;

  const remaining = useMemo(() => {
    const g = activeTargets;
    return {
      calories: Math.max(0, Math.round((g.calories || 0) - (displayTotals.calories || 0))),
      protein: Math.max(0, Math.round((g.protein_g || 0) - (displayTotals.protein || 0))),
      carbs: Math.max(0, Math.round((g.carbs_g || 0) - (displayTotals.carbs || 0))),
      fats: Math.max(0, Math.round((g.fats_g || 0) - (displayTotals.fats || 0))),
    };
  }, [activeTargets, displayTotals]);

  /* ---------- Home UI ---------- */
  return (
    <div className="app-shell">
      <StickerField
        count={18}
        stickers={["🍎", "🥗", "🍳", "🍓", "🍪", "🥛", "🍌", "💪", "🥕", "🍞"]}
        pngStickers={[run, burger, boy, salad, eat]}
        seed={1234}
      />

      <Navbar />

      <main style={{ width: "100%", maxWidth: 1152, margin: "0 auto", padding: "18px" }}>
        {/* <button
        className="btn-scan"
        style={{
          position: "fixed",
          bottom: "90px",
          right: "20px",
          background: "#10b981",
          color: "#fff",
          padding: "14px 16px",
          borderRadius: "999px",
          border: "none",
          fontWeight: "700",
          boxShadow: "0 10px 28px rgba(0,0,0,0.2)",
          cursor: "pointer",
          zIndex: 50,
        }}
        onClick={() => navigate("/scan")}
      >
        📸 Scan Food
      </button> */}

        {/* TOP STATS / PROFILE SUMMARY */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
            Hello{displayName ? `, ${displayName}` : ""} 👋
          </h2>

          {!profileDone ? (
            <div
              className="ui-card"
              style={{
                marginTop: 8,
                padding: 16,
                borderRadius: 14,
                background: "linear-gradient(135deg,#fff7ed 0%,#ffedd5 100%)",
                border: "1px solid #fed7aa",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, color: "#7a3e00" }}>Finish your profile</div>
                <div style={{ color: "#7c6d5a" }}>
                  Add sex, age, height, weight, activity and goal to unlock accurate targets.
                </div>
                <Link
                  to="/app/profile"
                  className="btn-map"
                  style={{ marginLeft: "auto", padding: "8px 12px" }}
                >
                  Complete Profile →
                </Link>
              </div>
            </div>
          ) : (
            <p style={{ color: "#6b6257", marginTop: 6 }}>
              You’re set for <b>{prettyGoal(profile?.goal)}</b>. Keep logging to stay on track.
            </p>
          )}

          {/* Daily Summary Stats */}
          {/* Daily Summary Stats — 3 per row on desktop, wraps on small screens */}
          {uid && (
            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 18,
                alignItems: "stretch",
              }}
            >
              {/* BMR / TDEE */}
              <GlassCard
                src={IMAGES.bmr}
                delay={0.1}
                footerLeft={
                  <>
                    <div style={glass.label}>BMR / TDEE</div>
                    <div style={glass.big}>
                      {bmrVal ? Math.round(bmrVal) : "—"} / {tdeeVal ? Math.round(tdeeVal) : "—"}
                    </div>
                    <div style={glass.sub}>kcal • Targets use your profile</div>
                  </>
                }
                footerRight={
                  <button
                    style={glass.btn}
                    onClick={() => {
                      const who = displayName || "a friend";
                      const msg = `Hey — checkout ${who}! BMR/TDEE: ${Math.round(bmrVal || 0)}/${Math.round(tdeeVal || 0)} kcal on Food Analysis. Join me to track & grow 💪`;
                      doShare(msg, window.location.origin);
                    }}
                  >
                    Share
                  </button>
                }
              />

              {/* Health Score */}
              <GlassCard
                src={IMAGES.score}
                delay={0.2}
                footerLeft={
                  <>
                    <div style={glass.label}>Health Score</div>
                    <div style={glass.big}>{persoLoading ? "—" : (healthScore ?? "—")}</div>
                    <div style={glass.sub}>Out of 100</div>
                  </>
                }
                footerRight={<div style={glass.chip}>auto-updates</div>}
              />

              {/* Calories */}
              <GlassCard
                src={IMAGES.calories}
                delay={0.3}
                footerLeft={
                  <>
                    <div style={glass.label}>Calories</div>
                    <div style={glass.big}>
                      {displayTotals.calories}/{activeTargets.calories}
                    </div>
                    <div style={glass.sub}>Remaining: {remaining.calories} kcal</div>
                  </>
                }
                footerRight={
                  <button
                    style={glass.btn}
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        `${displayTotals.calories}/${activeTargets.calories} kcal`
                      ).catch(() => { });
                      alert("Copied calories to clipboard!");
                    }}
                  >
                    Copy
                  </button>
                }
              />

              {/* Protein */}
              <GlassCard
                src={IMAGES.protein}
                delay={0.4}
                footerLeft={
                  <>
                    <div style={glass.label}>Protein</div>
                    <div style={glass.big}>
                      {displayTotals.protein}g/{activeTargets.protein_g}g
                    </div>
                    <div style={glass.sub}>
                      Left: {Math.max(0, (activeTargets.protein_g || 0) - (displayTotals.protein || 0))}g
                    </div>
                  </>
                }
                footerRight={
                  <button
                    style={glass.btn}
                    onClick={() => {
                      const who = displayName || "a friend";
                      const pct = activeTargets.protein_g ? Math.round((displayTotals.protein / activeTargets.protein_g) * 100) : 0;
                      const msg = `Hey — checkout ${who}, logged ${displayTotals.protein}/${activeTargets.protein_g}g protein today (${pct}%). Track & grow together!`;
                      doShare(msg, `${window.location.origin}/app`);
                    }}
                  >
                    Share
                  </button>
                }
              />

              {/* Carbs */}
              <GlassCard
                src={IMAGES.carbs}
                delay={0.5}
                footerLeft={
                  <>
                    <div style={glass.label}>Carbs</div>
                    <div style={glass.big}>
                      {displayTotals.carbs}g/{activeTargets.carbs_g}g
                    </div>
                    <div style={glass.sub}>Left: {remaining.carbs}g</div>
                  </>
                }
                footerRight={<div style={glass.chip}>smart target</div>}
              />

              {/* Fats */}
              <GlassCard
                src={IMAGES.fats}
                delay={0.6}
                footerLeft={
                  <>
                    <div style={glass.label}>Fats</div>
                    <div style={glass.big}>
                      {displayTotals.fats}g/{activeTargets.fats_g}g
                    </div>
                    <div style={glass.sub}>Left: {remaining.fats}g</div>
                  </>
                }
                footerRight={<div style={glass.chip}>balanced</div>}
              />
            </div>
          )}

        </section>


        {/* MAIN ACTION: stacked cards that blast sideways */}
        <StackedBlastCards />

        {/* ------------------ NEW: Streaks & Friends area (inserted below stacked cards) ------------------ */}
        <section style={{ marginTop: 8 }}>
          {/* tabs bar (clickable) */}
          <div style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
            overflowX: "auto",
            paddingBottom: 4, // space for scrollbar if visible
            scrollbarWidth: "none", // hide scrollbar firefox
            msOverflowStyle: "none", // hide scrollbar IE
            whiteSpace: "nowrap",
            WebkitOverflowScrolling: "touch",
          }}>
            <style>{`
              div::-webkit-scrollbar { display: none; }
            `}</style>
            <div
              onClick={() => setActiveTab("meals")}
              style={{
                flex: 1,
                background: activeTab === "meals" ? "#fff" : "#F3F4F6",
                padding: "10px 14px",
                borderRadius: 12,
                textAlign: "center",
                fontWeight: 700,
                cursor: "pointer",
                border: activeTab === "meals" ? "1px solid rgba(0,0,0,0.06)" : "none"
              }}
            >
              Today's Meals
            </div>
            <div
              onClick={() => setActiveTab("friends")}
              style={{
                flex: 1,
                background: activeTab === "friends" ? "#fff" : "#F3F4F6",
                padding: "10px 14px",
                borderRadius: 12,
                textAlign: "center",
                fontWeight: 700,
                cursor: "pointer",
                border: activeTab === "friends" ? "1px solid rgba(0,0,0,0.06)" : "none"
              }}
            >
              Friends
            </div>
            <div
              onClick={() => setActiveTab("streaks")}
              style={{
                flex: 1,
                background: activeTab === "streaks" ? "#fff" : "#F3F4F6",
                padding: "10px 14px",
                borderRadius: 12,
                textAlign: "center",
                fontWeight: 700,
                cursor: "pointer",
                border: activeTab === "streaks" ? "1px solid rgba(0,0,0,0.06)" : "none"
              }}
            >
              Streaks
            </div>
          </div>

          {/* Panel content */}
          {activeTab === "meals" && (
            <div style={{
              borderRadius: 12,
              background: "#fff",
              padding: 22,
              boxShadow: "0 12px 30px rgba(11,22,40,0.04)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>Today's Meals</div>
                  <div style={{ color: "#6b7280", marginTop: 6 }}>{mealsTodayRows.length} item(s)</div>
                </div>
                <div>
                  <button
                    onClick={() => navigate("/app/dailylog")}
                    style={{ background: "#ff6a00", color: "#fff", padding: "8px 14px", borderRadius: 8, border: "none", fontWeight: 700 }}
                  >
                    Log Meal
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                {mealsTodayRows.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "28px 0", color: "#6b7280" }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>No meals logged yet today</div>
                    <div style={{ marginTop: 12 }}>
                      <button
                        onClick={() => navigate("/app/dailylog")}
                        style={{ background: "#ff6a00", color: "#fff", padding: "10px 16px", borderRadius: 8, border: "none", fontWeight: 700 }}
                      >
                        Log Your First Meal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {mealsTodayRows.map((m, i) => {
                      const macros = extractMealMacros(m.macros);
                      const name = m.item || m.name || m.item_name || "Meal";
                      return (
                        <div key={m.id || i} style={{ padding: 14, borderRadius: 10, border: "1px solid rgba(0,0,0,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{name}</div>
                            <div style={{ color: "#6b7280", fontSize: 13 }}>{m.note || m.portion || ""}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 800 }}>{Math.round(macros.calories || m.calories || 0)} kcal</div>
                            <div style={{ color: "#6b7280", fontSize: 13 }}>{Math.round(macros.protein)}g P · {Math.round(macros.carbs)}g C · {Math.round(macros.fats)}g F</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "friends" && (
            <div style={{
              borderRadius: 12,
              background: "#fff",
              padding: 22,
              boxShadow: "0 12px 30px rgba(11,22,40,0.04)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>👥 Your Friends</div>
                  <div style={{ color: "#6b7280", marginTop: 6 }}>{friendsCount} friend(s)</div>
                </div>
                <div>
                  <button
                    onClick={() => navigate("/app/friends")}
                    style={{ background: "#ff6a00", color: "#fff", padding: "8px 14px", borderRadius: 8, border: "none", fontWeight: 700 }}
                  >
                    + Add Friend
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 14, minHeight: 160, display: "grid", placeItems: "center", color: "#6b7280" }}>
                {friendsCount === 0 ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>No friends yet</div>
                    <div>Add friends to see their streaks and compete!</div>
                    <div style={{ marginTop: 12 }}>
                      <button
                        onClick={() => navigate("/app/friends")}
                        style={{ background: "#ff6a00", color: "#fff", padding: "8px 14px", borderRadius: 8, border: "none", fontWeight: 700 }}
                      >
                        Add Your First Friend
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ width: "100%", maxWidth: 920 }}>
                    <div style={{ color: "#111827", fontWeight: 700, marginBottom: 8 }}>Friends list</div>
                    <div style={{ color: "#6b7280" }}>Friend listing UI goes here (map docs from users/{uid}/friends)</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "streaks" && (
            <div style={{
              borderRadius: 12,
              background: "#fff",
              padding: 22,
              boxShadow: "0 12px 30px rgba(11,22,40,0.04)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>🔥 Your Streak</div>
                  <div style={{ color: "#6b7280", marginTop: 6 }}>Track how many days in a row you've logged meals</div>
                </div>
                <div>
                  <button
                    onClick={() => setActiveTab("friends")}
                    className="btn-map"
                    style={{ padding: "8px 12px" }}
                  >
                    View Friends' Streaks
                  </button>
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ padding: 18, borderRadius: 10, background: "#FFF6F6", border: "1px solid rgba(0,0,0,0.02)" }}>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>Current Streak</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{currentStreak}</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>days in a row</div>
                </div>
                <div style={{ padding: 18, borderRadius: 10, background: "#FFF6F6", border: "1px solid rgba(0,0,0,0.02)" }}>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>Best Streak</div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{bestStreak}</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>all time</div>
                </div>
              </div>

              <div style={{ marginTop: 16, borderRadius: 10, padding: 16, border: "1px dashed rgba(0,0,0,0.04)", background: "#fff" }}>
                <div style={{ color: "#6b7280" }}>{friendsStreaksCount} friend(s) currently have a streak</div>
              </div>
            </div>
          )}
        </section>

        {/* (Removed the old “Scan & Import” upload section as requested) */}
      </main>

      <footer style={{ textAlign: "center", padding: "28px 18px", opacity: 0.8 }}>
        <small>© {new Date().getFullYear()} Food Analysis — Prototype for testing and learning.</small>
      </footer>
    </div>
  );
}

/* ---------- Routes component (uses auth) ---------- */
function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* public landing */}
      <Route path="/" element={!user ? <Home /> : <Navigate to="/app" replace />} />

      {/* login */}
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/app" replace />} />

      {/* Protected app root */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <MainApp />
          </ProtectedRoute>
        }
      />

      {/* Protected sub-pages */}
      <Route
        path="/app/results"
        element={
          <ProtectedRoute>
            <ResultsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/dailylog"
        element={
          <ProtectedRoute>
            <DailyLogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/metricspage"
        element={
          <ProtectedRoute>
            <MetricsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/activity"
        element={
          <ProtectedRoute>
            <ActivityGraph />
          </ProtectedRoute>
        }
      />

      {/* Nutrition pages */}
      <Route
        path="/app/nutrition"
        element={
          <ProtectedRoute>
            <NutritionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/nutrition/:id"
        element={
          <ProtectedRoute>
            <NutritionPage />
          </ProtectedRoute>
        }
      />
      {/* friends route */}
      <Route
        path="/app/friends"
        element={
          <ProtectedRoute>
            <FriendsHub />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scan"
        element={
          <ProtectedRoute>
            <BarcodeScannerPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/* ---------- App wrapper (routes + auth) ---------- */
export default function App() {
  return <AppRoutes />;
}
