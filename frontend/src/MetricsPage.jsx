// src/MetricsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import PageTransition from "./components/PageTransition";

/** ───────────────────────────────────────────────────────────
 * Reference Daily Values (FDA-style; general population, 2,000 kcal)
 * Notes:
 * - %DV is a quick comparison tool, not a personalized prescription.
 * - We show these to help users interpret totals, while your "Targets"
 *   logic (TDEE/goal) personalizes macros elsewhere.
 * - Keep labels concise for UI; long explanations live in sections below.
 * ─────────────────────────────────────────────────────────── */
const DV = {
  calories_kcal: { label: "Calories", dv: 2000, unit: "kcal" },
  protein_g: { label: "Protein", dv: 50, unit: "g" },
  total_carbohydrate_g: { label: "Carbohydrates", dv: 275, unit: "g" },
  dietary_fiber_g: { label: "Dietary fiber", dv: 28, unit: "g" },
  total_fat_g: { label: "Total fat", dv: 78, unit: "g" },
  saturated_fat_g: { label: "Saturated fat", dv: 20, unit: "g" },
  sodium_mg: { label: "Sodium", dv: 2300, unit: "mg" },
  added_sugars_g: { label: "Added sugars (limit)", dv: 50, unit: "g" }, // guidance DV
  potassium_mg: { label: "Potassium", dv: 4700, unit: "mg" },
  calcium_mg: { label: "Calcium", dv: 1300, unit: "mg" },
  iron_mg: { label: "Iron", dv: 18, unit: "mg" },
  vitamin_c_mg: { label: "Vitamin C", dv: 90, unit: "mg" },
  vitamin_d_mcg: { label: "Vitamin D", dv: 20, unit: "mcg" },
};

/** Friendly tags for quick-scan cards */
const TAGS = {
  protein_g: "muscle • satiety",
  total_carbohydrate_g: "energy • glycogen",
  dietary_fiber_g: "gut • fullness",
  total_fat_g: "hormones • satiety",
  saturated_fat_g: "limit",
  sodium_mg: "watch",
  added_sugars_g: "limit",
};

/** Section navigation */
const SECTIONS = [
  { id: "intro", icon: "📘", label: "Overview" },
  { id: "dv", icon: "📊", label: "%DV Guide" },
  { id: "how", icon: "🥣", label: "How We Calculate" },
  { id: "macros", icon: "⚖️", label: "Macros Deep-Dive" },
  { id: "micros", icon: "🧪", label: "Micronutrients" },
  { id: "quality", icon: "🔍", label: "Quality & Limits" },
  { id: "faq", icon: "❓", label: "FAQ" },
];

/** Small UI atoms */
function Glass({ children, style }) {
  return (
    <div
      className="glass-card"
      style={{
        borderRadius: 16,
        padding: 16,
        background: "rgba(255,255,255,0.9)",
        boxShadow: "0 10px 30px rgba(16,24,40,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Gauge({ label, value, unit, dv, note }) {
  const pct = dv ? Math.max(0, Math.round((value / dv) * 100)) : null;
  return (
    <div style={{ border: "1px solid #ecdcc4", borderRadius: 12, padding: 14, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong style={{ color: "#4b4033" }}>{label}</strong>
        <div style={{ color: "#6a5a45", fontWeight: 700 }}>
          {value ?? 0} {unit}{dv ? ` • ${Math.min(999, pct)}% DV` : ""}
        </div>
      </div>
      {dv && (
        <div style={{ height: 8, marginTop: 8, borderRadius: 999, background: "#f1e7d2", overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(100, pct)}%`,
              height: "100%",
              background: "linear-gradient(90deg,#ffa94d,#ff7b54)",
            }}
          />
        </div>
      )}
      {note && <div style={{ marginTop: 6, fontSize: 12, color: "#7a6a58" }}>{note}</div>}
    </div>
  );
}

function KeyLine({ k, v, highlight }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid #f1ede4",
      }}
    >
      <div style={{ color: "#5b5146" }}>{k}</div>
      <div style={{ color: highlight ? "#7a3e00" : "#5b5146", fontWeight: 700 }}>{v}</div>
    </div>
  );
}

/** Main component */
export default function MetricsPage() {
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const onScroll = () => {
      const offset = window.scrollY + 120;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.offsetTop <= offset) setActive(s.id);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  /** Static examples (for visual explanation only) */
  const exampleMeal = useMemo(
    () => ({
      name: "Chicken biryani (500g) + raita (100g)",
      macros: {
        calories_kcal: 820,
        protein_g: 38,
        total_carbohydrate_g: 92,
        total_fat_g: 32,
        dietary_fiber_g: 6,
        sodium_mg: 1100,
        added_sugars_g: 4,
      },
    }),
    []
  );

  return (
    <PageTransition>
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(180deg,#fffaf3 0%, #fff2e2 90%)",
          padding: "22px 24px",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#4b4033" }}>
                Nutrition Metrics — How to read your numbers 🍽️
              </h1>
              <div style={{ color: "#7a6a58", marginTop: 6 }}>
                A practical guide to macros, micronutrients, %DV, and how we compute everything in your dashboard.
              </div>
            </div>
            <Link to="/app" style={{ textDecoration: "none" }}>
              <button
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "#fffaf2",
                  border: "1px solid #eadcc4",
                  fontWeight: 600,
                  color: "#4b4033",
                }}
              >
                ← Back to app
              </button>
            </Link>
          </div>

          {/* Sticky section pills */}
          <div
            style={{
              position: "sticky",
              top: 76,
              zIndex: 10,
              padding: 10,
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(8px)",
              borderRadius: 12,
              boxShadow: "0 6px 20px rgba(0,0,0,0.06)",
              marginBottom: 20,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: active === s.id ? "2px solid #d6b78e" : "1px solid #e6d9c4",
                  background: active === s.id ? "#fff2d2" : "#ffffff",
                  fontWeight: active === s.id ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* ───────────────────────────────── OVERVIEW ───────────────────────────────── */}
          <section id="intro" style={{ scrollMarginTop: 88 }}>
            <Glass>
              <h2 style={{ marginTop: 0 }}>What you’ll learn in this page</h2>
              <div style={{ color: "#5b5146" }}>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                  <li>What **%DV** means and how to quickly judge “low” vs “high”.</li>
                  <li>How we calculate macros (calories, protein, carbs, fat) and scale portions.</li>
                  <li>How we treat **micronutrients** (vitamins & minerals) when available.</li>
                  <li>Why some items show estimates (heuristics) and how to override them.</li>
                </ul>
              </div>
            </Glass>
          </section>

          {/* ─────────────────────────────── %DV GUIDE ─────────────────────────────── */}
          <section id="dv" style={{ marginTop: 16, scrollMarginTop: 88 }}>
            <Glass>
              <h2 style={{ marginTop: 0 }}>% Daily Value (%DV) — quick read 📊</h2>
              <p style={{ color: "#5b5146", marginTop: 6 }}>
                %DV compares your meal against a general daily target (2,000 kcal). Use it to **spot extremes**:
                <strong> ≤5% = low</strong>, <strong>≥20% = high</strong>. Personalized needs can be different — your dashboard
                targets adjust calories/macros for cut/maintain/bulk.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                {[
                  ["Protein", "Higher %DV often helps satiety and muscle retention."],
                  ["Fiber", "Higher %DV aids gut health and steady energy."],
                  ["Sodium", "Aim for lower %DV, especially for restaurant meals."],
                  ["Added sugars", "Keep %DV modest; whole foods first."],
                ].map(([title, tip]) => (
                  <div key={title} style={{ border: "1px solid #ecdcc4", borderRadius: 12, padding: 12, background: "#fff" }}>
                    <strong style={{ color: "#4b4033" }}>{title}</strong>
                    <div style={{ fontSize: 13, color: "#6a5a45", marginTop: 6 }}>{tip}</div>
                  </div>
                ))}
              </div>

              {/* Mini example block */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, color: "#4b4033", marginBottom: 8 }}>Example meal</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  {Object.entries(exampleMeal.macros).map(([k, val]) => {
                    const meta = DV[k] || {};
                    return (
                      <Gauge
                        key={k}
                        label={meta.label || k.replace(/_/g, " ")}
                        value={val}
                        unit={meta.unit || (/_mg$/.test(k) ? "mg" : /_mcg$/.test(k) ? "mcg" : "g")}
                        dv={meta.dv}
                        note={TAGS[k]}
                      />
                    );
                  })}
                </div>
              </div>
            </Glass>
          </section>

          {/* ───────────────────────────── HOW WE CALCULATE ─────────────────────────── */}
          <section id="how" style={{ marginTop: 16, scrollMarginTop: 88 }}>
            <Glass>
              <h2 style={{ marginTop: 0 }}>How we calculate your numbers 🥣</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>1) Local Food DB first</strong>
                  <p style={{ margin: "8px 0", color: "#5b5146" }}>
                    We search a curated local database (per-100g reference). If we find a match (exact or fuzzy),
                    we scale nutrients by **quantity × portion multiplier**.
                  </p>
                  <KeyLine k="Example" v={`"chicken biryani (500g)" → per-100g × 5`} />
                </div>

                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>2) Fuzzy match & synonyms</strong>
                  <p style={{ margin: "8px 0", color: "#5b5146" }}>
                    If the exact item isn’t found, we try close names (token set ratio). We also include small
                    domain fallbacks (e.g., biryani ↔ pulao) to keep estimates practical.
                  </p>
                  <KeyLine k="Tip" v="Edit any wrong match — your override wins." />
                </div>

                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>3) Heuristic backup</strong>
                  <p style={{ margin: "8px 0", color: "#5b5146" }}>
                    When no match exists, we use cuisine-aware defaults (e.g., salad lower kcal; pizza higher) and
                    macro splits typical for the dish category.
                  </p>
                  <KeyLine k="Transparency" v="Shown as “heuristic” in provenance" />
                </div>

                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>4) Energy math & rounding</strong>
                  <p style={{ margin: "8px 0", color: "#5b5146" }}>
                    If carbs are missing but kcal, protein, fat exist, we back-calculate carbs via:
                  </p>
                  <code style={{ fontSize: 12, color: "#6a5a45" }}>
                    carbs ≈ (kcal − 4·protein − 9·fat) / 4
                  </code>
                  <p style={{ margin: "8px 0", color: "#5b5146" }}>
                    We round to one decimal for display, but store more precision internally.
                  </p>
                </div>
              </div>
            </Glass>
          </section>

          {/* ──────────────────────────────── MACROS ──────────────────────────────── */}
          <section id="macros" style={{ marginTop: 16, scrollMarginTop: 88 }}>
            <Glass>
              <h2 style={{ marginTop: 0 }}>Macros, targets & interpretation ⚖️</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 12,
                  marginTop: 6,
                }}
              >
                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>Protein (g)</strong>
                  <ul style={{ margin: "8px 0", paddingLeft: 18, color: "#5b5146", lineHeight: 1.6 }}>
                    <li>DV is 50 g/day (general). Your target adapts to **weight & goal**.</li>
                    <li>Higher protein days often improve satiety and lean mass retention.</li>
                    <li>Good sources: eggs, paneer, pulses, yogurt, fish/chicken.</li>
                  </ul>
                </div>

                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>Carbohydrates (g)</strong>
                  <ul style={{ margin: "8px 0", paddingLeft: 18, color: "#5b5146", lineHeight: 1.6 }}>
                    <li>Primary energy. Match intake to training volume and hunger.</li>
                    <li>Emphasize whole grains, fruits, vegetables, legumes.</li>
                    <li>Use fiber as a compass (&gt;= 28 g/day is a solid baseline).</li>
                  </ul>
                </div>

                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>Fat (g)</strong>
                  <ul style={{ margin: "8px 0", paddingLeft: 18, color: "#5b5146", lineHeight: 1.6 }}>
                    <li>Supports hormones & absorption of fat-soluble vitamins.</li>
                    <li>Prefer unsaturated fats (nuts, seeds, olive oil) over saturated.</li>
                    <li>Limit saturated fat; DV for saturated fat is 20 g.</li>
                  </ul>
                </div>
              </div>

              <div style={{ marginTop: 10, color: "#7a6a58", fontSize: 13 }}>
                Your **Analytics** page personalizes macro targets via BMR × activity (TDEE) and applies cut/maintain/bulk adjustments.
              </div>
            </Glass>
          </section>

          {/* ─────────────────────────────── MICROS ─────────────────────────────── */}
          <section id="micros" style={{ marginTop: 16, scrollMarginTop: 88 }}>
            <Glass>
              <h2 style={{ marginTop: 0 }}>Micronutrients (when available) 🧪</h2>
              <p style={{ color: "#5b5146", marginTop: 6 }}>
                We pass through vitamins & minerals from the matched item when the data exists (per 100g then scaled).
                Labels for restaurant foods often omit micros — so totals may be incomplete.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                {[
                  ["Sodium (mg)", "Aim to keep in check; restaurant dishes are commonly high."],
                  ["Potassium (mg)", "Often under-consumed; fruits/veg/legumes help."],
                  ["Calcium (mg)", "Bone health; dairy/curd/paneer/fortified options."],
                  ["Iron (mg)", "Combine with vitamin C for better absorption."],
                  ["Vitamin C (mg)", "Immunity & iron uptake; fruits/veg friendly."],
                  ["Vitamin D (mcg)", "Sun exposure + fortified foods; many diets are low."],
                ].map(([label, tip]) => (
                  <div key={label} style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                    <strong>{label}</strong>
                    <div style={{ fontSize: 13, color: "#6a5a45", marginTop: 6 }}>{tip}</div>
                  </div>
                ))}
              </div>

              {/* Mini DV table */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 700, color: "#4b4033", marginBottom: 8 }}>Selected Daily Values</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                  }}
                >
                  {["sodium_mg", "potassium_mg", "calcium_mg", "iron_mg", "vitamin_c_mg", "vitamin_d_mcg"].map((key) => {
                    const meta = DV[key];
                    return (
                      <div key={key} style={{ border: "1px solid #ecdcc4", borderRadius: 12, padding: 12, background: "#fff" }}>
                        <div style={{ color: "#4b4033", fontWeight: 700 }}>{meta.label}</div>
                        <div style={{ color: "#6a5a45", marginTop: 4 }}>
                          {meta.dv} {meta.unit} = 100% DV
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Glass>
          </section>

          {/* ─────────────────────────── QUALITY & LIMITS ─────────────────────────── */}
          <section id="quality" style={{ marginTop: 16, scrollMarginTop: 88 }}>
            <Glass>
              <h2 style={{ marginTop: 0 }}>Data quality, limits & overrides 🔍</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>Provenance shown per item</strong>
                  <ul style={{ margin: "8px 0", paddingLeft: 18, color: "#5b5146", lineHeight: 1.6 }}>
                    <li><b>local_match</b>: from local DB (scaled).</li>
                    <li><b>heuristic</b>: category estimate where no DB entry existed.</li>
                    <li>User edits always override calculations.</li>
                  </ul>
                </div>

                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>Rounding & small errors</strong>
                  <ul style={{ margin: "8px 0", paddingLeft: 18, color: "#5b5146", lineHeight: 1.6 }}>
                    <li>Display rounds to 1 decimal; internal math keeps more precision.</li>
                    <li>Back-computing carbs introduces small ± errors; that’s expected.</li>
                  </ul>
                </div>

                <div style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                  <strong>Limits & caveats</strong>
                  <ul style={{ margin: "8px 0", paddingLeft: 18, color: "#5b5146", lineHeight: 1.6 }}>
                    <li>Restaurant recipes vary; treat numbers as estimates.</li>
                    <li>Micronutrient data may be incomplete for many dishes.</li>
                    <li>OCR text can be messy — confirm items/quantities.</li>
                  </ul>
                </div>
              </div>
            </Glass>
          </section>

          {/* ────────────────────────────────── FAQ ───────────────────────────────── */}
          <section id="faq" style={{ marginTop: 16, scrollMarginTop: 88 }}>
            <Glass>
              <h2 style={{ marginTop: 0 }}>FAQ ❓</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                {[
                  [
                    "Why does sodium look high for some meals?",
                    "Restaurants often use generous salt + packaged ingredients. If you’re sensitive to sodium, choose more home-cooked options, ask for less salt, and balance high-sodium meals with low-sodium meals the rest of the day.",
                  ],
                  [
                    "Are calories exact?",
                    "They’re best-effort estimates. For matched items, they’re scaled precisely from the source entry. For heuristics or back-computed carbs, consider a ±10% swing as normal.",
                  ],
                  [
                    "What if the food name doesn’t match?",
                    "Edit the item name or calories — your override is respected. You can also log by weight or pieces to get better scaling.",
                  ],
                  [
                    "How do I use %DV day-to-day?",
                    "Use it as a high/low flag. For protein/fiber, higher %DV is generally good; for sodium/added sugars/sat fat, watch high %DVs.",
                  ],
                ].map(([q, a]) => (
                  <div key={q} style={{ border: "1px solid #f0e4c9", borderRadius: 12, padding: 12, background: "#fff" }}>
                    <div style={{ fontWeight: 700, color: "#4b4033" }}>{q}</div>
                    <div style={{ marginTop: 6, color: "#5b5146" }}>{a}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, color: "#7a6a58", fontSize: 12 }}>
                This guide is educational and not medical advice.
              </div>
            </Glass>
          </section>

          {/* Footer */}
          <div style={{ textAlign: "center", marginTop: 26, color: "#7a6a58" }}>
            <small>© {new Date().getFullYear()} Your App — Nutrition guide</small>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
