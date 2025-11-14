// src/Home.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import StickerField from "./StickerField.jsx";
import heroImg from "./assets/hero.jpg"; // optional background image
import "./home.css";
export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const requireAuth = (target) => {
    if (user) return navigate(target);
    navigate("/login", { state: { from: { pathname: target } } });
  };

  return (
    <div className="home-wrapper">
      <StickerField
        count={16}
        stickers={["🍎", "🥗", "🍳", "🍓", "🥛", "🍪", "💪", "🥕"]}
        seed={999}
      />

      {/* MAIN CONTAINER */}
      <div className="home-container">

        {/* ---------- HERO SECTION ---------- */}
        <section className="home-hero">
          <div className="hero-text">
            <h1>
              Smarter Food Insights,
              <br />
              <span className="accent">AI-powered & effortless</span>
            </h1>
            <p>
              Upload a receipt or screenshot — extract meals, compute macros &
              micronutrients, and track your progress over time.
            </p>

            <div className="hero-buttons">
              <button onClick={() => requireAuth("/app/upload")} className="btn-primary">
                📸 Upload Screenshot
              </button>
              <button onClick={() => requireAuth("/app/uploadcsv")} className="btn-secondary">
                ⤓ Upload CSV
              </button>
              <button onClick={() => requireAuth("/app/dailylog")} className="btn-secondary">
                🗓 Daily Log
              </button>
              <button onClick={() => requireAuth("/app/analytics")} className="btn-outline">
                View Analytics →
              </button>
            </div>
          </div>
          <div className="hero-right">
            <figure className="photo-frame" aria-hidden="true">
              <img src={heroImg} alt="Healthy meal — photo" className="hero-photo" />
              <figcaption className="photo-caption">AI Meal Scan — try after login</figcaption>
            </figure>
          </div>
        </section>

        {/* ---------- METRICS SECTION ---------- */}
        <section className="metrics-row">
          <div className="metric-card">
            <div className="metric-title">Energy (kcal)</div>
            <div className="metric-value">420 kcal</div>
            <p>Quick view of total meal energy.</p>
          </div>
          <div className="metric-card">
            <div className="metric-title">Protein (g)</div>
            <div className="metric-value">28 g</div>
            <p>Track satiety and muscle support.</p>
          </div>
          <div className="metric-card">
            <div className="metric-title">Sodium (mg)</div>
            <div className="metric-value">840 mg</div>
            <p>Monitor high-salt meals easily.</p>
          </div>
        </section>

        {/* ---------- ABOUT SECTION ---------- */}
        <section className="about-section">
          <h2>About Metrics</h2>
          <p>
            We surface calories, macros, sodium, and key vitamins using FoodData
            Central where available — %DV helps you compare quickly to a 2000 kcal
            diet. Data accuracy improves as you log more.
          </p>

          <div className="about-buttons">
            <Link to="/metrics" className="btn-outline">
              Learn more
            </Link>
            <button className="btn-secondary" onClick={() => requireAuth("/login")}>
              Why FoodX?
            </button>
          </div>
        </section>

        {/* ---------- WHAT'S NEW ---------- */}
        <section className="whatsnew">
          <h2>What’s New</h2>
          <ul>
            <li><strong>Micronutrient extraction</strong> for deeper vitamin insights.</li>
            <li><strong>Faster OCR</strong> for cleaner text recognition.</li>
            <li><strong>AI summaries</strong> for quick daily breakdowns.</li>
          </ul>
        </section>

        {/* ---------- FOOTER ---------- */}
        <footer className="home-footer">
          <small>
            © {new Date().getFullYear()} FoodX — AI-powered Nutrition Insights.
          </small>
        </footer>
      </div>
    </div>
  );
}
