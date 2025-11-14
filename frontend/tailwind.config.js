/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      keyframes: {
        spinSlow: { to: { transform: "rotate(360deg)" } },
        floatPulse: {
          "0%":   { transform: "translateY(0)" },
          "50%":  { transform: "translateY(-6px)" },
          "100%": { transform: "translateY(0)" }
        }
      },
      animation: {
        "spin-slow": "spinSlow 28s linear infinite",
        "float": "floatPulse 4s ease-in-out infinite"
      },
      colors: {
        surface: "rgba(255,255,255,0.06)",
        border: "rgba(255,255,255,0.14)"
      },
      boxShadow: {
        glass: "0 40px 120px rgba(0,0,0,0.45)"
      }
    }
  },
  plugins: [],
};
