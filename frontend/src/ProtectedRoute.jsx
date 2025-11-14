import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoaderOverlay } from "./components/loaders.jsx"; // ✅ fixed import

export default function ProtectedRoute({ children }) {
  const { user, initializing, loading } = useAuth() || {};
  const pending = (initializing ?? loading) ?? false;
  const location = useLocation();

  if (pending) {
    return <LoaderOverlay label="Checking session…" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
