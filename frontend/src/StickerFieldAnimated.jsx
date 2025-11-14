// src/StickerFieldAnimated.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import PropTypes from "prop-types";
import "./StickerFieldAnimated.css";

/**
 * Animated sticker field:
 * - accepts `stickers` (emoji strings) and/or `pngStickers` (image URLs)
 * - `count` controls how many decorative stickers are generated
 * - `seed` deterministic-ish positions if you want reproducible layout
 */
export default function StickerFieldAnimated({ count = 14, stickers = [], pngStickers = [], seed = 42 }) {
  const containerRef = useRef(null);
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // global mouse position motion values used by children for parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  // smooth springed versions (less jitter)
  const springX = useSpring(mouseX, { damping: 20, stiffness: 120 });
  const springY = useSpring(mouseY, { damping: 20, stiffness: 120 });

  // device tilt fallback (mobile)
  useEffect(() => {
    let handler;
    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window && window.DeviceOrientationEvent) {
      handler = (ev) => {
        // gamma: left-right tilt, beta: front-back tilt
        const gx = ev.gamma || 0;
        const gy = ev.beta || 0;
        // scale down to small range
        mouseX.set(gx / 20);
        mouseY.set(gy / 20);
      };
      window.addEventListener("deviceorientation", handler);
    }
    return () => {
      if (handler) window.removeEventListener("deviceorientation", handler);
    };
  }, [mouseX, mouseY]);

  // update mouse motion values when pointer moves over container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // normalized -1 .. 1
      const nx = ((e.clientX || (e.touches && e.touches[0].clientX)) - cx) / (rect.width / 2);
      const ny = ((e.clientY || (e.touches && e.touches[0].clientY)) - cy) / (rect.height / 2);
      mouseX.set(Math.max(-1, Math.min(1, nx)));
      mouseY.set(Math.max(-1, Math.min(1, ny)));
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("touchmove", onMove);
    };
  }, [mouseX, mouseY]);

  // deterministic-ish pseudo-random generator (LCG)
  const rng = (s) => {
    let seed = s >>> 0;
    return () => {
      seed = (1664525 * seed + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  };
  const rand = useMemo(() => rng(seed), [seed]);

  // generate sticker items
  const items = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const usePng = pngStickers.length > 0 && rand() > 0.4;
      const content = usePng ? pngStickers[Math.floor(rand() * pngStickers.length)] : stickers[Math.floor(rand() * Math.max(1, stickers.length))] || "🍽️";
      // random layout values
      const size = Math.round(32 + rand() * 48); // 32..80 px
      const left = Math.round(rand() * 90); // percent
      const top = Math.round(rand() * 90);
      const rot = Math.round((rand() - 0.5) * 45); // -22..22deg
      const floatPhase = rand();
      arr.push({ id: `s_${i}`, content, usePng, size, left, top, rot, floatPhase });
    }
    return arr;
  }, [count, pngStickers, stickers, rand]);

  return (
    <div ref={containerRef} className="sticker-field-animated" aria-hidden="true">
      {items.map((it, idx) => (
        <Sticker
          key={it.id}
          {...it}
          springX={springX}
          springY={springY}
          index={idx}
          prefersReducedMotion={prefersReducedMotion}
        />
      ))}
    </div>
  );
}

StickerFieldAnimated.propTypes = {
  count: PropTypes.number,
  stickers: PropTypes.array,
  pngStickers: PropTypes.array,
  seed: PropTypes.number,
};

/* ---------- Child sticker component ---------- */
function Sticker({ content, usePng, size, left, top, rot, floatPhase, springX, springY, index, prefersReducedMotion }) {
  // convert motion values into small parallax transforms per-item
  // farther items move less; closer items more. use index-based depth
  const depth = 0.3 + (index % 5) * 0.15; // 0.3 .. ~1
  const maxParallax = 12 * depth; // px

  // create derived transforms
  const translateX = useTransform(springX, (v) => `${-v * maxParallax}px`);
  const translateY = useTransform(springY, (v) => `${-v * maxParallax}px`);
  const rotate = `${rot}deg`;

  // a little floating vertical motion using CSS animation (reduced-motion respects)
  const floatDelay = `${(floatPhase * 2).toFixed(2)}s`;
  const style = {
    left: `${left}%`,
    top: `${top}%`,
    width: size,
    height: size,
    transform: `rotate(${rotate})`,
    zIndex: Math.round(100 + depth * 20),
    // CSS variable for float delay
    ["--float-delay"]: floatDelay,
  };

  // framer-motion spring props for drag
  const dragConstraints = false;

  return (
    <motion.div
      className={`sticker-item ${usePng ? "sticker-png" : "sticker-emoji"}`}
      style={style}
      drag={!prefersReducedMotion}
      dragElastic={0.18}
      dragConstraints={dragConstraints}
      whileTap={{ scale: 1.05, rotate: `${rot + 6}deg` }}
      whileHover={!prefersReducedMotion ? { scale: 1.08, y: -4 } : {}}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay: index * 0.03 }}
      title={typeof content === "string" && !usePng ? content : "sticker"}
    >
      <motion.div
        className="sticker-inner"
        style={{
          x: translateX,
          y: translateY,
        }}
        aria-hidden="true"
      >
        {usePng ? (
          <img src={content} alt="" draggable="false" />
        ) : (
          <span aria-hidden="true" className="emoji">{content}</span>
        )}
      </motion.div>
    </motion.div>
  );
}
