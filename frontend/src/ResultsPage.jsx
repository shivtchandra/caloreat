// src/ResultsPage.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import StickerField from "./StickerField.jsx";
import "./App.css";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";

const safeEntries = (obj) => (obj && typeof obj === "object" ? Object.entries(obj) : []);
const safeArray = (arr) => (Array.isArray(arr) ? arr : []);

function Badge({ category, label }) {
  const base = { padding: "6px 10px", borderRadius: 14, fontSize: 12, display: "inline-block" };
  const style =
    category === "high"
      ? { background: "#dff8e6", color: "#0b6a32" }
      : category === "moderate"
      ? { background: "#fff7db", color: "#6d5800" }
      : category === "low"
      ? { background: "#ffecec", color: "#7a231f" }
      : { background: "#eee", color: "#333" };
  return <span style={{ ...base, ...style }}>{label}</span>;
}

const pctToLabel = (pct) => {
  if (pct === null || pct === undefined) return { label: "No data", category: "unknown" };
  if (pct >= 20) return { label: "High", category: "high" };
  if (pct >= 5) return { label: "Moderate", category: "moderate" };
  return { label: "Low", category: "low" };
};

const round = (v, digits = 1) => {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  if (Math.abs(n) >= 100) return Math.round(n); // large numbers show as ints
  return Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits);
};

export default function ResultsPage() {
  const location = useLocation();
  const [combined, setCombined] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningAI, setRunningAI] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Tab state (declare hooks in stable order)
  const TABS = ["Final Macros", "Micronutrients", "% Daily Values"];
  const [activeTab, setActiveTab] = useState(TABS[0]);

  useEffect(() => {
    let payload = location.state || null;
    if (!payload) {
      try {
        const raw = sessionStorage.getItem("food_results");
        if (raw) payload = JSON.parse(raw);
      } catch (e) {
        console.warn("Failed to parse sessionStorage food_results", e);
      }
    }

    if (payload) {
      const out = {
        final: payload.final || payload,
        aiResp: payload.aiResp || payload.ai_response || null,
        placeInfo: payload.placeInfo || payload.place_info || null,
        confirmed: payload.confirmed || payload.items || []
      };
      setCombined(out);
    } else {
      setCombined(null);
    }
    setLoading(false);
  }, [location.state]);

  if (loading) return <div className="loader">Loading results…</div>;

  // No data view
  if (!combined || !combined.final) {
    return (
      <div className="results-page">
        <div className="sticky-stickers" aria-hidden="true">
          <StickerField count={12} stickers={["🥗","🍎","🥑","🍪","🥕","🍓","🍌","🍞","💪","🍇","🥛","🍳"]} />
        </div>
        <main className="results-main centered">
          <header className="results-header card">
            <h1>Nutrition Summary</h1>
            <Link to="/" className="back-link">← Back to Upload</Link>
          </header>

          <div className="center-empty card">
            <p>No results available — please upload and confirm items first.</p>
            <Link to="/">Go back to upload</Link>
          </div>
        </main>
      </div>
    );
  }

  const final = combined.final || {};
  const micros = combined.final || {}; // analyze_items returns totals inside final
  const aiResp = combined.aiResp;
  const placeInfo = combined.placeInfo;
  const confirmed = combined.confirmed || [];

  // helper getters
  const macros = final.macros_summary || final.summary || {};
  const micronutrientTotals = micros.micronutrient_totals || {};
  const percentDv = micros.percent_dv_friendly || micros.percent_dv || {};
  const topLacking = final.top_lacking || [];

  const fmt = (v, digits = 0) => {
    if (v === null || v === undefined) return "—";
    const r = round(v, digits);
    return r === null ? "—" : r;
  };

  // Run AI detection on-demand (calls /restaurant/identify_ai and then Places)
  const runAIDetection = async () => {
    setAiError(null);
    setRunningAI(true);
    try {
      const mapping = (final.mapping_result || final.mapping || {}).mapping_result || final.mapping_result || final;
      const ocrText =
        (final.mapping_result && (final.mapping_result.ocr_text || final.mapping_result.ocr_text_preview)) ||
        (final.mapping && (final.mapping.ocr_text || final.mapping.ocr_text_preview)) ||
        (mapping && (mapping.ocr_text || mapping.ocr_text_preview)) ||
        (sessionStorage.getItem("ocr_text") ? sessionStorage.getItem("ocr_text") : null) ||
        "";

      if (!ocrText || ocrText.trim().length < 5) {
        setAiError("No OCR text available to analyze. Re-run upload with OCR present.");
        setRunningAI(false);
        return;
      }

      const aiRespRaw = await fetch("http://127.0.0.1:8000/restaurant/identify_ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocr_text: ocrText })
      }).then((r) => r.json());

      let placeResp = null;
      const candidateName = aiRespRaw?.restaurant || (Array.isArray(aiRespRaw?.restaurant_candidates) && aiRespRaw.restaurant_candidates[0]);
      if (candidateName) {
        placeResp = await fetch(`http://127.0.0.1:8000/restaurant/get_restaurant_info?q=${encodeURIComponent(candidateName)}`)
          .then((r) => r.json()).catch(() => null);
      }

      const newCombined = { ...combined, aiResp: aiRespRaw, placeInfo: placeResp };
      setCombined(newCombined);
      try {
        sessionStorage.setItem("food_results", JSON.stringify({
          final: newCombined.final,
          aiResp: aiRespRaw,
          placeInfo: placeResp,
          confirmed: confirmed
        }));
      } catch (e) {
        console.warn("Failed to persist results to sessionStorage", e);
      }
    } catch (e) {
      console.error("runAIDetection failed", e);
      setAiError(String(e));
    } finally {
      setRunningAI(false);
    }
  };

  // Render %DV grid
  const renderPercentDv = () => {
    const items = safeEntries(percentDv).map(([k, obj]) => {
      const pct = obj && typeof obj === "object" && obj.pct !== undefined ? obj.pct : (typeof obj === "number" ? obj : null);
      const friendly = pctToLabel(pct);
      return { key: k, pct, friendly };
    });
    if (!items.length) return <div className="muted">No %DV information available.</div>;
    return (
      <div className="percent-dv">
        {items.map((it) => (
          <div key={it.key} className="percent-row">
            <div className="percent-left">
              <strong>{it.key.replace(/_/g, " ")}</strong>
              <div className="percent-value">{it.pct === null ? "No data" : `${round(it.pct, 1)}% DV`}</div>
            </div>
            <div className="percent-right"><Badge category={it.friendly.category} label={it.friendly.label} /></div>
          </div>
        ))}
        <div className="legend"><strong>Legend:</strong> High ≥20% — Moderate 5–19% — Low &lt;5%</div>
      </div>
    );
  };

  // small motion variants for panels
  const panelVariants = {
    enter: { opacity: 0, y: 6 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 }
  };

  return (
    <div className="results-page">
      <div className="sticky-stickers" aria-hidden="true">
        <StickerField count={12} stickers={["🥗","🍎","🥑","🍪","🥕","🍓","🍌","🍞","💪","🍇","🥛","🍳"]} />
      </div>

      <main className="results-main centered">
        <header className="results-header card">
          <h1>Nutrition Summary</h1>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link to="/" className="back-link">← Back to Upload</Link>
            {/* <button className="btn btn-ghost" onClick={runAIDetection} disabled={runningAI}>
              {runningAI ? "Running AI…" : "Run AI detection"}
            </button> */}
          </div>
        </header>

        <div className="results-card card" style={{ marginTop: 18, maxWidth: 1100 }}>
          {/* Tabs header w/ shared layout underline using LayoutGroup */}
          <div style={{ display: "flex",marginLeft:200, justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <LayoutGroup>
              <div style={{ display: "flex", gap: 64, alignItems: "center" }}>
                {TABS.map((t) => {
                  const isActive = t === activeTab;
                  return (
                    <div key={t} style={{ position: "relative", cursor: "pointer", padding: "6px 4px" }}
                         onClick={() => setActiveTab(t)}>
                      <div style={{ fontSize: 18, fontWeight: isActive ? 700 : 500, color: isActive ? "#0b2b1b" : "#222" }}>
                        {t}
                      </div>
                      {isActive && (
                        <motion.div
                          layoutId="tab-underline"
                          initial={false}
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: -8,
                            height: 6,
                            borderRadius: 999,
                            background: "linear-gradient(90deg,#eaf7ee,#d7f0e0)",
                            boxShadow: "0 6px 12px rgba(25,50,30,0.06)"
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginLeft: "auto", color: "#888", fontSize: 13 }}>
                <small>Tap tabs to switch view</small>
              </div>
            </LayoutGroup>
          </div>

          <div style={{ display: "grid",marginLeft:300, gridTemplateColumns: "1fr 460px", gap: 28, maxWidth: 900}}>
            <div>
              {/* Animated tab panels */}
              <AnimatePresence mode="wait" initial={false}>
                {activeTab === "Final Macros" && (
                  <motion.div
                    key="final"
                    variants={panelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.28 }}
                  >
                    <h1>Final Macros</h1>
                    <table className="macros-table">
                      <tbody>
                        <tr><td>Calories</td><td>{fmt(macros.total_calories ?? macros.calories_kcal)}</td></tr>
                        <tr><td>Protein (g)</td><td>{fmt(macros.total_protein, 1)}</td></tr>
                        <tr><td>Carbs (g)</td><td>{fmt(macros.total_carbs ?? macros.total_carbohydrate_g, 1)}</td></tr>
                        <tr><td>Fat (g)</td><td>{fmt(macros.total_fat, 1)}</td></tr>
                        <tr><td>Fiber (g)</td><td>{fmt(macros.total_fiber ?? macros.dietary_fiber_g, 1)}</td></tr>
                        <tr><td>Sugar (g)</td><td>{fmt(macros.total_sugar ?? macros.sugars_g, 1)}</td></tr>
                      </tbody>
                    </table>

                    <div style={{ marginTop: 18 }}>
                      <h3>Per-item provenance</h3>
                      {Array.isArray(final.per_item_provenance) && final.per_item_provenance.length > 0 ? (
                        final.per_item_provenance.map((p, i) => (
                          <div key={i} className="prov-row">
                            <div className="prov-title">{p.mapped_to || p.raw || p.raw_text}</div>
                            <div className="prov-meta">qty: {p.quantity ?? p.qty ?? 1}{p.portion_mult ? ` • portion: ${p.portion_mult}` : ""} • {p.provenance?.source || "unknown"}</div>
                            {p.provenance && p.provenance.fdcId && <div className="prov-meta">fdc: {p.provenance.fdcId}</div>}
                          </div>
                        ))
                      ) : <div className="muted">No per-item provenance returned.</div>}
                    </div>

                    <div style={{ marginTop: 18 }}>
                      <h3>Top lacking nutrients</h3>
                      {Array.isArray(topLacking) && topLacking.length > 0 ? (
                        <ol>{topLacking.map((pair, idx) => {
                          if (!pair) return null;
                          const [k, v] = pair;
                          return <li key={idx}>{k.replace(/_/g, " ")}: {fmt(v)}% DV</li>;
                        })}</ol>
                      ) : <div className="muted">No top-lacking nutrients available.</div>}
                    </div>
                  </motion.div>
                )}

                {activeTab === "Micronutrients" && (
                  <motion.div
                    key="micro"
                    variants={panelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.28 }}
                  >
                    <h2>Micronutrients</h2>
                    {safeEntries(micronutrientTotals).length > 0 ? (
                      <table className="nutrients-table compact">
                        <thead><tr><th>Nutrient</th><th>Amount</th></tr></thead>
                        <tbody>
                          {safeEntries(micronutrientTotals).map(([k, v]) => (
                            <tr key={k}><td>{k.replace(/_/g, " ")}</td><td>{fmt(v, 1)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <div className="muted">No micronutrient totals available.</div>}
                  </motion.div>
                )}

                {activeTab === "% Daily Values" && (
                  <motion.div
                    key="pdv"
                    variants={panelVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.28 }}
                  >
                    <h2>% Daily Values</h2>
                    {renderPercentDv()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              {/* <section>
                <h2>AI Detection</h2>
                {aiError && <div className="error">{aiError}</div>}
                {aiResp ? (
                  <div>
                    <div><strong>Restaurant:</strong> {aiResp.restaurant || "—"}</div>
                    {Array.isArray(aiResp.restaurant_candidates) && aiResp.restaurant_candidates.length > 0 && (
                      <div style={{ marginTop: 6 }}><strong>Candidates:</strong> {aiResp.restaurant_candidates.join(", ")}</div>
                    )}
                    {Array.isArray(aiResp.dishes) && aiResp.dishes.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <strong>Detected dishes:</strong>
                        <ul>
                          {aiResp.dishes.map((d, i) => <li key={i}>{d.name}{d.quantity ? ` × ${d.quantity}` : ""}{d.confidence ? ` (${Math.round(d.confidence*100)}%)` : ""}</li>)}
                        </ul>
                      </div>
                    )}
                    {aiResp.error_parsing && <pre className="muted small" style={{ marginTop: 8 }}>{aiResp.raw_text || JSON.stringify(aiResp)}</pre>}
                  </div>
                ) : <div className="muted">No AI detection performed.</div>}
              </section> */}
{/* 
              <section style={{ marginTop: 18 }}>
                <h2>Places / Enrichment</h2>
                {placeInfo && Array.isArray(placeInfo.candidates) && placeInfo.candidates.length > 0 ? (
                  placeInfo.candidates.map((p, i) => (
                    <div key={i} className="place-row">
                      <div className="place-name">{p.name}</div>
                      <div className="muted small">{p.address}</div>
                      <div className="muted small">rating: {p.rating ?? "—"} ({p.user_ratings_total ?? 0})</div>
                    </div>
                  ))
                ) : <div className="muted">No place info available.</div>}
              </section> */}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
