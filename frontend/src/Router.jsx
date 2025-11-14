// src/Router.jsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./ProtectedRoute";

// pages
import Home from "./Home";
import LoginPage from "./LoginPage";
import App from "./App";               // main dashboard
import ResultsPage from "./ResultsPage";
import DailyLogPage from "./DailyLogPage";
import ProfilePage from "./ProfilePage";
import MetricsPage from "./MetricsPage";
import ActivityGraph from "./ActivityGraph";
import NutritionPage from "./NutritionPage";

// loader overlay shown while routes mount
// adjust the import path if your loader file lives elsewhere
import Loader from "./Loader.jsx";     // ✅ ensure this exists & exports a component

export default function AppRouter() {
  const { user } = useAuth();

  return (
    // Show loader while a route’s element is mounting
    <Suspense fallback={<Loader label="Loading…" />}>
      <Routes>
        {/* Public landing for logged-out users */}
        <Route
          path="/"
          element={user ? <Navigate to="/app" replace /> : <Home />}
        />

        {/* Login page (always public) */}
        <Route path="/login" element={<LoginPage />} />

        {/* 🔒 Protected main app */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          }
        />

        {/* 🔒 Protected feature routes */}
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <ResultsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dailylog"
          element={
            <ProtectedRoute>
              <DailyLogPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <ActivityGraph/>
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/metrics"
          element={
            <ProtectedRoute>
              <MetricsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <ActivityGraph />
            </ProtectedRoute>
          }
        />

        {/* ✅ NEW: protected Nutrition pages */}
        <Route
          path="/nutrition"
          element={
            <ProtectedRoute>
              <NutritionPage />
            </ProtectedRoute>
          }
        />

        {/* Single meal view */}
        <Route
          path="/nutrition/:id"
          element={
            <ProtectedRoute>
              <NutritionPage />
            </ProtectedRoute>
          }
        />

        {/* fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
