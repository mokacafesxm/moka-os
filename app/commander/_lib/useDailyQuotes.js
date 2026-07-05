"use client";

import { useEffect, useState } from "react";

// Same fallback as app/api/quotes/route.js — shown instantly while the
// (already-cached server-side) fetch resolves, so the tagline never blanks.
const FALLBACK_QUOTES = [
  "Chaque commande commence par une idée. Fonce.",
  "Le meilleur moment pour se lancer, c'est maintenant.",
  "Petites habitudes, grands résultats.",
  "Tout est possible avant midi.",
];

export function useDailyQuotes() {
  const [quotes, setQuotes] = useState(FALLBACK_QUOTES);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quotes")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data.quotes) && data.quotes.length) setQuotes(data.quotes);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return quotes;
}
