// src/components/StickerField.jsx
import React, { useMemo } from "react";

/**
 * StickerField
 * - Renders N scattered stickers across the viewport.
 * - Each sticker gets randomized: x/y position (%), size, animation duration & delay, drift direction and rotation.
 * - Uses emoji by default; you can swap `STICKERS` entries for image URLs (png/svg).
 *
 * Props:
 *  - count (number) default 18
 *  - stickers (string[]) optional array of emoji or image URLs
 *  - pngStickers (string[]) optional array of PNG image imports
 */

const DEFAULT_STICKERS = [
  "🥗","🍎","🍌","🥑","🥤","🏃‍♀️","💪","🥕","🍞","🍓","🧃","🍳","🍪","🧘‍♀️","🍓","🍇","🍊","🥛"
];

function randIn(min, max) {
  return Math.random() * (max - min) + min;
}

export default function StickerField({ count = 18, stickers = DEFAULT_STICKERS, pngStickers = [] }) {
  // create sticker specs once per mount
  const specs = useMemo(() => {
    const out = [];
    // Combine emoji stickers and PNG stickers
    const allStickers = [...stickers, ...pngStickers];
    for (let i = 0; i < count; i++) {
      const sticker = allStickers[i % allStickers.length];
      const size = Math.round(randIn(36, 120)); // px (can adjust)
      // avoid placing exactly in the middle always: use percent offsets
      const x = randIn(2, 92); // percent
      const y = randIn(2, 92);
      const duration = randIn(8, 22); // seconds for loop
      const delay = randIn(-8, 8); // seconds
      const driftX = randIn(-18, 18); // translation px range for drift
      const driftY = randIn(-20, 20);
      const rotate = randIn(-8, 18); // rotation degrees baseline
      const opacity = randIn(0.22, 0.88);
      const floatScale = randIn(0.92, 1.08);
      out.push({
        id: `st-${i}`,
        sticker,
        size,
        x,
        y,
        duration,
        delay,
        driftX,
        driftY,
        rotate,
        opacity,
        floatScale
      });
    }
    return out;
  }, [count, stickers, pngStickers]);

  return (
    <div className="sticker-field" aria-hidden="true">
      {specs.map((s) => (
        <div
          key={s.id}
          className="sticker"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            transform: `translate(-50%, -50%) rotate(${s.rotate}deg) scale(${s.floatScale})`,
            animationDuration: `${s.duration}s`,
            animationDelay: `${s.delay}s`,
            // CSS variables read by stylesheet for per-sticker drift
            // provide values as inline CSS vars so each sticker has independent movement extents
            ["--drift-x"]: `${s.driftX}px`,
            ["--drift-y"]: `${s.driftY}px`,
            opacity: s.opacity
          }}
        >
          {/* If emoji (single char) — render as text. If URL (contains https? or ends with .png/.svg) use img */}
          {typeof s.sticker === "string" && (s.sticker.startsWith("http://") || s.sticker.startsWith("https://") || s.sticker.match(/\.(png|jpg|jpeg|svg|webp)$/i)) ? (
            <img src={s.sticker} alt="" />
          ) : (
            <span className="sticker-emoji">{s.sticker}</span>
          )}
        </div>
      ))}
    </div>
  );
}
