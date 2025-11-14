// src/MacbookScrollPage.jsx
import React, { useRef, useEffect } from "react";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";

/**
 * MacbookScrollPage
 * - similar to the macbook-scroll demo you referenced
 * - logs prop supported (optional)
 *
 * Usage:
 *  import MacbookScrollPage from "./MacbookScrollPage";
 *  <MacbookScrollPage logs={logs} onEdit={handleEdit} onDelete={handleDelete} />
 */
export default function MacbookScrollPage({ logs: incomingLogs = null, onEdit = () => {}, onDelete = () => {}, getCategoryIcon = () => null }) {
  const demo = [
    { id: "1", item: "Idli", category: "Meal", timestamp: Date.now() - 1000 * 60 * 60 * 3 },
    { id: "2", item: "Coconut Water", category: "Water", water_ml: 300, timestamp: Date.now() - 1000 * 60 * 60 * 2 },
    { id: "3", item: "Yoga", category: "Activity", steps: 1200, timestamp: Date.now() - 1000 * 60 * 60 },
  ];
  const logs = incomingLogs && incomingLogs.length ? incomingLogs : demo;

  return (
    <div style={{ minHeight: "100vh", padding: 32, background: "linear-gradient(180deg,#fffdf9 0%,#fdf5e7 100%)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 540px 1fr", gap: 20 }}>
        <div />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 style={{ margin: 0, color: "#5c4f3f" }}>MacBook Scroll — Card Stack</h1>
          <div style={{ color: "#9ca3af" }}>Scroll inside the device area to progress through the cards.</div>

          <div style={{ borderRadius: 16, padding: 18, background: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}>
            <MacDevice logs={logs} onEdit={onEdit} onDelete={onDelete} getCategoryIcon={getCategoryIcon} />
          </div>
        </div>
        <div />
      </div>
    </div>
  );
}

/* MacDevice: render a device frame with a centered, sticky viewport that holds cards */
function MacDevice({ logs, onEdit, onDelete, getCategoryIcon }) {
  const scrollRef = useRef(null);
  const perCard = 260;
  const totalHeight = Math.max(window.innerHeight, logs.length * perCard);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e) => {
      if (Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        el.scrollBy({ top: e.deltaY, behavior: "auto" });
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ width: 520, borderRadius: 14, background: "#f7f3ee", padding: 14, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.02)" }}>
          {/* Top bezel */}
          <div style={{ height: 420, overflow: "hidden", borderRadius: 12, position: "relative" }}>
            {/* scroll area */}
            <div ref={scrollRef} style={{ height: totalHeight, overflowY: "auto", position: "relative" }}>
              <div style={{ position: "sticky", top: 0, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {logs.slice().reverse().map((log, i) => (
                  <DeviceCard
                    key={log.id ?? i}
                    log={log}
                    index={i}
                    total={logs.length}
                    scrollRef={scrollRef}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    getCategoryIcon={getCategoryIcon}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* bottom bezel */}
          <div style={{ marginTop: 8, height: 10, background: "rgba(0,0,0,0.02)", borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

function DeviceCard({ log, index, total, scrollRef, onEdit, onDelete, getCategoryIcon }) {
  const { scrollYProgress } = useScroll({
    target: scrollRef,
    offset: ["start start", "end end"],
  });

  const start = index / total;
  const end = (index + 1) / total;

  const y = useTransform(scrollYProgress, [start, end], ["100vh", "0vh"]);
  const scale = useTransform(scrollYProgress, [start, end], [0.94, 1]);
  const opacity = useTransform(scrollYProgress, [Math.max(0, start - 0.06), end], [0.06, 1]);
  const blur = useTransform(scrollYProgress, [start, end], [8, 0]);
  const filter = useMotionTemplate`blur(${blur}px)`;

  const z = 1200 + (total - index);

  return (
    <motion.div
      style={{
        position: "absolute",
        top: 0,
        width: "90%",
        maxWidth: 460,
        y,
        scale,
        opacity,
        filter,
        zIndex: z,
        borderRadius: 12,
        padding: 16,
        background: "linear-gradient(180deg,#ffffff 0%,#fcf6ee 100%)",
        border: "1px solid rgba(0,0,0,0.04)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.10)",
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 56, height: 56, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.06)" }}>
          {getCategoryIcon?.(log.category)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: "#5c4f3f" }}>{log.item}</div>
          <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 6 }}>{(log.category || "").toUpperCase()} • {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          {log.manual_calories || log.calories ? <div style={{ fontWeight: 800, color: "#5c4f3f" }}>{Math.round(log.manual_calories ?? log.calories)} kcal</div> : <div style={{ color: "#9ca3af" }}>No measurement</div>}
        </div>
      </div>

      <div style={{ marginTop: 12, background: "#fff", padding: 12, borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,0.04)" }}>
        {log.macros ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Protein</div>
              <div style={{ fontWeight: 800, color: "#5c4f3f" }}>{Math.round(log.macros.protein_g ?? log.macros.protein ?? 0)}g</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Carbs</div>
              <div style={{ fontWeight: 800, color: "#5c4f3f" }}>{Math.round(log.macros.total_carbohydrate_g ?? log.macros.carbs ?? 0)}g</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>Fat</div>
              <div style={{ fontWeight: 800, color: "#5c4f3f" }}>{Math.round(log.macros.total_fat_g ?? log.macros.fats ?? 0)}g</div>
            </div>
          </div>
        ) : (
          <div style={{ color: "#9ca3af" }}>{log.ai_summary ?? "No details"}</div>
        )}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={() => onEdit(log)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid rgba(0,0,0,0.06)", cursor: "pointer", fontWeight: 700 }}>Edit</button>
        <button onClick={() => onDelete(log)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: "#fee2e2", border: "1px solid #fca5a5", color: "#b91c1c", cursor: "pointer", fontWeight: 700 }}>Delete</button>
      </div>
    </motion.div>
  );
}
