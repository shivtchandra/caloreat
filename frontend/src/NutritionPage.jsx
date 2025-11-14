// src/NutritionHistory.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { db } from "./firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import PageTransition from "./components/PageTransition";
import MealMacroBar from "./components/MealMacroBar";
import { LoaderOverlay, SushiConveyorLoader } from "./components/loaders.jsx";

export default function NutritionHistory() {
  const user = getAuth().currentUser;
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // fetch with single orderBy to avoid composite index requirement
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const qRef = query(
          collection(db, "users", user.uid, "daily_logs"),
          orderBy("date", "desc") // <-- single field (composite not required)
        );
        const snap = await getDocs(qRef);
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // within each date, sort by timestamp desc locally
        data.sort((a, b) => {
          if (a.date === b.date) {
            return (b.timestamp || 0) - (a.timestamp || 0);
          }
          // keep date-desc grouping (already ensured by Firestore)
          return (a.date < b.date) ? 1 : -1;
        });
        setLogs(data);
      } catch (e) {
        console.error("NutritionHistory fetch error:", e);
      } finally {
        // keep the loader visible at least ~1.2s for a pleasant feel
        setTimeout(() => setLoading(false), 1200);
      }
    })();
  }, [user]);

  const grouped = useMemo(() => {
    const out = {};
    for (const entry of logs) {
      if (!entry?.date || entry.category !== "meal") continue;
      if (!out[entry.date]) out[entry.date] = [];
      out[entry.date].push(entry);
    }
    return out;
  }, [logs]);

  const dates = useMemo(() => Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1)), [grouped]);

  // small helpers to compute per-day totals
  const dayTotals = (arr) => {
    const tot = arr.reduce(
      (acc, m) => {
        const mac = m.macros || {};
        acc.cal += Number(m.calories ?? mac.calories_kcal ?? 0) || 0;
        acc.p += Number(mac.protein_g ?? 0) || 0;
        acc.c += Number(mac.total_carbohydrate_g ?? mac.carbs_g ?? 0) || 0;
        acc.f += Number(mac.total_fat_g ?? mac.fats_g ?? 0) || 0;
        return acc;
      },
      { cal: 0, p: 0, c: 0, f: 0 }
    );
    return {
      cal: Math.round(tot.cal),
      p: Math.round(tot.p),
      c: Math.round(tot.c),
      f: Math.round(tot.f),
    };
  };

  return (
    <PageTransition>
      <LoaderOverlay open={loading} label="Building your history…">
        <SushiConveyorLoader />
      </LoaderOverlay>

      <div style={{ minHeight: "100vh", padding: 24, background: "linear-gradient(#fffaf2,#fff2e0)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h1 style={{ fontWeight: 800, fontSize: 26, color: "#4b4033", marginBottom: 18 }}>
            Nutrition History 📅
          </h1>

          {/* Empty state */}
          {!loading && dates.length === 0 && (
            <div
              style={{
                padding: 20,
                borderRadius: 16,
                border: "1px solid #f0e4c9",
                background: "#fff",
                color: "#6b6257",
              }}
            >
              No meals found yet. Log something tasty!
            </div>
          )}

          {dates.map((d) => {
            const meals = grouped[d] || [];
            const t = dayTotals(meals);
            return (
              <div
                key={d}
                style={{
                  marginBottom: 18,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.82)",
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
                  border: "1px solid #f0e4c9",
                }}
              >
                {/* date header + stats */}
                <div
                  style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #f3ead4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#4b4033", fontSize: 16 }}>{d}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      ["🔥", `${t.cal} kcal`],
                      ["🍗", `${t.p}g P`],
                      ["🍚", `${t.c}g C`],
                      ["🧈", `${t.f}g F`],
                    ].map(([icon, text], i) => (
                      <div
                        key={i}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: "#fffaf0",
                          border: "1px solid #f0e4c9",
                          color: "#4b4033",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <span style={{ marginRight: 6 }}>{icon}</span>
                        {text}
                      </div>
                    ))}
                  </div>
                </div>

                {/* meals list */}
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {meals.map((meal) => (
                    <MealMacroBar key={meal.id} meal={meal} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageTransition>
  );
}
