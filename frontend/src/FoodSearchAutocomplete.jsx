// src/components/FoodSearchAutocomplete.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

export default function FoodSearchAutocomplete({ query, onSelect }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const cancel = axios.CancelToken.source();
    setLoading(true);
    axios.get("/api/food/search", { params: { q: query }, cancelToken: cancel.token })
      .then((res) => {
        setResults(res.data || []);
      })
      .catch((err) => {
        if (!axios.isCancel(err)) console.error("Food search failed", err);
      })
      .finally(() => setLoading(false));

    return () => cancel.cancel();
  }, [query]);

  return (
    <div className="autocomplete-dropdown">
      {loading && <div className="autocomplete-item muted">Searching...</div>}
      {results.map((item) => (
        <div
          key={item.id}
          className="autocomplete-item"
          onClick={() => onSelect(item)}
        >
          {item.name} {item.variants && item.variants.length > 0 ? `(${item.variants.map(v => v.variant).join("/")})` : ""}
        </div>
      ))}
    </div>
  );
}
