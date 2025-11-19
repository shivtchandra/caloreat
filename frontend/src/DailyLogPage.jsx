// src/DailyLogPage.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Utensils, Droplet, Activity, Moon } from "lucide-react";
import { getAuth } from "firebase/auth";
import { createDailyLog, getDailyLogs, updateDailyLog, deleteDailyLog } from "./firebaseHelpers";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebaseConfig";
import StickerField from "./StickerField.jsx";
import CardStackPage from "./CardStackPage.jsx";
import AISummaryDisplay from "./AISummaryDisplay.jsx";
import MealMacroBar from "./components/MealMacroBar";
import { motion, AnimatePresence } from "framer-motion";

// ✅ use your shared loader primitives
import { LoaderOverlay, FruitFlipLoader } from "./components/loaders.jsx";

export default function DailyLogPage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const user = auth.currentUser;

  const [selectedCategory, setSelectedCategory] = useState("Meal");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [waterMl, setWaterMl] = useState("");
  const [steps, setSteps] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false); // only affects button text
  const [analyzing, setAnalyzing] = useState(false);
  const [manualCalories, setManualCalories] = useState("");
  const [dailySummary, setDailySummary] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [filteredLogs, setFilteredLogs] = useState([]);

  const logsContainerRef = useRef(null);
  const [visibleLogIds, setVisibleLogIds] = useState(new Set());

  const [dbRefreshing, setDbRefreshing] = useState(false);

  // Global busy overlay + toast
  const [isBusy, setIsBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Working…");
  const [toast, setToast] = useState(null); // { message, icon? }
  const hideToast = useCallback(() => setToast(null), []);

  const categories = [
    { name: "Meal", icon: Utensils, bgColor: "#f0d6a3", hoverColor: "#e8c98b", textColor: "#5c4f3f" },
    { name: "Water", icon: Droplet, bgColor: "#a3d5f0", hoverColor: "#8bc9e8", textColor: "#2c5f7f" },
    { name: "Activity", icon: Activity, bgColor: "#bddfa3", hoverColor: "#a8d38b", textColor: "#3f5c2c" },
    { name: "Sleep", icon: Moon, bgColor: "#d6bdf0", hoverColor: "#c9a8e8", textColor: "#5c3f7f" }
  ];

  /* ---------- Responsive hook & computed styles (inline) ---------- */
  function useWindowSize() {
    const [size, setSize] = useState({
      width: typeof window !== "undefined" ? window.innerWidth : 1200,
      height: typeof window !== "undefined" ? window.innerHeight : 800
    });
    useEffect(() => {
      function onResize() {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      }
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);
    return size;
  }
  const { width } = useWindowSize();
  const isMobile = width < 768;
  const isSmall = width < 420;

  // base spacing multipliers
  const spacing = useMemo(() => ({
    pagePadding: isMobile ? 12 : 32,
    cardPadding: isMobile ? 12 : 24,
    gap: isMobile ? 10 : 16,
  }), [isMobile]);

  // computed styles used across many inline style objects
  const styles = useMemo(() => ({
    pageWrap: {
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #fffaf3 0%, #fff2e2 90%)',
      padding: `${spacing.pagePadding}px`,
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box'
    },
    centerOuter: {
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      padding: isMobile ? '16px 10px' : '2rem 1rem',
      boxSizing: 'border-box'
    },
    centerInner: {
      width: '100%',
      maxWidth: 1152,
      boxSizing: 'border-box'
    },
    headerRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: isMobile ? 12 : 24,
      position: 'relative',
      zIndex: 10,
      gap: isMobile ? 8 : 16
    },
    titleCenter: {
      textAlign: 'center',
      flex: "1",
      marginLeft: isMobile ? 12 : 24,
      marginRight: isMobile ? 12 : 24
    },
    titleText: {
      fontSize: isMobile ? '1.25rem' : '2rem',
      fontWeight: 'bold',
      color: '#5c4f3f',
      marginBottom: '0.25rem'
    },
    subtitle: {
      fontSize: isMobile ? '0.775rem' : '0.875rem',
      color: '#6b7280'
    },
    btnFloatingBase: {
      border: 'none',
      borderRadius: 10,
      padding: isMobile ? '8px 12px' : '10px 18px',
      fontSize: isMobile ? 14 : 15,
      cursor: 'pointer',
      transition: 'all 0.25s ease',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      backgroundColor: '#eae4da',
      color: '#4b4033'
    },
    glassCard: {
      borderRadius: '1.5rem',
      padding: `${spacing.cardPadding}px`,
      width: '100%',
      boxSizing: 'border-box',
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      boxShadow: '0 10px 30px rgba(16,24,40,0.06)'
    },
    quickAddOuter: {
      margin: "0 0 12px 0",
      padding: isMobile ? 12 : 14,
      borderRadius: 16,
      background: "linear-gradient(180deg,#fffdf7 0%, #fff7e8 100%)",
      border: "1px solid #f5e6c8",
      boxShadow: "0 8px 24px rgba(0,0,0,0.04)"
    },
    quickFoodsGrid: {
      display: 'grid',
      gap: 10,
      gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))',
    },
    quickFoodBtn: {
      textAlign: 'left',
      border: '1px solid #f0e4c9',
      borderRadius: 14,
      padding: isMobile ? 10 : 12,
      cursor: 'pointer',
      background: '#ffffff',
      boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
      transition: 'transform 160ms ease, box-shadow 160ms ease',
    },
    dropZoneWide: {
      margin: "10px auto 16px",
      maxWidth: 720,
      padding: "10px 12px",
      border: "1px dashed #e6d7bd",
      background: "#fffaf4",
      borderRadius: 12,
      textAlign: "center",
      color: "#7a6a58",
      fontSize: 13,
    },
    categoryGrid: {
      display: 'grid',
      gap: 12,
      gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))'
    },
    categoryBtn: (isSelected, cat) => ({
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '1rem',
      padding: isMobile ? '0.75rem' : '1rem',
      backgroundColor: isSelected ? cat.bgColor : '#f9fafb',
      border: 'none',
      cursor: 'pointer',
      boxShadow: isSelected ? '0 8px 16px rgba(0,0,0,0.1)' : '0 2px 6px rgba(0,0,0,0.04)',
      transform: isSelected ? 'scale(1.03)' : 'scale(1)',
      transition: 'transform 180ms ease, box-shadow 180ms ease'
    }),
    formGridOne: {
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: 12
    },
    inputBase: {
      width: '100%',
      backgroundColor: '#f9fafb',
      border: '1px solid #e0e0e0',
      borderRadius: '0.75rem',
      padding: isMobile ? '0.6rem 0.8rem' : '0.75rem 1rem',
      fontSize: isMobile ? '0.9rem' : '0.875rem',
      color: '#374151',
      boxSizing: 'border-box'
    },
    smallInput: {
      width: '100%',
      backgroundColor: '#f9fafb',
      border: '1px solid #e0e0e0',
      borderRadius: '0.5rem',
      padding: isMobile ? '0.4rem 0.6rem' : '0.5rem 0.75rem',
      fontSize: isMobile ? '0.85rem' : '0.875rem',
      color: '#374151',
      boxSizing: 'border-box'
    },
    qtyControls: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem'
    },
    qtyBtn: {
      width: isSmall ? '2.6rem' : '3rem',
      height: isSmall ? '2.6rem' : '3rem',
      borderRadius: '0.75rem',
      backgroundColor: '#f3f4f6',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#374151',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontSize: isSmall ? '1rem' : '1.25rem'
    },
    qtyInput: {
      flex: 1,
      backgroundColor: "#f9fafb",
      border: "1px solid #e0e0e0",
      borderRadius: "0.75rem",
      padding: isMobile ? '0.55rem' : "0.75rem",
      textAlign: "center",
      fontSize: isMobile ? '1.15rem' : "1.5rem",
      fontWeight: "bold",
      color: "#374151",
      boxSizing: 'border-box'
    },
    addBtn: {
      width: '100%',
      backgroundColor: '#bca987',
      color: 'white',
      fontWeight: 600,
      padding: isMobile ? '0.9rem' : '1rem',
      borderRadius: '0.75rem',
      border: 'none',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      transition: 'all 0.2s'
    },
    hr: {
      margin: isMobile ? '1rem 0' : '1.5rem 0',
      border: 'none',
      borderTop: '1px solid #e5e7eb'
    },
    datePickerRow: {
      marginBottom: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: isMobile ? 8 : 12,
      flexWrap: 'wrap'
    },
    dateInput: {
      border: '1px solid #d1d5db',
      borderRadius: '0.5rem',
      padding: isMobile ? '0.45rem 0.6rem' : '0.5rem 0.75rem',
      fontSize: isMobile ? '0.85rem' : '0.9rem',
      color: '#374151',
      background: '#fff',
      boxSizing: 'border-box'
    },
    logsArea: {
      marginTop: isMobile ? 8 : 12,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      zIndex: 15,
      gap: isMobile ? 10 : 12,
      paddingBottom: 20
    },
    viewNutritionBtn: {
      padding: isMobile ? '8px 10px' : '8px 12px',
      borderRadius: 10,
      border: '1px solid #e5d8bf',
      background: '#fff7e8',
      color: '#4b4033',
      fontWeight: 600
    },
    toast: {
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10001,
      padding: '10px 14px',
      borderRadius: 12,
      background: '#1f2937',
      color: 'white',
      boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
      cursor: 'pointer'
    },
    dbRefreshCorner: {
      position: "fixed",
      top: 12,
      right: 12,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      fontSize: isMobile ? 22 : 26
    },
    stackedCard: {
      position: 'absolute',
      width: isMobile ? '94%' : '86%',
      maxWidth: 820,
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      borderRadius: 18,
      pointerEvents: 'auto'
    },
    cardHalo: {
      position: 'absolute',
      inset: isMobile ? 'auto 4% -6% 4%' : 'auto 6% -8% 6%',
      height: isMobile ? 160 : 220,
      borderRadius: 24,
      zIndex: -1,
      pointerEvents: 'none',
      filter: 'blur(36px)',
      opacity: 0.65,
      transition: 'opacity 180ms ease',
      background: 'radial-gradient(60% 50% at 50% 40%, rgba(30,30,30,0.12) 0%, rgba(30,30,30,0.06) 20%, rgba(30,30,30,0.01) 60%, transparent 100%)',
      transformOrigin: 'center'
    }
  }), [isMobile, isSmall, spacing.cardPadding, spacing.pagePadding]);

  /* ---------- helpers ---------- */
  const getCategoryIcon = (category) => {
    switch ((category || "").toLowerCase()) {
      case "meal": return <Utensils className="w-4 h-4" />;
      case "water": return <Droplet className="w-4 h-4" />;
      case "activity": return <Activity className="w-4 h-4" />;
      case "sleep": return <Moon className="w-4 h-4" />;
      default: return <Utensils className="w-4 h-4" />;
    }
  };

  const resetForm = () => {
    setName("");
    setQuantity("1");
    setWaterMl("");
    setSteps("");
    setSleepHours("");
    setManualCalories("");
  };

  // Centralized refresh (updates both logs + filteredLogs)
  const refreshLogs = useCallback(async () => {
    if (!user?.uid) return;
    const data = await getDailyLogs(user.uid);
    const safe = Array.isArray(data) ? data : [];
    setLogs(safe);
    const chosen = selectedDate || new Date().toLocaleDateString("en-CA");
    setFilteredLogs(safe.filter((l) => l.date === chosen));
  }, [user, selectedDate]);

  // Busy wrapper with minimum duration + optional post-refresh + toast
  async function withBusy(fn, { label = "Working…", min = 900, refresh = false, toastMessage } = {}) {
    const start = performance.now();
    setBusyLabel(label);
    setIsBusy(true);
    try {
      await fn();
      if (refresh) {
        await refreshLogs();
      }
      const elapsed = performance.now() - start;
      const wait = Math.max(0, min - elapsed);
      await new Promise((r) => setTimeout(r, wait));
      if (toastMessage) {
        setToast({ message: toastMessage });
        setTimeout(() => setToast(null), 2200);
      }
    } finally {
      setIsBusy(false);
    }
  }

  function toastSuccess(message, icon = "✅") {
    setToast({ message, icon });
    setTimeout(() => setToast(null), 2200);
  }

  // Navigation with loader overlay
  const navigateWithLoader = useCallback((to, label = "Loading…") => {
    withBusy(async () => {
      // small delay to let loader animate before route swap
      await new Promise((r) => setTimeout(r, 300));
      navigate(to);
    }, { label, min: 800 });
  }, [navigate]);

  // Quick-Add + DnD
  // --- quick-add built-ins (unchanged) ---
// --- quick-add built-ins (unchanged except added grams) ---
const QUICK_FOODS_BUILTIN = [
  { name: "rice", emoji: "🍚", quantity: 1, grams: 200 },
  { name: "chapati (1 pc)", emoji: "🫓", quantity: 1, grams: 60 },
  { name: "dal (1 bowl)", emoji: "🍲", quantity: 1, grams: 250 },
  { name: "paneer (100g)", emoji: "🧀", quantity: 1, grams: 100 },
  { name: "chicken curry (150g)", emoji: "🍛", quantity: 1, grams: 150 },
  { name: "eggs (2 pcs)", emoji: "🥚", quantity: 1, grams: 100 },
  { name: "curd (100g)", emoji: "🥛", quantity: 1, grams: 100 },
  { name: "salad (1 bowl)", emoji: "🥗", quantity: 1, grams: 150 },
  { name: "apple", emoji: "🍎", quantity: 1, grams: 180 },
  { name: "banana", emoji: "🍌", quantity: 1, grams: 120 },
  { name: "chicken biryani (500g)", quantity: 1, grams: 750 }
];


// --- localStorage key for custom presets ---
// localStorage key for custom presets
const QUICK_CUSTOM_KEY = "dailylog_custom_quickfoods_v1";

// combined quick foods (builtin + custom from localStorage)
const [quickFoods, setQuickFoods] = useState(() => {
  try {
    const raw = localStorage.getItem(QUICK_CUSTOM_KEY);
    const custom = raw ? JSON.parse(raw) : [];
    const normalizedCustom = Array.isArray(custom)
      ? custom.map((c) => ({ ...c, custom: true, grams: c.grams ?? 500 }))
      : [];
    return [...QUICK_FOODS_BUILTIN, ...normalizedCustom];
  } catch (e) {
    console.warn("Failed to load custom quick foods:", e);
    return [...QUICK_FOODS_BUILTIN];
  }
});

// UI state for the add custom form
const [showAddCustom, setShowAddCustom] = useState(false);
const [customName, setCustomName] = useState("");
const [customEmoji, setCustomEmoji] = useState("");
const [customQty, setCustomQty] = useState("1");
const [customGrams, setCustomGrams] = useState("500"); // default to 500g

// persist only custom items to localStorage
function persistCustomQuickFoods(allQuickFoods) {
  try {
    const custom = (allQuickFoods || []).filter((f) => f.custom).map(f => ({ ...f }));
    localStorage.setItem(QUICK_CUSTOM_KEY, JSON.stringify(custom));
  } catch (e) {
    console.warn("persistCustomQuickFoods failed:", e);
  }
}

function handleAddCustomPreset() {
  const nameTrimmed = (customName || "").trim();
  const qtyNum = Number(customQty) || 1;
  const gramsNum = Number(customGrams) || 500;
  if (!nameTrimmed) return alert("Please enter a name for your custom food.");
  if (!(qtyNum > 0)) return alert("Quantity must be > 0.");
  if (!(gramsNum > 0)) return alert("Grams must be > 0.");

  const newPreset = {
    id: `custom-${Date.now()}`,
    name: nameTrimmed,
    emoji: customEmoji || "🍽️",
    quantity: qtyNum,
    grams: gramsNum,
    custom: true
  };

  const next = [...quickFoods, newPreset];
  setQuickFoods(next);
  persistCustomQuickFoods(next);

  // reset & close
  setCustomName("");
  setCustomEmoji("");
  setCustomQty("1");
  setCustomGrams("500");
  setShowAddCustom(false);
}

function handleRemoveCustomPreset(preset) {
  if (!preset?.custom) return;
  if (!confirm(`Remove custom preset "${preset.name}"?`)) return;
  const next = quickFoods.filter((f) => f !== preset);
  setQuickFoods(next);
  persistCustomQuickFoods(next);
}


  async function quickAddFood(preset) {
    if (!user) throw new Error("Please log in first.");
    const basePayload = {
      item: preset.name,
      category: "meal",
      quantity: preset.quantity || 1,
      timestamp: Date.now(),
      date: new Date().toLocaleDateString("en-CA"),
      source_ui: "quick_add",
    };
    await createDailyLog(user.uid, basePayload);
    await refreshLogs();
    await analyzeItemsBackend([{ name: basePayload.item, quantity: basePayload.quantity }]);
    await refreshLogs();
  }

  function handlePresetDragStart(e, preset) {
    e.dataTransfer.setData("text/plain", JSON.stringify(preset));
    e.dataTransfer.effectAllowed = "copy";
  }
  function handleDropOnZone(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      if (data?.name) {
        withBusy(
          () => quickAddFood(data),
          { label: "Adding meal…", refresh: true, toastMessage: "Meal logged 🍽️" }
        );
      }
    } catch (_) {}
  }
  function allowDrop(e) { e.preventDefault(); }

  // Backend analyze
  async function analyzeItemsBackend(confirmedItems = []) {
    const ANALYZE_URL = "https://caloreat.onrender.com/api/run_nutrients";
    if (!user?.uid) {
      console.warn("analyzeItemsBackend: no logged-in user found");
      return null;
    }
    if (!Array.isArray(confirmedItems) || confirmedItems.length === 0) {
      console.warn("analyzeItemsBackend: no items provided");
      return null;
    }

    try {
      const resp = await fetch(ANALYZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: confirmedItems }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "<no body>");
        throw new Error(`run_nutrients failed: ${resp.status} ${txt}`);
      }
      const json = await resp.json();
      const results = Array.isArray(json) ? json : (json.results || []);
      if (!Array.isArray(results) || results.length === 0) return json;

      let currentLogs = Array.isArray(await getDailyLogs(user.uid)) ? await getDailyLogs(user.uid) : [];
      const normalize = (s = "") =>
        (s || "").toString().trim().toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");

      for (let i = 0; i < results.length; i++) {
        const analyzed = results[i];
        const analyzedName = normalize(analyzed.item || analyzed.name || "");
        const analyzedId = analyzed.id || null;

        const macros = analyzed.macros || {};
        const normalizedMacros = {
          calories_kcal: Number(analyzed.calories ?? macros.calories_kcal ?? macros.energy_kcal ?? 0) || 0,
          protein_g: Number(macros.protein_g ?? macros.protein ?? 0) || 0,
          total_carbohydrate_g: Number(macros.total_carbohydrate_g ?? macros.carbs ?? macros.total_carbs ?? 0) || 0,
          total_fat_g: Number(macros.total_fat_g ?? macros.fats ?? macros.total_fat ?? 0) || 0,
          ...macros,
        };

        let match = currentLogs.find(
          (l) => normalize(l.item || l.item_name || "") === analyzedName && (l.category || "meal") === "meal"
        );
        if (!match && analyzedId && /item-(\d+)/.test(analyzedId)) {
          const idx = parseInt(analyzedId.split("-")[1], 10) || 0;
          const sameDateMeals = currentLogs.filter((l) => (l.category || "").toLowerCase() === "meal");
          if (sameDateMeals[idx]) match = sameDateMeals[idx];
        }
        if (!match && analyzedName) {
          match =
            currentLogs.find((l) => normalize(l.item || "").includes(analyzedName)) ||
            currentLogs.find((l) => analyzedName.includes(normalize(l.item || "")));
        }
        if (!match) {
          const meals = currentLogs.filter((l) => (l.category || "").toLowerCase() === "meal");
          if (meals.length) match = meals.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
        }
        if (!match?.id) continue;

        const fullMacros = { ...normalizedMacros, raw: macros };
        try {
          await updateDailyLog(user.uid, match.id, {
            calories: fullMacros.calories_kcal,
            macros: fullMacros,
            provenance: analyzed.provenance ?? { source: analyzedId ? "analyzed" : "unknown" },
          });
        } catch (uErr) {
          console.error("analyzeItemsBackend: failed to update Firestore for", match.id, uErr);
        }
      }

      await refreshLogs();
      return json;
    } catch (err) {
      console.error("analyzeItemsBackend error:", err);
      return null;
    }
  }

  /* ---------- Fetch logs on mount ---------- */
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      try {
        const data = await getDailyLogs(user.uid);
        if (mounted) {
          const safe = Array.isArray(data) ? data : [];
          setLogs(safe);
          const today = new Date().toLocaleDateString("en-CA");
          setFilteredLogs(safe.filter((l) => l.date === today));
        }
      } catch (e) {
        console.error("Failed to fetch daily logs:", e);
      }
    })();
    return () => (mounted = false);
  }, [user]);

  // Auto-refresh when backend food DB updates
  useEffect(() => {
    if (!user) return;

    let prevVersion = null;
    let active = true;

    const check = async () => {
      if (!active) return;
      try {
        const res = await fetch("https://caloreat.onrender.com/api/meta/version", { cache: "no-store" });
        const j = await res.json();

        if (prevVersion === null) {
          prevVersion = j.version;
        } else if (prevVersion !== j.version) {
          prevVersion = j.version;
          setDbRefreshing(true);

          setTimeout(async () => {
            await refreshLogs();
            setDbRefreshing(false);
          }, 1800);
        }
      } catch (_) {}

      setTimeout(check, 4000);
    };

    check();
    return () => { active = false };
  }, [user, refreshLogs]);

  /* ---------- Handlers ---------- */
  const handleAddLog = async () => {
    if (!user) throw new Error("Please log in first.");
    if (selectedCategory === "Meal" && !name.trim()) {
      throw new Error("Please enter a meal name.");
    }

    setLoading(true); // button text only
    try {
      const basePayload = {
        item: name || (selectedCategory !== "Meal" ? selectedCategory : ""),
        category: (selectedCategory || "meal").toString().toLowerCase(),
        quantity: Number(quantity) || 1,
        timestamp: Date.now(),
        date: new Date().toLocaleDateString("en-CA"),
      };

      if (basePayload.category === "meal" && manualCalories !== "") {
        const manualVal = Number(manualCalories);
        if (!Number.isNaN(manualVal) && manualVal > 0) {
          basePayload.calories = manualVal;
          basePayload.manual_calories = manualVal;
        }
      }

      if (basePayload.category === "water") {
        const explicitMl = waterMl !== "" ? Number(waterMl) : null;
        basePayload.water_ml = explicitMl && !Number.isNaN(explicitMl)
          ? explicitMl
          : (Number(quantity) || 0) * 250;
      }

      if (basePayload.category === "activity" && steps) basePayload.steps = Number(steps) || 0;
      if (basePayload.category === "sleep" && sleepHours) basePayload.sleep_hours = Number(sleepHours) || 0;

      await createDailyLog(user.uid, basePayload);
      await refreshLogs();
      resetForm();

      if (basePayload.category === "meal") {
        try {
          const confirmed = [{
            name: basePayload.item,
            quantity: basePayload.quantity,
            ...(basePayload.manual_calories ? { manual_calories: basePayload.manual_calories } : {})
          }];
          await analyzeItemsBackend(confirmed);
          await refreshLogs();
        } catch (anErr) {
          console.error("Failed to analyze/update created meal:", anErr);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeToday = async () => {
    if (!user) return alert("Please log in first.");
    setAnalyzing(true);
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const q = query(
        collection(db, "users", user.uid, "daily_logs"),
        where("date", "==", today),
        where("category", "==", "meal")
      );
      const snapshot = await getDocs(q);
      const meals = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      if (meals.length === 0) {
        alert("No meals logged today to analyze.");
        setAnalyzing(false);
        return { success: false, reason: "no_meals" };
      }

      const items = meals.map(m => ({
        name: m.item || m.item_name || "Uncategorized",
        quantity: m.quantity || 1,
        portion_mult: m.portion_mult || 1,
        manual_calories: m.manual_calories ?? m.calories ?? undefined,
      }));

      const response = await fetch("https://caloreat.onrender.com/api/run_nutrients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Backend analysis failed: ${txt}`);
      }
      const result = await response.json();

      const analyses = Array.isArray(result) ? result : (result.results || []);

      for (const analyzed of analyses) {
        try {
          const analyzedName = (analyzed.item || analyzed.name || "").toString().trim().toLowerCase();
          let match = meals.find(m => (m.item || "").toString().trim().toLowerCase() === analyzedName);
          if (!match && analyzed.id && analyzed.id.startsWith("item-")) {
            const idx = parseInt(analyzed.id.split("-")[1] || "0", 10);
            match = meals[idx];
          }

          if (match?.id) {
            const fullMacros = {
              calories_kcal: analyzed.calories ?? analyzed.macros?.calories_kcal ?? analyzed.macros?.calories ?? 0,
              protein_g: analyzed.macros?.protein_g ?? analyzed.macros?.protein ?? 0,
              carbs_g: analyzed.macros?.total_carbohydrate_g ?? analyzed.macros?.carbs ?? 0,
              fats_g: analyzed.macros?.total_fat_g ?? analyzed.macros?.fats ?? 0,
              fiber_g: analyzed.macros?.dietary_fiber_g ?? analyzed.macros?.fiber_g ?? 0,
              sugars_g: analyzed.macros?.sugars_g ?? 0,
              sodium_mg: analyzed.macros?.sodium_mg ?? 0,
              calcium_mg: analyzed.macros?.calcium_mg ?? 0,
              iron_mg: analyzed.macros?.iron_mg ?? 0,
              vitamin_c_mg: analyzed.macros?.vitamin_c_mg ?? 0,
              potassium_mg: analyzed.macros?.potassium_mg ?? 0,
              cholesterol_mg: analyzed.macros?.cholesterol_mg ?? 0,
              ...analyzed.macros,
            };
            await updateDailyLog(user.uid, match.id, {
              calories: fullMacros.calories_kcal,
              macros: fullMacros,
              provenance: analyzed.provenance ?? match.provenance,
            });
          } else {
            const fuzzy = meals.find(m => analyzedName && (m.item || "").toString().toLowerCase().includes(analyzedName));
            if (fuzzy?.id) {
              await updateDailyLog(user.uid, fuzzy.id, {
                calories: analyzed.calories ?? (analyzed.macros && (analyzed.macros.calories_kcal || analyzed.macros.calories)) ?? fuzzy.calories,
                macros: analyzed.macros ?? fuzzy.macros,
                provenance: analyzed.provenance ?? fuzzy.provenance,
              });
            }
          }
        } catch (inner) {
          console.warn("Failed to update log with analysis:", inner, analyzed);
        }
      }

      await refreshLogs();
      toastSuccess("Analysis updated ✅");
      return { success: true, analyses };
    } catch (err) {
      console.error("Analysis failed:", err);
      alert("Failed to analyze meals.");
      return { success: false, error: err };
    } finally {
      setAnalyzing(false);
    }
  };

  // Poll helper
  async function pollForSummary(userId, dateIso, { interval = 1500, maxAttempts = 20 } = {}) {
    const statusUrl = (u, d) =>
      `https://caloreat.onrender.com/api/summarizeDaily/status?user_id=${encodeURIComponent(u)}&date=${encodeURIComponent(d)}`;
    let attempt = 0;
    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const res = await fetch(statusUrl(userId, dateIso));
        if (res.status === 200) {
          const json = await res.json();
          if (json && json.status === "complete" && json.summary) return json.summary;
        }
      } catch (err) {
        console.warn("pollForSummary fetch error (will retry):", err);
      }
      await new Promise((r) => setTimeout(r, interval + Math.floor(Math.random() * 500)));
      interval = Math.min(10000, Math.round(interval * 1.4));
    }
    throw new Error("Timed out waiting for summary");
  }

  const handleSummarizeToday = async () => {
    if (!user) return alert("Please log in first.");
    setAnalyzing(true);
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const q = query(collection(db, "users", user.uid, "daily_logs"), where("date", "==", today));
      const snapshot = await getDocs(q);
      const meals = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      if (meals.length === 0) {
        alert("No logs to summarize.");
        setAnalyzing(false);
        return;
      }

      const needsAnalysis = meals.some(m => !m.calories && (!m.macros || Object.keys(m.macros || {}).length === 0));
      if (needsAnalysis) await handleAnalyzeToday();

      const startRes = await fetch("https://caloreat.onrender.com/api/summarizeDaily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid, date: today, logs: meals, force_refresh: true }),
      });
      if (!startRes.ok) throw new Error(await startRes.text());

      let summary = null;
      try {
        summary = await pollForSummary(user.uid, today, { interval: 1500, maxAttempts: 30 });
      } catch (err) {
        console.warn("polling summary timed out or failed:", err);
      }

      if (!summary) {
        alert("Timed out waiting for summary 😕 — summary may be generating.");
        setAnalyzing(false);
        return;
      }

      const parsed = summary.parsed || summary;
      const humanText =
        (parsed && (parsed.raw_text || parsed.summary_text)) ||
        summary.human_summary ||
        summary.raw_ai_text_snippet ||
        (typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : (typeof parsed === "string" ? parsed : null)) ||
        "Summary available (see console).";

      setDailySummary({
        date: today,
        summary: humanText,
        structured: parsed,
        raw: summary.raw_ai_text_snippet || null,
        generated_at: new Date().toISOString(),
      });

      await Promise.all(
        meals.map(async (meal) => {
          try {
            await updateDailyLog(user.uid, meal.id, { ai_summary: humanText });
          } catch (err) {
            console.warn("Failed to attach ai_summary to meal", meal.id, err);
          }
        })
      );

      await refreshLogs();
      toastSuccess("Summary ready ✨");
    } catch (err) {
      console.error("Summarize failed:", err);
      alert("Failed to generate summary.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (log) => {
    if (!user) return alert("Please log in first.");
    if (!confirm(`Delete "${log.item}"?`)) return;

    await withBusy(
      async () => {
        await deleteDailyLog(user.uid, log.id);
      },
      { label: "Deleting…", min: 900, refresh: true, toastMessage: "Deleted 🗑️" }
    );
  };

  const handleEdit = async (log) => {
    if (!user) return alert("Please log in first.");
    const newName = prompt("Edit item name", log.item || "");
    if (newName === null) return;
    const newQty = prompt("Edit quantity", String(log.quantity || 1));
    if (newQty === null) return;

    const updateFields = { item: newName, quantity: Number(newQty) };

    if ((log.category || "").toLowerCase() === "meal") {
      const currentCal = log.manual_calories ?? log.calories ?? "";
      const newCalories = prompt("Edit calories (leave blank to keep/remove)", String(currentCal));
      if (newCalories === null) {
        // canceled
      } else if (newCalories.trim() === "") {
        updateFields.manual_calories = null;
        updateFields.calories = null;
      } else {
        const calNum = Number(newCalories);
        if (!Number.isNaN(calNum) && calNum > 0) {
          updateFields.manual_calories = calNum;
          updateFields.calories = calNum;
        }
      }
    }

    await withBusy(
      async () => {
        await updateDailyLog(user.uid, log.id, updateFields);
      },
      { label: "Updating…", min: 800, refresh: true, toastMessage: "Updated ✏️" }
    );
  };

  /* ---------- Render UI ---------- */
  return (
    <>
      {/* Global route-loader that uses your loader.jsx components */}
      <LoaderOverlay open={isBusy} label={busyLabel}>
        <FruitFlipLoader />
      </LoaderOverlay>

      {/* inline glass & small helper styles that remain constant */}
      <style>{`
        /* small global adjustments for form elements to behave consistently */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>

      <div style={styles.pageWrap}>
        <StickerField count={18} stickers={["🥗","🍎","🥑","🍌","🍓","🍞","💪","🏃‍♀️","🥕","🥛","🍳","🍪","🍇"]} seed={1234} />

        {/* DB-refresh spinner (corner) */}
        {dbRefreshing && (
          <div style={styles.dbRefreshCorner}>
            <motion.div style={{ fontSize: isMobile ? 26 : 32 }} animate={{ rotate: [0, 360] }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}>🍎</motion.div>
            <motion.div style={{ fontSize: isMobile ? 20 : 26 }} animate={{ rotate: [0, -360] }} transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}>🥗</motion.div>
          </div>
        )}

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={hideToast}
              style={styles.toast}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{toast.icon ?? "✅"}</span>
                <span style={{ fontWeight: 600 }}>{toast.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={styles.centerOuter}>
          <div style={styles.centerInner}>

            <div style={styles.headerRow}>
              <div style={{ minWidth: 80 }}>
                <button onClick={() => navigateWithLoader("/")} style={styles.btnFloatingBase}>← Back</button>
              </div>

              <div style={styles.titleCenter}>
                <h1 style={styles.titleText}>Daily Log</h1>
                <div style={styles.subtitle}>Quick log, analyze and view analytics</div>
              </div>

              <div style={{ minWidth: 80, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => navigateWithLoader("/app/activity", "Opening analytics…")} style={styles.btnFloatingBase}>
                  View →
                </button>
              </div>
            </div>

            <div style={styles.glassCard}>
              {dailySummary && (
                <AISummaryDisplay summary={dailySummary.structured || dailySummary.summary || dailySummary} />
              )}

              {/* Quick Add Grid */}
              <div style={styles.quickAddOuter}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: isMobile ? 16 : 18 }}>⚡</span>
                    <h3 style={{ margin: 0, fontSize: isMobile ? 14 : 16, color: "#4b4033" }}>Quick Add Foods</h3>
                  </div>
                  <div
                    onDrop={handleDropOnZone}
                    onDragOver={allowDrop}
                    title="Drop a card here to add"
                    style={{
                      fontSize: 12,
                      color: "#7a6a58",
                      padding: "6px 10px",
                      border: "1px dashed #e5d8bf",
                      borderRadius: 999,
                      background: "#fffaf0",
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ⬇︎ Drop to add
                  </div>
                </div>

                <div
  style={{
    display: 'grid',
    gap: 10,
    gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))',
  }}
>
  {quickFoods.map((f, idx) => (
    <div key={(f.id || f.name) + idx} style={{ position: 'relative' }}>
      <button
        draggable
        onDragStart={(e) => handlePresetDragStart(e, f)}
        onClick={() =>
          withBusy(() => quickAddFood(f), { label: "Adding meal…", refresh: true, toastMessage: "Meal logged 🍽️" })
        }
        style={{
          textAlign: 'left',
          border: '1px solid #f0e4c9',
          borderRadius: 14,
          padding: isMobile ? 10 : 12,
          cursor: 'pointer',
          background: '#ffffff',
          boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
          transition: 'transform 160ms ease, box-shadow 160ms ease',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: isSmall ? 18 : 20 }}>{f.emoji ?? "🍽️"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 13, color: "#3f3429", display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{f.name}</span>
              <span style={{ fontSize: 12, color: '#8b7b67', fontWeight: 600 }}>{(f.grams ?? 500)}g</span>
            </div>
            <div style={{ fontSize: isMobile ? 11 : 12, color: "#8b7b67" }}>Tap or drag to add · qty {f.quantity ?? 1}</div>
          </div>
        </div>
      </button>

      {/* delete control for custom items */}
      {f.custom && (
        <button
          title="Remove custom preset"
          onClick={() => handleRemoveCustomPreset(f)}
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            border: 'none',
            background: 'rgba(0,0,0,0.06)',
            width: 26,
            height: 26,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          ✖
        </button>
      )}
    </div>
  ))}

  {/* Add custom control (last tile) */}
  <div>
    {!showAddCustom ? (
      <button
        onClick={() => setShowAddCustom(true)}
        style={{
          textAlign: 'center',
          border: '1px dashed #e5d8bf',
          borderRadius: 14,
          padding: isMobile ? 12 : 14,
          cursor: 'pointer',
          background: '#fffaf0',
        }}
      >
        ➕ Add custom
      </button>
    ) : (
      <div style={{ border: '1px solid #f0e4c9', borderRadius: 12, padding: 8, background: '#fff' }}>
        <input placeholder="Name" value={customName} onChange={(e) => setCustomName(e.target.value)}
          style={{ width: '100%', marginBottom: 6, ...styles.smallInput }} />
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input placeholder="Emoji (optional)" value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)}
            style={{ width: 86, ...styles.smallInput }} />
          <input placeholder="Qty" value={customQty} onChange={(e) => setCustomQty(e.target.value)}
            style={{ flex: 1, ...styles.smallInput }} />
        </div>

        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Grams (per serving)</label>
          <input type="number" min="1" value={customGrams} onChange={(e) => setCustomGrams(e.target.value)}
            style={{ width: '100%', ...styles.smallInput }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={handleAddCustomPreset} style={{ flex: 1, padding: 8, borderRadius: 8, border: 'none', background: '#bca987', color: '#fff' }}>
            Save
          </button>
          <button onClick={() => setShowAddCustom(false)} style={{ padding: 8, borderRadius: 8, border: '1px solid #e5d8bf', background: '#fff' }}>
            Cancel
          </button>
        </div>
      </div>
    )}
  </div>
</div>

              </div>

              {/* Wide drop zone */}
              <div
                onDrop={handleDropOnZone}
                onDragOver={allowDrop}
                style={{ ...styles.dropZoneWide, maxWidth: isMobile ? '100%' : 720 }}
              >
                Drop quick food here to log instantly
              </div>

              {/* Category + inputs */}
              <div style={{ marginBottom: isMobile ? 12 : '1.5rem' }}>
                <label style={{ display:'block', fontSize:isMobile ? '0.825rem' : '0.875rem', fontWeight:'500', color:'#6b7280', marginBottom:isMobile ? '0.6rem' : '1rem' }}>Category</label>

                <div style={styles.categoryGrid}>
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategory === cat.name;
                    return (
                      <button key={cat.name} onClick={() => { setSelectedCategory(cat.name); setManualCalories(""); }} className="category-btn"
                        style={styles.categoryBtn(isSelected, cat)}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem' }}>
                          <div style={{ padding:isMobile ? '0.5rem' : '0.75rem', borderRadius:'0.75rem', backgroundColor: isSelected ? 'rgba(255,255,255,0.5)' : '#fff' }}>
                            <Icon style={{ width:isMobile ? '1.2rem' : '1.5rem', height:isMobile ? '1.2rem' : '1.5rem', color: isSelected ? cat.textColor : '#6b7280' }} />
                          </div>
                          <span style={{ fontWeight:600, fontSize:isMobile ? '0.82rem' : '0.875rem', color: isSelected ? cat.textColor : '#374151' }}>{cat.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={styles.formGridOne}>
                {selectedCategory === "Meal" && (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display:'block', fontSize:isMobile ? '0.825rem' : '0.875rem', fontWeight:'500', color:'#6b7280', marginBottom:'0.5rem' }}>Meal Name</label>
                      <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="e.g., Chicken Biryani"
                        style={styles.inputBase} />
                    </div>

                    <div>
                      <label style={{ display:'block', fontSize:isMobile ? '0.825rem' : '0.875rem', fontWeight:'500', color:'#6b7280', marginBottom:'0.5rem' }}>Calories (optional)</label>
                      <input type="number" min="0" value={manualCalories} onChange={(e) => setManualCalories(e.target.value)} placeholder="e.g., 420"
                        style={styles.smallInput} />
                      <div style={{ fontSize:'0.75rem', color:'#9ca3af', marginTop:'0.25rem' }}>If you know calories, enter them — the analyzer will use this value as an override.</div>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display:'block', fontSize:isMobile ? '0.825rem' : '0.875rem', fontWeight:'500', color:'#6b7280', marginBottom:'0.5rem' }}>
                    {selectedCategory === "Meal" ? "Servings" : selectedCategory === "Water" ? "Glasses (250ml)" : selectedCategory === "Activity" ? "Minutes / Steps" : "Hours"}
                  </label>
                  <div style={styles.qtyControls}>
                    <button onClick={() => setQuantity(Math.max(1, parseFloat(quantity || "1") - 1).toString())} style={styles.qtyBtn}>-</button>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={quantity}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setQuantity(val);
                        }
                      }}
                      onBlur={() => {
                        if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
                          setQuantity("1");
                        } else {
                          setQuantity(parseFloat(quantity).toFixed(2));
                        }
                      }}
                      style={styles.qtyInput}
                    />
                    <button onClick={() => setQuantity((Math.max(1, parseFloat(quantity || "1")) + 1).toString())} style={styles.qtyBtn}>+</button>
                  </div>
                </div>

                <div>
                  <button
                    onClick={() =>
                      withBusy(
                        () => handleAddLog(),
                        { label: `Logging ${selectedCategory.toLowerCase()}…`, min: 900, refresh: true, toastMessage: `${selectedCategory} logged ${selectedCategory === "Meal" ? "🍽️" : "✅"}` }
                      )
                    }
                    disabled={isBusy}
                    style={{
                      ...styles.addBtn,
                      opacity: isBusy ? 0.7 : 1,
                      cursor: isBusy ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <div style={{ display:'flex', gap:'0.625rem', alignItems:'center', justifyContent:'center' }}>
                      <Plus style={{ width:isMobile ? '1rem' : '1.25rem', height:isMobile ? '1rem' : '1.25rem' }} />
                      <span>{isBusy ? "Saving..." : (loading ? "Adding..." : `Add ${selectedCategory}`)}</span>
                    </div>
                  </button>
                </div>

                <hr style={styles.hr} />

                {/* Uncomment if you want quick analyze/summarize controls visible on mobile */}
                {/* <div style={{ marginBottom: '1.5rem', display: 'grid', gap: 8 }}>
                  <button onClick={handleAnalyzeToday} disabled={analyzing || isBusy} style={{ width:'100%', backgroundColor:'#bddfa3', color:'#3f5c2c', fontWeight:'600', padding:'0.875rem', borderRadius:'0.75rem', border:'none', cursor: (analyzing || isBusy) ? 'not-allowed' : 'pointer', boxShadow:'0 4px 12px rgba(0,0,0,0.08)', transition:'all 0.2s', opacity: (analyzing || isBusy) ? 0.7 : 1 }}>
                    {analyzing ? "Analyzing..." : "Run Analysis for Today's Meals"}
                  </button>

                  <button onClick={handleSummarizeToday} disabled={analyzing || isBusy} style={{ width:'100%', backgroundColor:'#f7e7b9', color:'#6b4b00', fontWeight:'600', padding:'0.75rem', borderRadius:'0.75rem', border:'none', cursor: (analyzing || isBusy) ? 'not-allowed' : 'pointer' }}>
                    {analyzing ? "Generating summary..." : "Generate Daily AI Summary"}
                  </button>
                </div> */}

                <div style={{ marginTop: '1rem' }}>
                  {/* placeholder for additional actions */}
                </div>
              </div>
            </div>

            <div style={{
              height: isMobile ? 36 : 48,
              marginTop: 12,
              marginBottom: 8,
              background: "linear-gradient(to bottom, rgba(255,255,255,0.7), rgba(255,255,255,0))",
              borderRadius: 12,
              width: "100%",
              maxWidth: 880,
              marginLeft: "auto",
              marginRight: "auto",
              pointerEvents: "none",
              opacity: 0.9
            }} />

            {/* Logs by Date */}
            <div style={styles.logsArea}>
              <h3 style={{ fontSize: isMobile ? '1rem' : '1.125rem', fontWeight: 600, color: '#5c4f3f', marginBottom: isMobile ? 8 : '1rem' }}>
                Logs by Date
              </h3>

              <div style={styles.datePickerRow}>
                <label style={{ color: "#4b4033", fontWeight: 500 }}>Select Date:</label>
                <input
                  type="date"
                  value={selectedDate || new Date().toISOString().split("T")[0]}
                  onChange={async (e) => {
                    const chosen = e.target.value;
                    setSelectedDate(chosen);
                    await refreshLogs();
                  }}
                  style={styles.dateInput}
                />
              </div>

              {filteredLogs?.length === 0 ? (
                <p style={{ color: "#6b7280" }}>No logs for this date.</p>
              ) : (
                <div style={{ width: '100%', boxSizing: 'border-box', padding: isMobile ? '0 6px' : undefined }}>
                  <CardStackPage
                    logs={filteredLogs}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    getCategoryIcon={getCategoryIcon}
                  />
                </div>
              )}

              <div style={{ marginTop: 8, textAlign: "center" }}>
                <button
                  onClick={() => navigateWithLoader(`/app/nutrition?date=${encodeURIComponent(selectedDate)}`, "Opening nutrition…")}
                  style={styles.viewNutritionBtn}
                >
                  View full nutrition for {selectedDate} →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
