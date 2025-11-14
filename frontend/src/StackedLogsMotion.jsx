// src/StackedLogsMotion.jsx
import React, { useRef } from "react";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";

/**
 * Stacked Logs Scroll Reveal Animation
 * Each log card slides up and overlaps the previous one as you scroll.
 * The effect triggers only when user scrolls inside the logs area.
 */
export default function StackedLogsMotion({ logs = [], onEdit, onDelete, getCategoryIcon }) {
  const scrollRef = useRef(null);
  const total = logs.length || 1;

  // Section height controls scrollable area
  const sectionHeight = total * 120; // adjust for slower/faster scroll

  return (
    <div
      ref={scrollRef}
      style={{
        height: `${sectionHeight}vh`,
        position: "relative",
        overflowY: "auto",
        borderRadius: "1rem",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {logs
          .slice()
          .reverse()
          .map((log, i) => (
            <StackedCard
              key={log.id ?? i}
              log={log}
              index={i}
              total={total}
              scrollRef={scrollRef}
              onEdit={onEdit}
              onDelete={onDelete}
              getCategoryIcon={getCategoryIcon}
            />
          ))}
      </div>
    </div>
  );
}

function StackedCard({ log, index, total, scrollRef, onEdit, onDelete, getCategoryIcon }) {
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start end", "end start"],
  });

  const start = index / total;
  const end = (index + 1) / total;

  const y = useTransform(scrollYProgress, [start, end], ["100vh", "0vh"]);
  const scale = useTransform(scrollYProgress, [start, end], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [start, end], [0, 1]);
  const bgBlur = useTransform(scrollYProgress, [start, end], [6, 0]);

  const filter = useMotionTemplate`blur(${bgBlur}px)`;

  return (
    <motion.div
      style={{
        position: "absolute",
        top: 0,
        width: "90%",
        maxWidth: 400,
        y,
        scale,
        opacity,
        filter,
        zIndex: total - index,
        borderRadius: "1rem",
        background: "linear-gradient(180deg,#fffdf9 0%,#fbf4e7 100%)",
        border: "1px solid rgba(0,0,0,0.05)",
        boxShadow: "0 20px 40px rgba(0,0,0,0.12)",
        padding: "1.5rem",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center" }}>
        <div
          style={{
            backgroundColor: "#fff",
            padding: "0.75rem",
            borderRadius: "0.75rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          }}
        >
          {getCategoryIcon?.(log.category)}
        </div>
        <div>
          <h3 style={{ color: "#5c4f3f", fontWeight: "700", margin: 0 }}>{log.item}</h3>
          <p style={{ color: "#9ca3af", fontSize: "0.75rem", margin: 0, textTransform: "uppercase" }}>
            {log.category}
          </p>
        </div>
      </div>

      {/* Calories / other values */}
      {log.calories || log.manual_calories ? (
        <div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Calories</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#5c4f3f" }}>
            {Math.round(log.manual_calories ?? log.calories)} kcal
          </div>
        </div>
      ) : log.water_ml ? (
        <div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Water Intake</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#5c4f3f" }}>
            {Math.round(log.water_ml)} ml
          </div>
        </div>
      ) : log.steps ? (
        <div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Steps</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#5c4f3f" }}>{log.steps}</div>
        </div>
      ) : log.sleep_hours ? (
        <div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>Sleep</div>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#5c4f3f" }}>{log.sleep_hours} hrs</div>
        </div>
      ) : (
        <div style={{ color: "#9ca3af", fontSize: "0.9rem" }}>No measurement</div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button
          onClick={() => onEdit(log)}
          style={{
            flex: 1,
            padding: "0.6rem",
            borderRadius: "0.5rem",
            background: "#fff",
            border: "1px solid #ddd",
            cursor: "pointer",
          }}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(log)}
          style={{
            flex: 1,
            padding: "0.6rem",
            borderRadius: "0.5rem",
            background: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            cursor: "pointer",
          }}
        >
          Delete
        </button>
      </div>
    </motion.div>
  );
}
