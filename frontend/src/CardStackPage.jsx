// src/CardStackStandalone.jsx
import React, { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useMotionTemplate } from "framer-motion";

/**
 * CardStackStandalone
 * - floating centered stack (no white outer panel)
 * - expects logs array, onEdit, onDelete, getCategoryIcon
 */
export default function CardStackStandalone({ logs = [], onEdit = () => { }, onDelete = () => { }, getCategoryIcon = () => null }) {
  const demo = [
    { id: "a", item: "Chicken Pulao", category: "Meal", timestamp: Date.now() - 1000 * 60 * 60 * 2 },
    { id: "b", item: "Chicken Pizza", category: "Meal", timestamp: Date.now() - 1000 * 60 * 30 },
  ];
  const items = Array.isArray(logs) && logs.length ? logs : demo;

  return (
    <div style={{
      width: "100%",
      display: "flex",
      justifyContent: "center",
      padding: "6px 0",
      pointerEvents: "auto",
    }}>
      <CardStackInner logs={items} onEdit={onEdit} onDelete={onDelete} getCategoryIcon={getCategoryIcon} />
    </div>
  );
}

function CardStackInner({ logs, onEdit, onDelete, getCategoryIcon }) {
  const scrollRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const update = () => {
      const vh = window.innerHeight;
      // per-card scroll space, tune as needed. Smaller total means first card visible initially.
      const perCard = Math.max(vh * 0.7, 320);
      const total = Math.max(vh * 1.0, logs.length * perCard);
      setContainerHeight(total);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [logs.length]);

  // forward wheel events to container (so wheel inside card still scrolls container)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey) return;
      if (Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        el.scrollBy({ top: e.deltaY, behavior: "auto" });
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  if (containerHeight === 0) return null;

  // sort ascending so the oldest (index 0) is visible first
  const logsSorted = logs.slice().sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return (
    <div
      ref={scrollRef}
      style={{
        height: "68vh",
        maxWidth: 960,
        width: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        position: "relative",
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
        scrollbarWidth: "none", // Firefox hide
        msOverflowStyle: "none", // IE hide
        overflowY: "scroll", // keep scroll working
      }}
    >
      <div style={{ height: containerHeight, position: "relative" }}>
        <div
          style={{
            position: "sticky",
            // center the sticky window vertically
            top: "calc(50% - 220px)",
            height: 440,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none", // cards themselves enable pointer events
          }}
        >
          {logsSorted.map((log, idx) => (
            <StackedCard
              key={log.id ?? idx}
              log={log}
              index={idx}
              total={logsSorted.length}
              containerRef={scrollRef}
              onEdit={onEdit}
              onDelete={onDelete}
              getCategoryIcon={getCategoryIcon}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// replace your StackedCard(...) in CardStackStandalone.jsx with this

function StackedCard({ log, index, total, containerRef, onEdit, onDelete, getCategoryIcon }) {
  const { scrollYProgress } = useScroll({ container: containerRef, layoutEffect: false });

  const revealPoint = index / Math.max(1, total);

  // Widen the reveal window to slow movement:
  const enter = Math.max(0, revealPoint - 0.30);  // start earlier
  const settle = Math.min(1, revealPoint + 0.15); // finish later

  // Movement ranges are larger so the animation appears slower/softer
  const y = useTransform(scrollYProgress, [enter, revealPoint], ["48vh", "0vh"]);
  const scale = useTransform(scrollYProgress, [enter, revealPoint], [0.94, 1]);
  const opacity = useTransform(scrollYProgress, [Math.max(0, enter - 0.04), revealPoint], [0, 1]);
  const blurVal = useTransform(scrollYProgress, [enter, revealPoint], [20, 0]);
  const filter = useMotionTemplate`blur(${blurVal}px)`;

  const zIndex = 900000 + index;

  return (
    <motion.article
      layout
      style={{
        position: "absolute",
        width: "86%",
        maxWidth: 820,
        top: 0,
        y,
        scale,
        opacity,
        filter,
        zIndex,
        borderRadius: 16,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,

      }}
      transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* halo */}
      <div style={{
        position: "absolute",
        left: "7%",
        right: "7%",
        bottom: "-20%",
        height: 200,
        borderRadius: 22,
        zIndex: -2,
        pointerEvents: "none",
        filter: "blur(36px)",
        opacity: 0.5,
        background: "radial-gradient(60% 50% at 50% 30%, rgba(20,20,30,0.12), rgba(20,20,30,0.04) 35%, transparent 70%)"
      }} />

      {/* card surface (same as before) */}
      <div style={{
        borderRadius: 14,
        padding: 18,
        background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(251,244,231,0.96) 100%)",
        border: "1px solid rgba(0,0,0,0.04)",
        boxShadow: "0 18px 40px rgba(20,20,30,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
        backdropFilter: "blur(4px) saturate(1.02)",
      }}>
        {/* ... card content unchanged ... */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: "linear-gradient(180deg,#fff 0%, #fafafa 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 8px 22px rgba(0,0,0,0.06)"
          }}>
            {getCategoryIcon?.(log.category)}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: "#5c4f3f", fontSize: 18 }}>{log.item}</div>
            <div style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>
              {(log.category || "").toUpperCase()} • {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            {log.manual_calories || log.calories ? (
              <div style={{ fontWeight: 800, color: "#5c4f3f" }}>
                {Math.round(log.manual_calories ?? log.calories)} kcal
              </div>
            ) : (
              <div style={{ color: "#9ca3af" }}>No measurement</div>
            )}
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div style={{
          background: "#fff",
          padding: 12,
          borderRadius: 10,
          boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.03)",
          color: "#9ca3af"
        }}>
          {log.macros ? (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Protein</div>
                <div style={{ fontWeight: 800, color: "#5c4f3f" }}>
                  {Math.round(log.macros.protein_g ?? log.macros.protein ?? 0)}g
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Carbs</div>
                <div style={{ fontWeight: 800, color: "#5c4f3f" }}>
                  {Math.round(log.macros.total_carbohydrate_g ?? log.macros.carbs ?? 0)}g
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Fat</div>
                <div style={{ fontWeight: 800, color: "#5c4f3f" }}>
                  {Math.round(log.macros.total_fat_g ?? log.macros.fats ?? 0)}g
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: "#9ca3af" }}>{log.ai_summary ?? "No details available."}</div>
          )}
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onEdit(log)} style={{
            flex: 1, padding: "10px 12px", borderRadius: 10, background: "#fff",
            border: "1px solid rgba(0,0,0,0.06)", cursor: "pointer", fontWeight: 700
          }}>Edit</button>

          <button onClick={() => onDelete(log)} style={{
            flex: 1, padding: "10px 12px", borderRadius: 10, background: "#fee2e2",
            border: "1px solid #fca5a5", color: "#b91c1c", cursor: "pointer", fontWeight: 700
          }}>Delete</button>
        </div>
      </div>
    </motion.article>
  );
}

