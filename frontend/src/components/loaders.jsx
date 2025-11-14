// src/components/loaders/index.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ----------------------------- Overlay wrapper ----------------------------- */
export function LoaderOverlay({ open, label = "Working…", children }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            backdropFilter: "blur(5px)",
            WebkitBackdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          aria-busy="true"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            style={{
              borderRadius: 20,
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              padding: 22,
              minWidth: 220,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}
          >
            {children}
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#4b4033",
                textAlign: "center",
                marginTop: 2,
              }}
            >
              {label}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ----------------------------- 1) Fruit Flip ------------------------------ */
export function FruitFlipLoader({ size = 34, gap = 14, speed = 0.9 }) {
  const fruits = ["🍎", "🍌", "🍇", "🍓", "🥝", "🍊"];
  return (
    <div
      style={{
        display: "flex",
        gap,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {fruits.map((f, i) => (
        <motion.div
          key={f + i}
          animate={{ rotateY: [0, 180, 360], scale: [1, 1.1, 1] }}
          transition={{
            repeat: Infinity,
            duration: speed * 1.8,
            ease: "easeInOut",
            delay: i * (speed / 4),
          }}
          style={{
            fontSize: size,
            transformStyle: "preserve-3d",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
          }}
        >
          {f}
        </motion.div>
      ))}
    </div>
  );
}

/* -------------------- 2) Cutting board chopping 🧑‍🍳🔪🥕 -------------------- */
export function CuttingBoardLoader({ size = 42, boardW = 180, boardH = 70, speed = 0.9 }) {
  return (
    <div style={{ position: "relative", width: boardW, height: boardH + 40 }}>
      {/* board */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          top: 18,
          borderRadius: 12,
          background:
            "linear-gradient(180deg, rgba(205, 170, 120, 0.9) 0%, rgba(175, 140, 95, 0.9) 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), 0 10px 30px rgba(0,0,0,0.15)",
        }}
      />
      {/* carrot */}
      <motion.div
        initial={{ x: 22, y: boardH / 2, rotate: -8 }}
        animate={{ rotate: [-8, -10, -8] }}
        transition={{ repeat: Infinity, duration: speed * 2, ease: "easeInOut" }}
        style={{
          position: "absolute",
          fontSize: size,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
        }}
      >
        🥕
      </motion.div>
      {/* knife chop */}
      <motion.div
        initial={{ x: boardW - 70, y: boardH / 2 - 8, rotate: -20 }}
        animate={{ y: [boardH / 2 - 24, boardH / 2 - 4, boardH / 2 - 24], rotate: [-15, -35, -15] }}
        transition={{ repeat: Infinity, duration: speed * 1.2, ease: "easeInOut" }}
        style={{
          position: "absolute",
          fontSize: size,
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.35))",
        }}
      >
        🔪
      </motion.div>
      {/* chopped bits */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: boardW - 80, y: boardH / 2 }}
            animate={{
            opacity: [0, 1, 0],
            x: [boardW - 80, boardW - 60 - i * 10, boardW - 30 - i * 18],
            y: [boardH / 2, boardH / 2 - 10 - i * 4, boardH / 2 + 8],
          }}
          transition={{ repeat: Infinity, duration: speed * 1.2, ease: "easeOut", delay: i * 0.12 }}
          style={{ position: "absolute", fontSize: size * 0.55 }}
        >
          🥕
        </motion.div>
      ))}
    </div>
  );
}

/* ------------------------ 3) Bowl filling up 🍲📈 ------------------------- */
export function BowlFillLoader({ size = 46, width = 200, height = 140, speed = 1.4 }) {
  return (
    <div style={{ position: "relative", width, height, display: "grid", placeItems: "center" }}>
      {/* bowl */}
      <div style={{ fontSize: size, filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.35))" }}>🍲</div>

      {/* fill (masked rising bar) */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          width: width * 0.5,
          height: height * 0.02,
          overflow: "hidden",
          borderRadius: 10,
        }}
      >
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: [0, height * 0.22, 0] }}
          transition={{ repeat: Infinity, duration: speed * 2, ease: "easeInOut" }}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            background:
              "linear-gradient(180deg, rgba(255,140,66,0.9) 0%, rgba(255,199,120,0.9) 100%)",
          }}
        />
      </div>

      {/* tiny rising bubbles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0, 1, 0], y: [-4, -18, -28] }}
          transition={{ repeat: Infinity, duration: speed, delay: i * 0.18, ease: "easeOut" }}
          style={{ position: "absolute", bottom: 40, fontSize: 12 + (i % 3) * 2 }}
        >
          ●
        </motion.div>
      ))}
    </div>
  );
}

/* -------------------- 4) Sushi conveyor belt 🍣🚂 ------------------------- */
export function SushiConveyorLoader({ width = 260, height = 100, speed = 8 }) {
  const items = ["🍣", "🍤", "🍣", "🍙", "🍣", "🍤", "🍥", "🍣"];
  return (
    <div style={{ position: "relative", width, height }}>
      {/* track */}
      <div
        style={{
          position: "absolute",
          bottom: 18,
          left: 0,
          right: 0,
          height: 22,
          borderRadius: 14,
          background: "linear-gradient(180deg, #d8d8d8 0%, #bfbfbf 100%)",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.6), 0 8px 18px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* rollers */}
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 10px, rgba(255,255,255,0.08) 10px 20px)",
          }}
        />
      </div>

      {/* sushi cars */}
      <div style={{ position: "absolute", bottom: 28, left: 0, right: 0, overflow: "hidden" }}>
        <motion.div
          animate={{ x: ["100%", "-100%"] }}
          transition={{ repeat: Infinity, duration: speed, ease: "linear" }}
          style={{ display: "flex", gap: 24, alignItems: "center" }}
        >
          {[...items, ...items].map((s, i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 + (i % 4) * 0.2, ease: "easeInOut" }}
              style={{ fontSize: 30, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}
            >
              {s}
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* chef emoji on side */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: [6, 0, 6] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        style={{ position: "absolute", top: 6, right: 10, fontSize: 24 }}
      >
        👨‍🍳
      </motion.div>
    </div>
  );
}

/* ------------------------ 5) Bouncing chapatis 🫓 ------------------------- */
export function ChapatiBounceLoader({ count = 5, size = 36, gap = 10, speed = 1.1 }) {
  const arr = Array.from({ length: count });
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap }}>
      {arr.map((_, i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -18, 0], rotate: [0, 10, 0] }}
          transition={{
            repeat: Infinity,
            duration: speed + (i % 3) * 0.2,
            ease: "easeInOut",
            delay: i * 0.08,
          }}
          style={{
            fontSize: size,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
          }}
        >
          🫓
        </motion.div>
      ))}
    </div>
  );
}
