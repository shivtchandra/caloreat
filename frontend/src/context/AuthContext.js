// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut, getRedirectResult } from "firebase/auth";
import { auth } from "../firebaseConfig";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const redirectChecked = useRef(false); // ✅ Prevent double-check

  useEffect(() => {
    console.log("🚀 AuthProvider: Starting initialization...");
    
    // Only check redirect result ONCE (even in StrictMode)
    if (!redirectChecked.current) {
      redirectChecked.current = true;
      
      getRedirectResult(auth)
        .then((result) => {
          if (result?.user) {
            console.log("✅ Google redirect SUCCESS:", result.user.email);
          } else {
            console.log("⚪ No redirect result");
          }
        })
        .catch((err) => {
          console.error("❌ Redirect error:", err.code, err.message);
        });
    }

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("🔵 Auth state changed:", currentUser?.email || "null");
      setUser(currentUser);
      setInitializing(false);
    });
  
    return () => {
      console.log("🛑 AuthProvider: Cleaning up");
      unsubscribe();
    };
  }, []);

  const logout = () => signOut(auth);

  console.log("🎨 AuthProvider render - user:", user?.email || "null", "initializing:", initializing);

  return (
    <AuthContext.Provider value={{ user, initializing, logout }}>
      {children}
    </AuthContext.Provider>
  );
}