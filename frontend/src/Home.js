import React, { useEffect, useRef, useState, } from "react";
import { Plus, Calculator, Users, BarChart3, Target, Activity, Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import {login} from "react-router-dom";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef(null);
  const stackRef = useRef(null);
  const navigate = useNavigate();


  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ---------- STACK: 3-stage wheel-driven timeline 0..3
  const [p, setP] = useState(0);
  const [inStack, setInStack] = useState(false);

  useEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      setInStack(r.top <= 0 && r.bottom >= vh);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!inStack) {
      document.body.style.overflow = "";
      return;
    }
    const onWheel = (e) => {
      const delta = e.deltaY || e.wheelDelta || 0;
      const next = clamp(p + delta / 900, 0, 3);
      const pastEnd = p >= 3 && delta > 0;
      const pastStart = p <= 0 && delta < 0;

      if (pastEnd) {
        document.body.style.overflow = "";
        document.getElementById("metrics")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (pastStart) {
        document.body.style.overflow = "";
        heroRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        return;
      }
      e.preventDefault();
      setP(next);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("wheel", onWheel);
      document.body.style.overflow = "";
    };
  }, [inStack, p]);

  // PHASES
  const pA = clamp(p / 1, 0, 1);       // settle center
  const pB = clamp((p - 1) / 1, 0, 1); // fan/spread
  const pC = clamp((p - 2) / 1, 0, 1); // blast & handoff

  // ---------- DIMENSIONS (≈ half size)
  const CARD_W = 350;
  const CARD_H = 200;

  // ---------- STYLES
  const thickGlass = {
    // darker and more solid glass
    background: "rgba(20,20,20,0.90)",
    color: "#fff",
  
    // more defined glass edges
    border: "1.5px solid rgba(255,255,255,0.30)",
    borderRadius: 20,
  
    // thicker card illusion — dual strong shadows + inner light edge
    boxShadow: `
      0 0 1px rgba(255,255,255,0.4) inset,
      0 3px 6px rgba(255,255,255,0.15) inset,
      0 24px 60px rgba(0,0,0,0.35),
      0 10px 28px rgba(0,0,0,0.28)
    `,
  
    // heavier glass blur
    backdropFilter: "blur(14px) saturate(1.35)",
    WebkitBackdropFilter: "blur(14px) saturate(1.35)",
  
    // subtle slight tilt illusion (depth)
    transformStyle: "preserve-3d",
  };
  

  const CardShell = ({ style, children }) => (
    <div
      style={{
        position: "absolute",
        width: CARD_W,
        height: CARD_H,
        display: "grid",
        alignItems: "center",
        padding: 14,
        overflow: "hidden",
        ...thickGlass,
        ...style,
      }}
    >
      {/* thickness accents */}
      <div
        style={{
          position: "absolute", left: 12, right: 12, bottom: 8, height: 10,
          borderRadius: 999, background: "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.35))",
          filter: "blur(4px)", pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute", top: 10, bottom: 10, right: 8, width: 6,
          borderRadius: 999, background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.07))",
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );

  // ---------- BLAST (4 cards only)
  // order: [Onboarding(top), Manual(mid), Analysis(right), Social(left)]
  const blast = [
    { dx: 160, dy: -120, rot: 10 },
    { dx: -120, dy: 120, rot: -8 },
    { dx: 260, dy: 30, rot: 12 },
    { dx: -260, dy: -20, rot: -12 },
  ];

  const fan = {
    top:   { x: lerp(0, 0, pB),   y: lerp(22, 0, pA),   r: lerp(-1, 0, pA) },
    mid:   { x: lerp(0, 0, pB),   y: lerp(12, 4, pA),   r: lerp(-0.5, 0, pA) },
    right: { x: lerp(0, 180, pB), y: lerp(6, 0, pA),    r: lerp(2, 6, pB) },
    left:  { x: lerp(0,-180, pB), y: lerp(6, 0, pA),    r: lerp(-2,-6, pB) },
  };

  const mixBlast = (base, i) => ({
    x: base.x + lerp(0, blast[i].dx, pC),
    y: base.y + lerp(0, blast[i].dy, pC),
    r: base.r + lerp(0, blast[i].rot, pC),
    s: 1 + lerp(0, 0.04, pC),
    o: 1 - lerp(0, 0.45, pC),
  });

  // Analytics items
  const metricsItems = [
    { icon: <BarChart3 size={24} />, title: "Visual Data Dashboard", desc: "Charts that drive action." },
    { icon: <Target size={24} />,    title: "Goal Tracking",        desc: "Targets for calories, macros & micros." },
    { icon: <Activity size={24} />,  title: "Health Score",         desc: "Balance & adherence as one number." },
    { icon: <Clock size={24} />,     title: "Historical Trends",    desc: "Spot patterns across weeks & months." },
  ];

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", sans-serif',
        background: "linear-gradient(180deg,#FFF7EA 0%, #FFF1DB 100%)",
        color: "#1A1A1A",
        minHeight: "100vh",
      }}
    >
      {/* NAV */}
      <nav
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
          backgroundColor: scrollY > 50 ? "rgba(255, 247, 234, 0.9)" : "transparent",
          backdropFilter: scrollY > 50 ? "saturate(1.2) blur(8px)" : "none",
          borderBottom: scrollY > 50 ? "1px solid rgba(26, 26, 26, 0.06)" : "none",
          transition: "all .25s ease", padding: "1.1rem 0",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-.02em" }}>Caloreeat</div>
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            <a href="#features" style={{ color: "#5b5146", textDecoration: "none", fontWeight: 600 }}>Features</a>
            <a href="#metrics" style={{ color: "#5b5146", textDecoration: "none", fontWeight: 600 }}>Analytics</a>
            <button
  style={{
    padding: "0.7rem 1.3rem",
    background: "#1A1A1A",
    color: "#FFF",
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
    transition: "transform 0.2s",
  }}
  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
  onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
  onClick={() => navigate("/login")} // ✅ navigate works now
>
  Get Started
</button>

          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" ref={heroRef} style={{ minHeight: "88vh", display: "grid", placeItems: "center", padding: "8rem 2rem 4rem", position: "relative" }}>
        <div style={{ position: "absolute", top: "12%", right: "6%", width: 420, height: 420, background: "radial-gradient(circle, rgba(26,26,26,.06), transparent 70%)", borderRadius: "50%", filter: "blur(60px)" }} />
        <div style={{ textAlign: "center", maxWidth: 1000, zIndex: 1 }}>
          <div style={{ display: "inline-block", padding: "8px 14px", background: "rgba(26,26,26,.05)", borderRadius: 999, fontWeight: 700, color: "#6a5a45", marginBottom: 16 }}>
            NUTRITION ANALYTICS PLATFORM
          </div>
          <h1 style={{ fontSize: "clamp(44px,8vw,96px)", margin: 0, lineHeight: 1, letterSpacing: "-.04em" }}>
            TRACK NUTRITION<br />
            <span style={{ background: "linear-gradient(135deg,#1A1A1A,#6a5a45)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              WITH PRECISION
            </span>
          </h1>
          <p style={{ margin: "16px auto 28px", maxWidth: 720, color: "#6a5a45", fontSize: "clamp(16px,2vw,20px)" }}>
            Manual entry made effortless. Macros, micros, and calories in one sleek flow. Share progress and get insights that matter.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button style={{ padding: "14px 22px", background: "#1A1A1A", color: "#fff", borderRadius: 12, border: "none", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
              Start Tracking <ArrowRight size={18} />
            </button>
            <button style={{ padding: "12px 20px", background: "transparent", color: "#1A1A1A", borderRadius: 12, border: "2px solid #1A1A1A", fontWeight: 700 }}>
              View Demo
            </button>
          </div>
        </div>
      </section>

      {/* ================= STACKED CARDS (4 compact, no white photo tiles) ================ */}
      <section id="features" ref={stackRef} style={{ position: "relative", height: "220vh", padding: "0 16px" }}>
        <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", display: "grid", placeItems: "center" }}>
          {/* Card canvas */}
          <div style={{ position: "relative", width: CARD_W, height: CARD_H, transformStyle: "preserve-3d", perspective: 1200 }}>
            {/* Left (Social) */}
            {(() => {
              const base = mixBlast({ x: fan.left.x, y: fan.left.y, r: fan.left.r }, 3);
              return (
                <CardShell
                  style={{
                    transform: `translate(${base.x}px, ${base.y}px) rotate(${base.r}deg) scale(${base.s})`,
                    opacity: base.o, transition: "transform .06s linear", zIndex: 3,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Social Accountability</h3>
                    <ul style={{ margin: 4, paddingLeft: 16, color: "#E0E0E0", lineHeight: 1.5, fontSize: 12 }}>
                      <li>Daily progress sharing</li>
                      <li>Achievement streaks</li>
                      <li>Private communities</li>
                      <li>Goal challenges</li>
                    </ul>
                  </div>
                </CardShell>
              );
            })()}

            {/* Right (Analysis) */}
            {(() => {
              const base = mixBlast({ x: fan.right.x, y: fan.right.y, r: fan.right.r }, 2);
              return (
                <CardShell
                  style={{
                    transform: `translate(${base.x}px, ${base.y}px) rotate(${base.r}deg) scale(${base.s})`,
                    opacity: base.o, transition: "transform .06s linear", zIndex: 4,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Complete Nutritional Analysis</h3>
                    <ul style={{ margin: 4, paddingLeft: 16, color: "#E0E0E0", lineHeight: 1.5, fontSize: 12 }}>
                      <li>18+ micronutrients tracked</li>
                      <li>TDEE calculations</li>
                      <li>Goal recommendations</li>
                      <li>Deficiency alerts</li>
                    </ul>
                  </div>
                </CardShell>
              );
            })()}

            {/* Mid (Manual Entry) */}
            {(() => {
              const base = mixBlast({ x: fan.mid.x, y: fan.mid.y, r: fan.mid.r }, 1);
              return (
                <CardShell
                  style={{
                    transform: `translate(${base.x}px, ${base.y}px) rotate(${base.r}deg) scale(${base.s})`,
                    opacity: base.o, transition: "transform .06s linear", zIndex: 5,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Manual Entry Made Simple</h3>
                    <ul style={{ margin: 4, paddingLeft: 16, color: "#E0E0E0", lineHeight: 1.5, fontSize: 12 }}>
                      <li>Quick templates</li>
                      <li>Favorites library</li>
                      <li>Custom portions</li>
                      <li>Bulk entry</li>
                    </ul>
                  </div>
                </CardShell>
              );
            })()}

            {/* Top (Onboarding) */}
            {(() => {
              const base = mixBlast({ x: fan.top.x, y: fan.top.y, r: fan.top.r }, 0);
              return (
                <CardShell
                  style={{
                    transform: `translate(${base.x}px, ${base.y}px) rotate(${base.r}deg) scale(${base.s})`,
                    opacity: base.o, transition: "transform .06s linear", zIndex: 6,
                    background: "rgba(18,18,18,0.86)", border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, letterSpacing: ".14em", color: "#D7CCB8", marginBottom: 6 }}>
                      GET STARTED
                    </div>
                    <h3 style={{ margin: 0, fontSize: 18 }}>Create account → Add meals → See insights</h3>
                    <ol style={{ margin: "6px 0 0", paddingLeft: 16, lineHeight: 1.55, color: "#F2F2F2", fontSize: 12 }}>
                      <li><b>Sign up</b> with email/Google & choose goal.</li>
                      <li><b>Add meals</b> via templates & favorites.</li>
                      <li><b>Open Analytics</b> for calories vs TDEE & trends.</li>
                    </ol>
                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid #EADCC4", background: "#FFF7EA", color: "#1A1A1A", fontWeight: 700, fontSize: 12 }}>
                        Create my account
                      </button>
                      <button style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.25)", background: "transparent", color: "#fff", fontWeight: 700, fontSize: 12 }}>
                        Try demo
                      </button>
                    </div>
                  </div>
                </CardShell>
              );
            })()}
          </div>

          <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", fontSize: 12, color: "#6a5a45" }}>
            Scroll to explore • {Math.round((p / 3) * 100)}%
          </div>
        </div>
      </section>

      {/* ANALYTICS */}
      <section id="metrics" style={{ padding: "90px 20px", background: "#FFF7EA", borderTop: "1px solid rgba(26,26,26,.06)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 style={{ fontFamily: 'ui-serif, Georgia, "Times New Roman", serif', fontSize: "clamp(38px,5vw,68px)", margin: 0, letterSpacing: "-.02em", color: "#1A1A1A" }}>
              POWERFUL ANALYTICS
            </h2>
            <p style={{ color: "#5b5146", marginTop: 8 }}>
              See calories vs TDEE, macro balance and long-term trends — at a glance.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 16 }}>
            {[
              { span: 7, label: "Daily Overview" },
              { span: 5, label: "Macro Distribution" },
              { span: 6, label: "Trend Analysis" },
              { span: 6, label: "Insights & Notes" },
            ].map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24, rotate: 0.3 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ amount: 0.4, once: false }}
                whileHover={{ y: -6, rotate: 0.25, scale: 1.01, transition: { type: "spring", stiffness: 220, damping: 18 } }}
                style={{
                  gridColumn: `span ${b.span}`,
                  background: "#FFFFFF",
                  borderRadius: 18,
                  border: "1px solid rgba(26,26,26,.08)",
                  padding: 20,
                  boxShadow: "0 14px 44px rgba(0,0,0,.06)",
                  display: "grid",
                  placeItems: "center",
                  minHeight: i === 0 ? 220 : 180,
                  fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
                  color: "#1A1A1A",
                }}
              >
                {b.label}
              </motion.div>
            ))}
          </div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ amount: 0.3, once: false }}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
            style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginTop: 24 }}
          >
            {metricsItems.map((m, idx) => (
              <motion.div
                key={idx}
                variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ y: -4, scale: 1.01 }}
                style={{ background: "#FAF4E6", border: "1px solid rgba(26,26,26,.06)", borderRadius: 16, padding: 16, display: "grid", gap: 8 }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#1A1A1A", color: "#FFF", display: "grid", placeItems: "center" }}>
                  {m.icon}
                </div>
                <div style={{ fontWeight: 800 }}>{m.title}</div>
                <div style={{ color: "#5b5146" }}>{m.desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "80px 20px", background: "#1A1A1A", color: "#FFF", textAlign: "center" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(32px,5vw,56px)", margin: "0 0 10px" }}>READY TO START TRACKING?</h2>
          <p style={{ opacity: 0.8, marginBottom: 24 }}>Join thousands achieving their nutrition goals with precision tracking</p>
          <button
            style={{ padding: "16px 28px", background: "#FFF", color: "#1A1A1A", border: "none", borderRadius: 12, fontWeight: 800 }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            Get Started Free
          </button>
          <p style={{ marginTop: 14, opacity: 0.6, fontSize: 14 }}>No credit card required · 14-day free trial</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "40px 20px", background: "#FFF7EA", borderTop: "1px solid rgba(26,26,26,.06)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>Caloreeat</div>
            <p style={{ color: "#6a5a45" }}>Precision nutrition tracking for serious results</p>
          </div>
          {[
            { title: "Product", links: ["Features", "Pricing", "Updates", "API"] },
            { title: "Company", links: ["About", "Blog", "Careers", "Press"] },
            { title: "Resources", links: ["Docs", "Help Center", "Community", "Contact"] },
          ].map((col, idx) => (
            <div key={idx}>
              <h4 style={{ fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", fontSize: 12 }}>{col.title}</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 8 }}>
                {col.links.map((link, i) => (
                  <li key={i}><a href="#" style={{ color: "#6a5a45", textDecoration: "none" }}>{link}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ maxWidth: 1200, margin: "16px auto 0", color: "#6a5a45", fontSize: 13 }}>
          © {new Date().getFullYear()} Caloreeat. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
