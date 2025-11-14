// src/components/MealMacroBar.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function MealMacroBar({ meal }) {
  const [expanded, setExpanded] = useState(false);
  if (!meal || !meal.macros) return null;

  const m = meal.macros || {};

  // -------- helpers --------
  const first = (...vals) => {
    for (const v of vals) if (v !== undefined && v !== null) return v;
    return undefined;
  };
  const toNum = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };

  // Convert mg→g for fatty acids if only mg present
  const mgToG = (mg) => (mg === undefined || mg === null ? undefined : toNum(mg) / 1000);

  // -------- normalization (robust to multiple schemas) --------
  const calories =
    toNum(first(m.calories_kcal, m.energy_kcal, meal.calories), 0);

  const protein_g = toNum(first(m.protein_g, m.protein, m.total_protein), 0);

  const carbs_g = toNum(
    first(m.total_carbohydrate_g, m.carbohydrate_g, m.carbs_g, m.carb_g, m.carbs),
    0
  );

  const fat_g = toNum(first(m.total_fat_g, m.fat_g, m.fats_g, m.fats, m.total_fat), 0);

  const fiber_g = toNum(first(m.dietary_fiber_g, m.fiber_g, m.fibre_g), 0);

  const sugars_g = toNum(first(m.sugars_g, m.free_sugars_g, m.freesugar_g), 0);

  const sodium_mg = toNum(m.sodium_mg, 0);
  const potassium_mg = toNum(m.potassium_mg, 0);

  const calcium_mg = toNum(m.calcium_mg, 0);
  const iron_mg = toNum(m.iron_mg, 0);
  const magnesium_mg = toNum(m.magnesium_mg, 0);
  const phosphorus_mg = toNum(m.phosphorus_mg, 0);
  const zinc_mg = toNum(m.zinc_mg, 0);
  const copper_mg = toNum(m.copper_mg, 0);
  const manganese_mg = toNum(m.manganese_mg, 0);
  const chromium_mg = toNum(m.chromium_mg, 0);
  const molybdenum_mg = toNum(m.molybdenum_mg, 0);
  const selenium_ug = toNum(m.selenium_ug, 0);

  const vitamin_c_mg = toNum(first(m.vitamin_c_mg, m.vitc_mg), 0);
  // Fatty acid breakdown (prefer g; fall back to mg→g)
  const sfa_g = toNum(first(m.sfa_g, mgToG(m.sfa_mg)), 0);
  const mufa_g = toNum(first(m.mufa_g, mgToG(m.mufa_mg)), 0);
  const pufa_g = toNum(first(m.pufa_g, mgToG(m.pufa_mg)), 0);

  const cholesterol_mg = toNum(m.cholesterol_mg, 0);

  const macros = {
    calories,
    protein: protein_g,
    carbs: carbs_g,
    fats: fat_g,
    fiber: fiber_g,
    sugars: sugars_g,
    sodium: sodium_mg,
    potassium: potassium_mg,
    calcium: calcium_mg,
    iron: iron_mg,
    magnesium: magnesium_mg,
    phosphorus: phosphorus_mg,
    zinc: zinc_mg,
    copper: copper_mg,
    manganese: manganese_mg,
    chromium: chromium_mg,
    molybdenum: molybdenum_mg,
    selenium: selenium_ug, // µg
    vitaminC: vitamin_c_mg,
    sfa: sfa_g,
    mufa: mufa_g,
    pufa: pufa_g,
    cholesterol: cholesterol_mg,
  };

  // -------- UI groupings --------
  const groupMacros = [
    { label: "Protein", val: macros.protein, unit: "g", color: "#6ee7b7" },
    { label: "Carbs", val: macros.carbs, unit: "g", color: "#60a5fa" },
    { label: "Fats", val: macros.fats, unit: "g", color: "#fb923c" },
    { label: "Fiber", val: macros.fiber, unit: "g", color: "#a3e635" },
  ];

  const groupSugarsElectrolytes = [
    { label: "Free Sugars", val: macros.sugars, unit: "g", color: "#fbbf24" },
    { label: "Sodium", val: macros.sodium, unit: "mg", color: "#93c5fd" },
    { label: "Potassium", val: macros.potassium, unit: "mg", color: "#86efac" },
    { label: "Vit C", val: macros.vitaminC, unit: "mg", color: "#34d399" },
  ];

  const groupMinerals = [
    { label: "Calcium", val: macros.calcium, unit: "mg", color: "#c4b5fd" },
    { label: "Iron", val: macros.iron, unit: "mg", color: "#f87171" },
    { label: "Magnesium", val: macros.magnesium, unit: "mg", color: "#fca5a5" },
    { label: "Phosphorus", val: macros.phosphorus, unit: "mg", color: "#d8b4fe" },
  ];

  const groupFatQuality = [
    { label: "SFA", val: macros.sfa, unit: "g", color: "#fda4af" },
    { label: "MUFA", val: macros.mufa, unit: "g", color: "#f9a8d4" },
    { label: "PUFA", val: macros.pufa, unit: "g", color: "#fbcfe8" },
    { label: "Cholesterol", val: macros.cholesterol, unit: "mg", color: "#fde68a" },
  ];

  const groupTrace = [
    { label: "Zinc", val: macros.zinc, unit: "mg", color: "#bae6fd" },
    { label: "Copper", val: macros.copper, unit: "mg", color: "#fed7aa" },
    { label: "Manganese", val: macros.manganese, unit: "mg", color: "#bbf7d0" },
    { label: "Selenium", val: macros.selenium, unit: "µg", color: "#fde68a" },
  ];

  const Section = ({ title, items }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ fontSize: 12, color: "#8b8b8b", paddingLeft: 6 }}>{title}</div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        {items.map((n) => (
          <div
            key={n.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: 74,
            }}
          >
            <div
              style={{
                width: 48,
                height: 6,
                borderRadius: 6,
                background: n.color,
                marginBottom: 6,
              }}
            />
            <span style={{ fontSize: 12, color: "#4b4033" }}>{n.label}</span>
            <span style={{ fontSize: 11, color: "#6b7280" }}>
              {Number(toNum(n.val)).toFixed(n.unit === "µg" ? 0 : 1)} {n.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      style={{
        borderRadius: "1rem",
        background: expanded ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.6)",
        backdropFilter: "blur(8px)",
        padding: "0.75rem 1rem",
        marginTop: "0.5rem",
        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        cursor: "pointer",
        transition: "all 0.3s ease",
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <strong style={{ color: "#4b4033" }}>{meal.item || "Meal"}</strong>
          <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
            {macros.calories.toFixed(0)} kcal
          </span>
        </div>
        {expanded ? (
          <ChevronUp size={18} color="#6b7280" />
        ) : (
          <ChevronDown size={18} color="#6b7280" />
        )}
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.85rem" }}>
              <Section title="Macros" items={groupMacros} />
              <Section title="Sugars & Electrolytes" items={groupSugarsElectrolytes} />
              <Section title="Minerals" items={groupMinerals} />
              <Section title="Fat Quality" items={groupFatQuality} />
              <Section title="Trace Elements" items={groupTrace} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
