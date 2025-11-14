// src/components/NutrientOrb.jsx
import React from "react";

/**
 * NutrientOrb
 * Props:
 *  - label: string (e.g., "Protein")
 *  - value: number
 *  - unit: string ("g" | "kcal" | "mg")
 *  - percent: number (0-100)
 *  - color: string (CSS color)
 *  - onClick: function
 */
export default function NutrientOrb({ label, value = 0, unit = "", percent = 0, color = "#6ee7b7", onClick }) {
  const size = 110;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const offset = circumference * (1 - clamped / 100);
  const displayVal = (typeof value === "number" && !Number.isNaN(value)) ? Math.round(value * 10) / 10 : value;

  return (
    <button
      onClick={onClick}
      aria-label={`${label} ${displayVal}${unit} (${clamped}% of target)`}
      style={{
        border: "none",
        background: "transparent",
        padding: 6,
        margin: 8,
        cursor: "pointer",
        width: size,
        textAlign: "center",
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
        <g transform={`translate(${size/2}, ${size/2})`}>
          <circle r={radius} fill="#fff" stroke="#f3f4f6" strokeWidth="2" />
          <circle
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={stroke}
            fill="none"
            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
          />
          <circle
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dashoffset 600ms ease" }}
          />
          <circle r={radius - stroke - 4} fill="#fff" />
        </g>
      </svg>

      <div style={{ marginTop: -46, pointerEvents: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{displayVal}{unit}</div>

        <div style={{ marginTop: 6 }}>
          <div style={{ height: 6, width: 72, background: "#f1f5f9", borderRadius: 6, overflow: "hidden", margin: "0 auto" }}>
            <div style={{ height: "100%", width: `${clamped}%`, background: color, transition: "width 600ms ease" }} />
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{clamped}%</div>
        </div>
      </div>
    </button>
  );
}
