// src/ProfilePage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { motion } from "framer-motion";
import "./ProfilePage.css";
import profile from "./assets/profile.png";

/* ---------- Tiny, dependency-free dropdown ---------- */
function FancySelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  style = {},
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((s) => !s)}
        className="fancy-select-trigger"
        style={{
          width: "100%",
          textAlign: "left",
          borderRadius: 12,
          padding: "10px 12px",
          border: "1px solid #e5e7eb",
          background: disabled ? "#f3f4f6" : "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          cursor: disabled ? "not-allowed" : "pointer",
          ...style,
        }}
      >
        <span style={{ color: selected ? "#111827" : "#9ca3af" }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ float: "right", opacity: 0.6 }}>▾</span>
      </button>

      {open && !disabled && (
        <ul
          role="listbox"
          className="fancy-select-menu"
          style={{
            position: "absolute",
            zIndex: 40,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 6,
            margin: 0,
            listStyle: "none",
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
          }}
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="fancy-select-item"
              style={{
                padding: "10px 10px",
                borderRadius: 10,
                cursor: "pointer",
                background:
                  opt.value === value ? "rgba(34,197,94,0.08)" : "transparent",
                fontWeight: opt.value === value ? 700 : 500,
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const auth = getAuth();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Always show auth name/email; all other fields start empty
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Editable profile fields (blank until user saves)
  const [mobile, setMobile] = useState("");
  const [location, setLocation] = useState("");
  const [age, setAge] = useState("");

  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [activity, setActivity] = useState("");
  const [diet, setDiet] = useState("");
  const [goal, setGoal] = useState("");

  const [waterTarget, setWaterTarget] = useState("");
  const [stepTarget, setStepTarget] = useState("");
  const [sleepTarget, setSleepTarget] = useState("");

  // Options
  const genderOpts = useMemo(
    () => [
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "other", label: "Other" },
    ],
    []
  );

  const activityOpts = useMemo(
    () => [
      { value: "sedentary", label: "Sedentary" },
      { value: "lightly_active", label: "Lightly Active" },
      { value: "moderately_active", label: "Moderately Active" },
      { value: "very_active", label: "Very Active" },
      { value: "athlete", label: "Athlete" },
    ],
    []
  );

  const dietOpts = useMemo(
    () => [
      { value: "omnivore", label: "Omnivore" },
      { value: "vegetarian", label: "Vegetarian" },
      { value: "vegan", label: "Vegan" },
      { value: "jain", label: "Jain" },
    ],
    []
  );

  const goalOpts = useMemo(
    () => [
      { value: "weight_loss", label: "Lose Weight" },
      { value: "maintenance", label: "Maintain" },
      { value: "weight_gain", label: "Gain Muscle / Weight" },
    ],
    []
  );

  // Load auth; only populate profile fields if the user had saved before
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setName(user.displayName || "");
        setEmail(user.email || "");
      }

      const get = (k) => localStorage.getItem(k) ?? "";

      // Only repopulate if the user saved at least once
      const hasSaved = get("profile_saved_v1") === "1";
      if (hasSaved) {
        setMobile(get("profile_mobile"));
        setLocation(get("profile_location"));
        setAge(get("profile_age"));

        // 🔑 read either old or canonical key
        setGender(get("profile_gender") || get("profile_sex"));
        setHeight(get("profile_height") || get("profile_height_cm"));
        setWeight(get("profile_weight") || get("profile_weight_kg"));
        setActivity(get("profile_activity") || get("profile_activity_level"));
        setDiet(get("profile_diet"));
        setGoal(get("profile_goal"));

        setWaterTarget(get("profile_waterTarget"));
        setStepTarget(get("profile_stepTarget"));
        setSleepTarget(get("profile_sleepTarget"));
      }

      setLoading(false);
    });

    return () => unsub && unsub();
  }, [auth]);

  // 📱 Fix: Inject viewport meta tag if missing (to ensure mobile responsiveness)
  useEffect(() => {
    let meta = document.querySelector("meta[name='viewport']");
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1";
      document.head.appendChild(meta);
    }
  }, []);


  /* ---------- Save ---------- */
  const handleSave = (e) => {
    e.preventDefault();

    // Canonical keys the app uses elsewhere
    localStorage.setItem("profile_sex", gender || "");
    localStorage.setItem("profile_age", age || "");
    localStorage.setItem("profile_height_cm", height || "");
    localStorage.setItem("profile_weight_kg", weight || "");
    localStorage.setItem("profile_activity_level", activity || "");
    localStorage.setItem("profile_goal", goal || "");
    localStorage.setItem("profile_location", location || "");

    // Keep your existing keys too (so this page can re-populate)
    localStorage.setItem("profile_name", name || "");
    localStorage.setItem("profile_email", email || "");
    localStorage.setItem("profile_mobile", mobile || "");
    localStorage.setItem("profile_gender", gender || "");
    localStorage.setItem("profile_height", height || "");
    localStorage.setItem("profile_weight", weight || "");
    localStorage.setItem("profile_activity", activity || "");
    localStorage.setItem("profile_diet", diet || "");

    localStorage.setItem("profile_waterTarget", waterTarget || "");
    localStorage.setItem("profile_stepTarget", stepTarget || "");
    localStorage.setItem("profile_sleepTarget", sleepTarget || "");

    localStorage.setItem("profile_saved_v1", "1");

    alert("Profile saved successfully ✅");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.clear();
      navigate("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleBackHome = () => navigate("/");

  if (loading) {
    return (
      <div className="profile-loader">
        <div className="loader">Loading profile…</div>
      </div>
    );
  }

  return (
    <div className="profile-fullscreen">
      {/* Floating Header Buttons */}
      <div className="top-buttons">
        <button onClick={handleBackHome} className="btn-floating left">
          Home
        </button>
        <button onClick={handleLogout} className="btn-floating right">
          Logout
        </button>
      </div>

      <motion.div
        className="profile-container"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Left: Form */}
        <div className="profile-card">
          <h2 className="welcome">
            Welcome, <span>{email || "User"}</span>
          </h2>

          <form onSubmit={handleSave} className="profile-grid">
            <div className="form-group">
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="form-group">
              <label>Email (from sign-in)</label>
              <input type="email" value={email} disabled />
            </div>

            <div className="form-group">
              <label>Mobile</label>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City / Country"
              />
            </div>

            <div className="form-group">
              <label>Age</label>
              <input
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="Years"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label>Gender</label>
              <FancySelect
                value={gender}
                onChange={setGender}
                options={genderOpts}
                placeholder="Select gender"
              />
            </div>

            <div className="form-group">
              <label>Height (cm)</label>
              <input
                value={height}
                onChange={(e) =>
                  setHeight(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="e.g., 170"
                inputMode="decimal"
              />
            </div>

            <div className="form-group">
              <label>Weight (kg)</label>
              <input
                value={weight}
                onChange={(e) =>
                  setWeight(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="e.g., 70"
                inputMode="decimal"
              />
            </div>

            <div className="form-group">
              <label>Activity Level</label>
              <FancySelect
                value={activity}
                onChange={setActivity}
                options={activityOpts}
                placeholder="Select activity"
              />
            </div>

            <div className="form-group">
              <label>Diet Preference</label>
              <FancySelect
                value={diet}
                onChange={setDiet}
                options={dietOpts}
                placeholder="Select diet"
              />
            </div>

            <div className="form-group">
              <label>Goal</label>
              <FancySelect
                value={goal}
                onChange={setGoal}
                options={goalOpts}
                placeholder="Select goal"
              />
            </div>

            <div className="form-group">
              <label>Daily Water Goal (ml)</label>
              <input
                value={waterTarget}
                onChange={(e) =>
                  setWaterTarget(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="e.g., 2500"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label>Daily Step Goal</label>
              <input
                value={stepTarget}
                onChange={(e) =>
                  setStepTarget(e.target.value.replace(/[^\d]/g, ""))
                }
                placeholder="e.g., 8000"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label>Sleep Goal (hrs)</label>
              <input
                value={sleepTarget}
                onChange={(e) =>
                  setSleepTarget(e.target.value.replace(/[^\d.]/g, ""))
                }
                placeholder="e.g., 8"
                inputMode="decimal"
              />
            </div>

            <div className="actions">
              <button type="submit" className="btn-save">
                Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Right: Illustration */}
        <div className="illustration-area">
          <img src={profile} alt="Kids" className="kids-art" />
          <motion.div
            className="floating-sticker"
            animate={{ y: [0, -12, 0], rotate: [0, 5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            🍎
          </motion.div>
          <motion.div
            className="floating-sticker2"
            animate={{ y: [0, -14, 0], rotate: [0, -5, 0] }}
            transition={{ duration: 2.8, repeat: Infinity }}
          >
            🥦
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
