import React from "react";
import PropTypes from "prop-types";

// Helper: safe number formatting
const formatNumber = (num, decimals = 1) => {
  if (num === null || num === undefined || Number.isNaN(Number(num))) return "N/A";
  return Number(num).toFixed(decimals);
};

// Helper: try multiple possible keys for the same nutrient
const pickKey = (obj = {}, keys = []) => {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null) {
      return obj[k];
    }
  }
  return undefined;
};

// Normalize a macros object into canonical fields: protein_g, carbs_g, fat_g
const normalizeMacros = (macros = {}) => {
  if (!macros || typeof macros !== "object") return { protein_g: 0, carbs_g: 0, fat_g: 0 };

  const protein = pickKey(macros, [
    "protein_g",
    "protein",
    "Protein",
    "protein (g)",
  ]);

  const carbs = pickKey(macros, [
    "total_carbohydrate_g",
    "total_carbohydrate",
    "total_carbs",
    "carbs",
    "carbohydrate_g",
    "carbs_g",
  ]);

  const fat = pickKey(macros, [
    "total_lipid_(fat)_g",
    "total_fat_g",
    "total_fat",
    "fat_g",
    "fats",
  ]);

  return {
    protein_g: protein ? Number(protein) : 0,
    carbs_g: carbs ? Number(carbs) : 0,
    fat_g: fat ? Number(fat) : 0,
  };
};

export default function AISummaryDisplay({ summary }) {
  // DEBUG: Log what we received
  console.log("=== AISummaryDisplay received ===");
  console.log("Type:", typeof summary);
  console.log("Full summary:", JSON.stringify(summary, null, 2));
  
  if (!summary) {
    return (
      <div style={{ padding: 20, background: "#ffebee", borderRadius: 8 }}>
        <p><strong>⚠️ No summary data received</strong></p>
        <p>The summary prop is null or undefined.</p>
      </div>
    );
  }

  // If summary is a plain string, render it raw
  if (typeof summary === "string") {
    return (
      <div style={{ padding: 20, background: "#fff8e1", borderRadius: 8 }}>
        <h3>📝 Raw Summary (String)</h3>
        <p style={{ whiteSpace: "pre-line" }}>{summary}</p>
      </div>
    );
  }

  // Unwrap nested structures
  const s = summary.parsed ?? summary.summary ?? summary;
  
  console.log("Unwrapped 's':", s);

  // Check if parse failed
  if (s.error === "parse_failed") {
    return (
      <div style={{ padding: 20, background: "#ffebee", borderRadius: 8 }}>
        <h3>⚠️ Summary Parse Failed</h3>
        <p>The AI returned text that couldn't be parsed as JSON.</p>
        <details>
          <summary>View raw AI text</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
            {s.raw_ai_text || s.raw_text || "No raw text available"}
          </pre>
        </details>
      </div>
    );
  }

  const summary_date = s.summary_date ?? s.date ?? s.generated_at;
  const totals = s.totals ?? {};
  const meal_cards = s.meal_cards ?? s.meals ?? [];
  const insights = s.insights ?? { wins: [], improvements: [], quick_tips: [] };
  const percent_dv = s.percent_dv ?? {};

  const dateStr = summary_date ? new Date(summary_date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric"
  }) : null;

  // Try to read canonical totals with robust key checks
  const totalCalories = pickKey(totals, ["calories_kcal", "calories", "total_calories"]);
  const totalProtein = pickKey(totals, ["protein_g", "protein", "total_protein"]);
  const totalCarbs = pickKey(totals, ["total_carbohydrate_g", "total_carbs", "carbs", "carbohydrate_g"]);
  const totalFat = pickKey(totals, ["total_lipid_(fat)_g", "total_fat_g", "total_fat", "fat_g", "fats"]);

  console.log("Extracted totals:", { totalCalories, totalProtein, totalCarbs, totalFat });
  console.log("Meal cards:", meal_cards);
  console.log("Insights:", insights);

  return (
    <div
      style={{
        background: "#fff8e1",
        borderRadius: 12,
        padding: 20,
        lineHeight: 1.6,
        color: "#4b3f2f",
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
      }}
    >
      <h2 style={{ marginTop: 0, fontSize: "1.4rem" }}>
        🧠 Daily Nutrition Report {dateStr ? `(${dateStr})` : ""}
      </h2>

      {/* DEBUG: Show data structure */}
      <details style={{ marginBottom: 16, fontSize: "0.85rem", color: "#666" }}>
        <summary>🔍 Debug: View data structure</summary>
        <pre style={{ 
          background: "#f5f5f5", 
          padding: 10, 
          borderRadius: 4,
          overflow: "auto",
          maxHeight: 300
        }}>
          {JSON.stringify(s, null, 2)}
        </pre>
      </details>

      {/* Totals header */}
      {(totalCalories !== undefined || totalProtein !== undefined || totalCarbs !== undefined || totalFat !== undefined) ? (
        <div style={{ 
          background: "#fff", 
          padding: 15, 
          borderRadius: 8, 
          marginBottom: 16,
          border: "2px solid #ffd54f"
        }}>
          <p style={{ margin: 0 }}>
            <strong>Total:</strong> {totalCalories !== undefined ? `${formatNumber(Number(totalCalories), 0)} kcal` : "—"}
            {" • "}
            <strong>Protein:</strong> {totalProtein !== undefined ? `${formatNumber(Number(totalProtein))}g` : "—"}
            {" • "}
            <strong>Carbs:</strong> {totalCarbs !== undefined ? `${formatNumber(Number(totalCarbs))}g` : "—"}
            {" • "}
            <strong>Fat:</strong> {totalFat !== undefined ? `${formatNumber(Number(totalFat))}g` : "—"}
          </p>
        </div>
      ) : (
        <div style={{ 
          background: "#fff3cd", 
          padding: 10, 
          borderRadius: 4, 
          marginBottom: 16,
          fontSize: "0.9rem"
        }}>
          ⚠️ No totals data found. Check console logs.
        </div>
      )}

      {/* Meals list */}
      {Array.isArray(meal_cards) && meal_cards.length > 0 ? (
        <>
          <h4 style={{ marginTop: 12, marginBottom: 8 }}>🍽️ Meals Logged</h4>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {meal_cards.map((m, idx) => {
              const itemLabel = m.item ?? m.name ?? m.meal_name ?? m.title ?? `Item ${idx + 1}`;
              const itemCalories = pickKey(m, ["calories_kcal", "calories"]);
              const macros = normalizeMacros(m.macros ?? m);
              return (
                <li key={idx} style={{ marginBottom: 6 }}>
                  <strong>{itemLabel}</strong> — {itemCalories !== undefined ? `${formatNumber(Number(itemCalories), 0)} kcal` : "—"}
                  {(macros && (macros.protein_g || macros.carbs_g || macros.fat_g)) && (
                    <> ({formatNumber(macros.protein_g)}g protein, {formatNumber(macros.carbs_g)}g carbs, {formatNumber(macros.fat_g)}g fat)</>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p style={{ fontSize: "0.9rem", color: "#999" }}>No meal cards found in summary.</p>
      )}

      {/* Insights - Wins */}
      {insights?.wins?.length > 0 && (
        <>
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>🌟 Highlights</h4>
          <ul style={{ marginTop: 0 }}>
            {insights.wins.map((w, i) => <li key={i}>✅ {w}</li>)}
          </ul>
        </>
      )}

      {/* Insights - Improvements */}
      {insights?.improvements?.length > 0 && (
        <>
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>⚠️ Areas for Improvement</h4>
          <ul style={{ marginTop: 0 }}>
            {insights.improvements.map((w, i) => <li key={i}>🔸 {w}</li>)}
          </ul>
        </>
      )}

      {/* Insights - Tips */}
      {insights?.quick_tips?.length > 0 && (
        <>
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>💡 Quick Tips</h4>
          <ul style={{ marginTop: 0 }}>
            {insights.quick_tips.map((t, i) => <li key={i}>💬 {t}</li>)}
          </ul>
        </>
      )}

      {/* Daily Value Summary */}
      {percent_dv && Object.keys(percent_dv).length > 0 && (
        <>
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>🔋 % Daily Value</h4>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd" }}>
                <th align="left" style={{ padding: "8px 0" }}>Nutrient</th>
                <th align="right" style={{ padding: "8px 0" }}>% DV</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(percent_dv)
                .filter(([k, v]) => v !== undefined && v !== null && Number(v) > 0)
                .slice(0, 12)
                .map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 0" }}>{String(k).replace(/_/g, " ")}</td>
                    <td align="right">{formatNumber(Number(v), 1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

AISummaryDisplay.propTypes = {
  summary: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object
  ])
};