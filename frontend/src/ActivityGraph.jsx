// src/ActivityGraph.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getDailyLogs, watchDailyLogs } from "./firebaseHelpers";
import { db, auth } from "./firebaseConfig";
import { Flame, Droplet, Award, TrendingUp, Calendar, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AISummaryDisplay from "./AISummaryDisplay.jsx";
import { doc, getDoc } from "firebase/firestore";
import { marked } from "marked";
import DOMPurify from "dompurify";
// get profile (Firestore first, then localStorage fallback)
async function loadUserProfile(uid) {
  try {
    const d = await getDoc(doc(db, "profiles", uid));
    if (d.exists()) return d.data();
  } catch {}
  // fallback
  return {
    sex: localStorage.getItem("profile_sex") || "male",
    age: Number(localStorage.getItem("profile_age") || 24),
    height_cm: Number(localStorage.getItem("profile_height_cm") || 176),
    weight_kg: Number(localStorage.getItem("profile_weight_kg") || 72),
    activity_level: localStorage.getItem("profile_activity") || "light",
    goal: (localStorage.getItem("profile_goal") || "maintain").toLowerCase(),
  };
}

/* ---------- utilities (unchanged) ---------- */
function last7Days() {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ key, label: days[d.getDay()] });
  }
  return out;
}

function aggregateWeek(logs = []) {
  const days = last7Days();
  const map = {};
  days.forEach((d) => {
    map[d.key] = { label: d.label, calories: 0, dateKey: d.key };
  });

  logs.forEach((l) => {
    const key = l.date || (l.timestamp ? new Date(l.timestamp).toISOString().slice(0, 10) : null);
    if (!key) return;
    if (!map[key]) return; // ignore outside window
    const c = Number(l.calories) || 0;
    map[key].calories = (map[key].calories || 0) + c;
  });

  return Object.values(map);
}

function computeStreak(logs = []) {
  const set = new Set(
    logs.map((l) => l.date || (l.timestamp ? new Date(l.timestamp).toISOString().slice(0, 10) : null))
  );
  const today = new Date();
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (set.has(key)) streak++;
    else break;
    if (streak > 365) break;
  }
  return streak;
}

function extractMacros(macros) {
  if (!macros) return { protein: 0, carbs: 0, fats: 0 };
  return {
    protein:
      Number(
        macros.protein_g ??
        macros.protein ??
        macros.total_protein ??
        macros.proteinContent ??
        0
      ) || 0,
    carbs:
      Number(
        macros.total_carbohydrate_g ??
        macros.carbs ??
        macros.total_carbs ??
        macros.carbohydrates ??
        0
      ) || 0,
    fats:
      Number(
        macros.total_fat_g ??
        macros.fats ??
        macros.fat ??
        macros.total_fat ??
        0
      ) || 0,
  };
}

/* Poll helper (unchanged) */
async function pollForSummary(userId, dateIso, { interval = 1500, maxAttempts = 20 } = {}) {
  const statusUrl = (u, d) =>
    `https://caloreat.onrender.com/api/summarizeDaily/status?user_id=${encodeURIComponent(u)}&date=${encodeURIComponent(d)}`;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const res = await fetch(statusUrl(userId, dateIso));
      if (res.status === 200) {
        const json = await res.json();
        if (json && json.status === "complete" && json.summary) {
          return json.summary;
        }
      }
    } catch (err) {
      console.warn("pollForSummary fetch error (will retry):", err);
    }
    await new Promise((r) => setTimeout(r, interval + Math.floor(Math.random() * 500)));
    interval = Math.min(10000, Math.round(interval * 1.4));
  }
  throw new Error("Timed out waiting for summary");
}

/* ---------- small responsive hook ---------- */
function useWindowSize() {
  const [size, setSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });
  useEffect(() => {
    function onResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

/* ---------- CircularProgress component (kept, responsive tweak support) ---------- */
function CircularProgress({ percentage, size = 120, strokeWidth = 10, color = "#d4a574", label, value }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, percentage || 0));
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f5f0e8" strokeWidth={strokeWidth} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 600ms ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: Math.max(12, Math.round(size / 8)), fontWeight: 700 }}>{Math.round(pct)}%</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 8, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{value}</div>
      </div>
    </div>
  );
}

/* ---------- main component ---------- */
export default function ActivityGraph() {
  const uid = auth?.currentUser?.uid;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyTarget, setDailyTarget] = useState(2000);
  const [summaryData, setSummaryData] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const navigate = useNavigate();

  const { width } = useWindowSize();
  const isMobile = width < 768;
  const isSmall = width < 420;

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    let unsub = () => {};
    (async () => {
      try {
        const initial = await getDailyLogs(uid).catch(() => []);
        setLogs(initial);
      } catch (e) {
        console.error("initial logs failed", e);
      } finally {
        setLoading(false);
      }
    })();

    unsub = watchDailyLogs(uid, (rows) => {
      setLogs(rows);
    });

    return () => {
      try {
        unsub();
      } catch (e) {}
    };
  }, [uid]);

  const weeklyData = useMemo(() => aggregateWeek(logs), [logs]);
  const chartData = useMemo(() => weeklyData.map((d) => ({ ...d, target: dailyTarget })), [weeklyData, dailyTarget]);

  const weeklyAverage = useMemo(() => {
    const sum = weeklyData.reduce((s, r) => s + (Number(r.calories) || 0), 0);
    const count = weeklyData.length || 7;
    return Math.round(sum / count);
  }, [weeklyData]);

  const waterTotals = useMemo(() => {
    let ml = 0;
    logs.forEach((l) => {
      if (l.category === "water" && l.water_ml) ml += Number(l.water_ml) || 0;
      if (!l.water_ml && l.water && typeof l.water === "number") ml += Number(l.water) || 0;
    });
    return ml;
  }, [logs]);

  const streak = useMemo(() => computeStreak(logs), [logs]);

  const macroTotals = useMemo(() => {
    const totals = { protein: 0, carbs: 0, fats: 0 };
    logs.forEach((l) => {
      const m = extractMacros(l.macros);
      totals.protein += m.protein;
      totals.carbs += m.carbs;
      totals.fats += m.fats;
    });
    totals.protein = Math.round(totals.protein);
    totals.carbs = Math.round(totals.carbs);
    totals.fats = Math.round(totals.fats);
    return totals;
  }, [logs]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMeals = useMemo(
    () => logs.filter((l) => (l.date || (l.timestamp ? new Date(l.timestamp).toISOString().slice(0, 10) : "")) === todayKey),
    [logs, todayKey]
  );

  const pieData = [
    { name: "Protein", value: macroTotals.protein, color: "#d4a574" },
    { name: "Carbs", value: macroTotals.carbs, color: "#e8c9a0" },
    { name: "Fats", value: macroTotals.fats, color: "#c89865" },
  ];

  const formatWater = (ml) => {
    if (!ml) return "0 L";
    if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`;
    return `${ml} ml`;
  };

  const todayTotals = useMemo(() => {
    const totals = { calories: 0, protein: 0, carbs: 0, fats: 0 };

    logs.forEach((l) => {
      const key =
        l.date ||
        (l.timestamp ? new Date(l.timestamp).toISOString().slice(0, 10) : null);
      if (key !== todayKey || (l.category || "").toLowerCase() !== "meal") return;

      totals.calories += Number(
        l.calories ??
        l.macros?.calories_kcal ??
        l.macros?.energy_kcal ??
        0
      );

      const m = extractMacros(l.macros);
      totals.protein += m.protein;
      totals.carbs += m.carbs;
      totals.fats += m.fats;
    });

    ["protein", "carbs", "fats", "calories"].forEach(
      (k) => (totals[k] = Math.round(totals[k]))
    );

    return totals;
  }, [logs, todayKey]);

  const generateSummary = async () => {
    if (!uid) return alert("Please log in to generate summary.");
    const today = new Date().toISOString().slice(0, 10);

    const meals = logs.filter(l => {
      const key = l.date || (l.timestamp ? new Date(l.timestamp).toISOString().slice(0,10) : "");
      return key === today && (l.category || "meal") === "meal";
    });
    if (meals.length === 0) return alert("No meals logged today.");

    setIsSummarizing(true);
    setSummaryData(null);

    try {
      const formattedLogs = meals.map(l => ({
        item: l.item || l.name || "Meal",
        calories: Number(l.calories || 0),
        macros: {
          protein_g: Number(l?.macros?.protein_g ?? 0),
          total_carbohydrate_g: Number(l?.macros?.total_carbohydrate_g ?? l?.macros?.carbs_g ?? 0),
          total_fat_g: Number(l?.macros?.total_fat_g ?? l?.macros?.fats_g ?? 0),
        },
      }));

      const profile = await loadUserProfile(uid);

      const startRes = await fetch("https://caloreat.onrender.com/api/summarizeDaily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: uid, date: today, logs: formattedLogs, profile }),
      });
      if (!startRes.ok) throw new Error(await startRes.text());

      const summary = await pollForSummary(uid, today, { interval: 1200, maxAttempts: 25 });
      // server returns { parsed: { ... } } under summary
      const parsed = summary.parsed || summary;

      // put the actual coach text into `coachSummary`/`raw` so UI can render it
      const coachText = parsed?.coach_summary || parsed?.coachSummary || parsed?.summary_text || "";

      setSummaryData({
        date: today,
        structured: parsed,
        coachSummary: coachText,
        raw: coachText,
        generated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Summary generation failed:", e);
      alert(`Failed to generate summary: ${e.message}`);
    } finally {
      setIsSummarizing(false);
    }
  };


  /* ---------- responsive layout values ---------- */
  const pagePadding = isMobile ? 14 : 28;
  const sectionGap = isMobile ? 12 : 18;
  const cardRadius = 12;
  const chartHeight = isMobile ? 220 : 300;
  const circleSize = isSmall ? 110 : isMobile ? 130 : 140;

  /* ---------- layout ---------- */
  return (
    <div style={{ padding: pagePadding }}>
      {/* header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: sectionGap
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? 20 : 28 }}>Nutrition & Activity</h1>
          <div style={{ color: "#666", marginTop: 6, fontSize: isMobile ? 13 : 14 }}>Insights from your daily logs</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: isMobile ? 8 : 0 }}>
          <button onClick={() => navigate("/")} style={{ border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 14, cursor: 'pointer', background: "#eae4da", color: "#4b4033" }}>← Home</button>
          <button onClick={() => navigate("/dailylog")} style={{ border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 14, cursor: 'pointer', background: "#eae4da", color: "#4b4033" }}>Daily Logs →</button>
        </div>
      </div>

      {/* Today's Progress */}
      <div style={{ background: "#fff", borderRadius: cardRadius, padding: isMobile ? 14 : 20, boxShadow: "0 10px 30px rgba(0,0,0,0.04)", marginBottom: sectionGap }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 20, fontWeight: 700 }}>Today's Progress</h2>
            <div style={{ color: "#6b7280", marginTop: 6, fontSize: isMobile ? 13 : 14 }}>Summary of calories & macros for today</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '8px 12px', borderRadius: 999, border: 'none', background: "#fff3cd", color: "#a16207" }}>Day</button>
            <button style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid #eee', background: "#fff", color: "#374151" }}>Week</button>
            <button style={{ padding: '8px 12px', borderRadius: 999, border: '1px solid #eee', background: "#fff", color: "#374151" }}>Month</button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
          marginTop: 14,
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'space-around', flexWrap: 'wrap' }}>
            <CircularProgress
              percentage={dailyTarget ? (todayTotals.calories / dailyTarget) * 100 : 0}
              size={circleSize}
              strokeWidth={12}
              color="#d4a574"
              label="Calories"
              value={`${Math.round(todayTotals.calories)} / ${dailyTarget}`}
            />
            <CircularProgress
              percentage={100 ? (todayTotals.protein / 100) * 100 : 0}
              size={circleSize}
              strokeWidth={12}
              color="#c89865"
              label="Protein"
              value={`${Math.round(todayTotals.protein)}g / 100g`}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'space-around', flexWrap: 'wrap' }}>
            <CircularProgress
              percentage={200 ? (todayTotals.carbs / 200) * 100 : 0}
              size={circleSize}
              strokeWidth={12}
              color="#e8c9a0"
              label="Carbs"
              value={`${Math.round(todayTotals.carbs)}g / 200g`}
            />
            <CircularProgress
              percentage={80 ? (todayTotals.fats / 80) * 100 : 0}
              size={circleSize}
              strokeWidth={12}
              color="#b8956a"
              label="Fats"
              value={`${Math.round(todayTotals.fats)}g / 80g`}
            />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: sectionGap
      }}>
        <div style={{ background: "#fff", padding: 14, borderRadius: cardRadius, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
                <Flame size={18} color="#f97316" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Weekly Average</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{weeklyAverage} kcal</div>
              </div>
            </div>
            <TrendingUp color="#10b981" />
          </div>
          <div style={{ color: "#10b981", fontSize: 13, marginTop: 6 }}>Last 7 days</div>
        </div>

        <div style={{ background: "#fff", padding: 14, borderRadius: cardRadius, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, background: "#f0f9ff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
                <Droplet size={18} color="#0369a1" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Water Intake</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{formatWater(waterTotals)}</div>
              </div>
            </div>
            <Calendar color="#06b6d4" />
          </div>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6 }}>Total logged</div>
        </div>

        <div style={{ background: "#fff", padding: 14, borderRadius: cardRadius, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
                <Award size={18} color="#16a34a" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Streak</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{streak} days</div>
              </div>
            </div>
            <div style={{ color: "#6b7280" }}>Keep it up 👍</div>
          </div>
        </div>
      </div>

      {/* Main row: chart + optional macro summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
        gap: 12,
        marginBottom: sectionGap
      }}>
        <div style={{ background: "#fff", borderRadius: cardRadius, padding: 14, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Weekly Calorie Trend</h3>
          <div style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4efe8" />
                <XAxis dataKey="label" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Line type="monotone" dataKey="calories" stroke="#d4a574" strokeWidth={3} dot={{ r: isMobile ? 3 : 4 }} />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#e5e7eb"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Macro / summary column (collapses under chart on mobile) */}
        {/* <div style={{ background: "#fff", borderRadius: cardRadius, padding: 14, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Macro Distribution</h3>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexDirection: isMobile ? "row" : "column", justifyContent: "center" }}>
            <div style={{ width: isMobile ? 140 : 160, height: isMobile ? 140 : 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={40} outerRadius={isMobile ? 48 : 70} dataKey="value">
                    {pieData.map((entry, idx) => (
                      <Cell key={`c-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {pieData.map((p) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between", minWidth: 120 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ width: 10, height: 10, background: p.color, borderRadius: 3 }} />
                    <span style={{ color: "#555" }}>{p.name}</span>
                  </div>
                  <div style={{ fontWeight: 700 }}>{p.value}g</div>
                </div>
              ))}
            </div>
          </div>
        </div> */}
      </div>

      {/* AI Summary */}
            {/* AI Summary */}
            <div style={{ marginBottom: sectionGap, background: "#fff", padding: 14, borderRadius: cardRadius, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div>
            <h2 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#374151", margin: 0 }}>AI Daily Summary</h2>
            <p style={{ fontSize: isMobile ? 12 : 14, color: "#6b7280", margin: "4px 0 0 0" }}>
              Generate insights based on today's nutrition data
            </p>
          </div>

          <button
            onClick={generateSummary}
            disabled={isSummarizing || todayMeals.length === 0}
            style={{
              background: isSummarizing ? "#fcd34d" : "#fbbf24",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: isSummarizing || todayMeals.length === 0 ? "not-allowed" : "pointer",
              opacity: todayMeals.length === 0 ? 0.5 : 1,
            }}
          >
            <Sparkles size={14} />
            {isSummarizing ? "Generating..." : "Generate Summary"}
          </button>
        </div>

        {todayMeals.length === 0 && (
          <div style={{ textAlign: "center", padding: "14px", color: "#6b7280" }}>
            No meals logged today. Add some meals to generate a summary.
          </div>
        )}

        {/* show a loading / placeholder when summarizing */}
        {isSummarizing && (
          <div style={{ marginTop: 12, color: "#374151" }}>Generating summary…</div>
        )}

        {/* Render summary if available (use optional chaining to avoid null deref) */}
        {summaryData && summaryData.structured && (
          <div style={{ marginTop: 12 }}>
            {/* small stat cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))",
              gap: 10
            }}>
              {(() => {
                const p = summaryData.structured?.profile_used || {};
                const t = summaryData.structured?.totals || {};
                return (
                  <>
                    <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:8, padding:10 }}>
                      <div style={{ fontSize:12, color:"#6b7280" }}>BMR / TDEE</div>
                      <div style={{ fontWeight:700 }}>{Math.round(p.bmr||0)} / {Math.round(p.tdee||0)} kcal</div>
                    </div>
                    <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:8, padding:10 }}>
                      <div style={{ fontSize:12, color:"#6b7280" }}>Calories</div>
                      <div style={{ fontWeight:700 }}>{Math.round(t.calories||0)} / {Math.round(p.calorie_target||0)} kcal</div>
                      <div style={{ fontSize:12, color:"#6b7280" }}>Gap: {(t.calories||0)-(p.calorie_target||0)} kcal</div>
                    </div>
                    <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:8, padding:10 }}>
                      <div style={{ fontSize:12, color:"#6b7280" }}>Protein</div>
                      <div style={{ fontWeight:700 }}>{Math.round(t.protein_g||0)}g / {Math.round(p.protein_target_g||0)}g</div>
                    </div>
                    <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:8, padding:10 }}>
                      <div style={{ fontSize:12, color:"#6b7280" }}>Carbs</div>
                      <div style={{ fontWeight:700 }}>{Math.round(t.carbs_g||0)}g / {Math.round(p.carb_target_g||0)}g</div>
                    </div>
                    <div style={{ background:"#fff", border:"1px solid #eee", borderRadius:8, padding:10 }}>
                      <div style={{ fontSize:12, color:"#6b7280" }}>Fats</div>
                      <div style={{ fontWeight:700 }}>{Math.round(t.fats_g||0)}g / {Math.round(p.fat_target_g||0)}g</div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Top meals */}
            {!!summaryData.structured?.top_meals_by_cal?.length && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight:700, marginBottom:8 }}>Top Meals by Calories</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px,1fr))", gap:8 }}>
                  {summaryData.structured.top_meals_by_cal.map((m, i) => (
                    <div key={i} style={{ background:"#fff", border:"1px solid #eee", borderRadius:8, padding:8 }}>
                      <div style={{ fontWeight:600 }}>{m.item}</div>
                      <div style={{ fontSize:12, color:"#6b7280" }}>
                        {m.calories} kcal • P {m.protein_g ?? 0}g • C {m.carbs_g ?? 0}g • F {m.fats_g ?? 0}g
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations (safe access) */}
            {Array.isArray(summaryData.structured?.recommendations) && summaryData.structured.recommendations.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight:700, marginBottom:8 }}>Recommendations</div>
                <ul style={{ margin:0, paddingLeft:18 }}>
                  {summaryData.structured.recommendations.map((r, i) => <li key={i} style={{ marginBottom:6 }}>{r}</li>)}
                </ul>
              </div>
            )}

            {/* Coach summary (markdown-like) - use optional chaining */}
            {summaryData?.coachSummary || summaryData?.structured?.coach_summary ? (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "#ffffff", border: "1px solid #eee" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Coach Summary</div>
                <div
  style={{
    background: "#faf9f7",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #eee",
    marginTop: 12,
    color: "#1f2937",
    lineHeight: 1.55
  }}
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(
      marked.parse(summaryData?.coachSummary ?? summaryData?.structured?.coach_summary ?? "")
    )
  }}
></div>
              </div>
            ) : null}

            {/* Evidence IDs */}
            {Array.isArray(summaryData.structured?.ekb_ids) && summaryData.structured.ekb_ids.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Evidence IDs</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {summaryData.structured.ekb_ids.map((id) => (
                    <div key={id} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #eee", background: "#fff" }}>
                      {id}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Today's Meals */}
      <div style={{ background: "#fff", borderRadius: cardRadius, padding: 14, boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12 }}>Today's Meals</h3>

        {todayMeals.length === 0 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 12 }}>No meals logged today.</div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 12
          }}>
            {todayMeals.map((meal, idx) => {
              const title = meal.name || meal.item || meal.item_name || `Meal ${idx + 1}`;
              const calories = meal.calories ?? null;
              const macros = extractMacros(meal.macros);

              return (
                <div
                  key={meal.id ?? idx}
                  style={{
                    background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                    borderRadius: 12,
                    padding: 12,
                    border: "1px solid #fed7aa",
                    transition: "all 0.18s ease",
                    cursor: "pointer",
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#374151" }}>{title}</h4>
                      {meal.quantity > 1 && <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#6b7280" }}>{meal.quantity}× servings</p>}
                    </div>
                    <div style={{ fontSize: isSmall ? 20 : 28 }}>{meal.emoji || "🍽️"}</div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: "#374151", margin: 0 }}>
                      {calories !== null ? `${Math.round(calories)}` : "—"}
                      <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280" }}> kcal</span>
                    </p>
                  </div>

                  {macros && (macros.protein > 0 || macros.carbs > 0 || macros.fats > 0) && (
                    <div style={{ display: "flex", gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 70 }}>
                        <div style={{ color: "#6b7280" }}>Protein</div>
                        <div style={{ fontWeight: 600, color: "#374151" }}>{Math.round(macros.protein)}g</div>
                      </div>
                      <div style={{ minWidth: 70 }}>
                        <div style={{ color: "#6b7280" }}>Carbs</div>
                        <div style={{ fontWeight: 600, color: "#374151" }}>{Math.round(macros.carbs)}g</div>
                      </div>
                      <div style={{ minWidth: 70 }}>
                        <div style={{ color: "#6b7280" }}>Fats</div>
                        <div style={{ fontWeight: 600, color: "#374151" }}>{Math.round(macros.fats)}g</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* optional AI display */}
      {summaryData && summaryData.structured && (
        <div style={{ marginTop: 14 }}>
          <AISummaryDisplay summary={summaryData.structured} />
        </div>
      )}
    </div>
  );
}
