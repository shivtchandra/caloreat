// src/LoginPage.jsx

import React, { useEffect, useState, useRef } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, provider } from "./firebaseConfig";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { motion, useMotionValue, useTransform } from "framer-motion";
import "./LoginPage.css";

// 🔹 Firestore imports
import { db } from "./firebaseConfig";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// assets
import kidsIllustration from "./assets/kids-illustration.png";
import googleIcon from "./assets/google-icon.svg";

const STICKERS = ["🥗", "🍎", "🍞", "🍓", "🥑", "💪", "🍪", "🥕"];

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, initializing } = useAuth();
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const ringRef = useRef(null);

  // parallax orbit
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, (v) => (v - 0.5) * 6);
  const rotateY = useTransform(mouseX, (v) => (v - 0.5) * -8);

  useEffect(() => {
    const onMove = (e) => {
      mouseX.set(e.clientX / window.innerWidth);
      mouseY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  // ✅ Ensure Firestore user doc exists, then navigate
  useEffect(() => {
    const ensureUserDocThenNavigate = async () => {
      console.log("🏠 LoginPage: Checking user -", user?.email || "null", "initializing:", initializing);
      if (initializing || !user) return;

      try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          await setDoc(userRef, {
            email: user.email || "",
            name: user.displayName || "",
            photoURL: user.photoURL || "",
            provider: user.providerData?.[0]?.providerId || "",
            createdAt: serverTimestamp(),
          });
          console.log("📝 Created Firestore user doc for", user.uid);
        } else {
          console.log("ℹ️ Firestore user doc already exists", user.uid);
        }
      } catch (e) {
        console.error("❌ Failed to ensure user doc:", e);
        // (optional) You can choose to block navigation on error
      }

      console.log("✅ User authenticated, navigating to /app");
      navigate("/app", { replace: true });
    };

    ensureUserDocThenNavigate();
  }, [user, initializing, navigate]);

  /** ✅ Google Login with POPUP */
  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setLoading(true);

    try {
      console.log("🔵 Opening Google sign-in popup...");
      await signInWithPopup(auth, provider);
      console.log("✅ Google sign-in successful");
      // User state will update automatically, triggering navigation
    } catch (err) {
      console.error("❌ Google sign-in error:", err);
      setLoading(false);
      
      if (err.code === "auth/popup-closed-by-user") {
        setErrorMsg("Sign-in cancelled");
      } else if (err.code === "auth/popup-blocked") {
        setErrorMsg("Popup blocked. Please allow popups for this site.");
      } else {
        setErrorMsg("Google sign-in failed: " + err.message);
      }
    }
  };

  /** ✅ Email Login */
  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      setLoading(true);
      console.log("🔵 Signing in with email:", email);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log("✅ Email sign-in successful");
    } catch (err) {
      console.error("❌ Email sign-in error:", err);
      setLoading(false);
      if (err.code === "auth/invalid-credential") setErrorMsg("Invalid email or password");
      else if (err.code === "auth/user-not-found") setErrorMsg("User not found — try registering");
      else if (err.code === "auth/wrong-password") setErrorMsg("Invalid password");
      else setErrorMsg(err.message);
    }
  };

  /** ✅ Email Register */
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      console.log("🔵 Creating account for:", email);
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      console.log("✅ Account created successfully");
      // Firestore doc creation happens in the auth effect above.
    } catch (err) {
      console.error("❌ Registration error:", err);
      setLoading(false);
      if (err.code === "auth/email-already-in-use")
        setErrorMsg("Account exists — try login");
      else setErrorMsg(err.message);
    }
  };

  /** ✅ Forgot Password */
  const handleForgot = async () => {
    if (!email) return setErrorMsg("Enter your email first");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      alert("Password reset email sent! Check your inbox.");
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to send reset email");
    }
  };

  /** ✅ Render orbiting stickers */
  const renderOrbitStickers = () => {
    const radius = 200;
    return STICKERS.map((s, i) => {
      const theta = (i / STICKERS.length) * Math.PI * 2;
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * radius;

      return (
        <motion.div
          key={i}
          className="orbit-sticker"
          style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: [0.95, 1.05, 1], rotate: [0, 6, -4, 0] }}
          transition={{ repeat: Infinity, duration: 6 + i * 0.2, ease: "easeInOut" }}
        >
          <div className="orbit-sticker-inner">{s}</div>
        </motion.div>
      );
    });
  };

  // Show loading while checking auth
  if (initializing) {
    return (
      <div className="login-root">
        <div className="login-bg" />
        <div className="login-center">
          <div style={{ color: 'white', textAlign: 'center' }}>
            <h2>Loading...</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-root">
      <div className="login-bg" />

      {/* orbit ring */}
      <motion.div
        className="orbit-container"
        ref={ringRef}
        style={{ rotateX, rotateY }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 60, ease: "linear" }}
      >
        {renderOrbitStickers()}
      </motion.div>

      {/* Auth box */}
      <div className="login-center">
        <div className="login-panel">
          <div className="form-container">
            <h2>{authMode === "login" ? "Welcome Back" : "Create Account"}</h2>

            <form onSubmit={authMode === "login" ? handleEmailSignIn : handleRegister}>
              <div className="form-row">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-row">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {errorMsg && (
                <div style={{ color: "#ff6b6b", marginTop: 8, fontSize: 14, padding: '8px', backgroundColor: 'rgba(255,107,107,0.1)', borderRadius: '4px' }}>
                  {errorMsg}
                </div>
              )}

              {authMode === "login" && (
                <div className="form-actions">
                  <button type="button" className="forgot-password" onClick={handleForgot} disabled={loading}>
                    Forgot Password?
                  </button>
                </div>
              )}

              <button type="submit" className="btn-signin" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Sign In"
                  : "Create Account"}
              </button>
            </form>

            <div className="divider"><span>or continue with</span></div>

            <button className="btn-google" onClick={handleGoogleSignIn} disabled={loading}>
              <img src={googleIcon} alt="Google" /> 
              {loading ? "Signing in..." : "Sign in with Google"}
            </button>

            <p className="register-note">
              {authMode === "login" ? (
                <>
                  New here?{" "}
                  <span 
                    onClick={() => !loading && setAuthMode("register")} 
                    style={{cursor: loading ? 'default' : 'pointer', color: '#1976d2', textDecoration: 'underline'}}
                  >
                    Create account
                  </span>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <span 
                    onClick={() => !loading && setAuthMode("login")} 
                    style={{cursor: loading ? 'default' : 'pointer', color: '#1976d2', textDecoration: 'underline'}}
                  >
                    Sign in
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right panel illustration */}
        <div className="illustration-panel">
          <div className="illustration-card">
            <img src={kidsIllustration} alt="kids" className="kids-illustration" />
          </div>
        </div>
      </div>
    </div>
  );
}