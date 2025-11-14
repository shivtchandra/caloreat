import React, { useEffect, useState } from "react";
import FoodLoader from "./FoodLoader";
import { AnimatePresence, motion } from "framer-motion";

export default function PageTransition({ children }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1200); // ✅ hold loader
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <FoodLoader key="loader" label="Preparing nutrition…" />
      ) : (
        <motion.div
          key="page"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
