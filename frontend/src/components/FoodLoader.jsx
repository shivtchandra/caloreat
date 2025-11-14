// FoodLoader.jsx
import React from "react";
import { motion } from "framer-motion";

export default function FoodLoader({ label = "Loading…" }) {
  const foods = ["🍎","🍌","🥗","🍛","🥕","🍇"];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        backdropFilter: "blur(8px)",
        background: "rgba(255,255,255,0.7)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999
      }}
    >
      <div style={{ fontSize: 44, display: "flex", gap: 14 }}>
        {foods.map((f, i) => (
          <motion.div
            key={f}
            animate={{ y: [0, -16, 0], rotate: [0, -8, 8, 0] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          >
            {f}
          </motion.div>
        ))}
      </div>

      <motion.div
        animate={{ opacity: [1,0.4,1] }}
        transition={{ repeat: Infinity, duration: 1.4 }}
        style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: "#4b4033" }}
      >
        {label}
      </motion.div>
    </motion.div>
  );
}
