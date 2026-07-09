"use client";

import { useEffect, useState } from "react";
import { QUOTES, quoteForHour } from "./quotes";

// Local-hour guess, shown instantly so the tagline never blanks; it's replaced
// by the server's authoritative pick (which is what makes it identical for all
// users) as soon as /api/quotes resolves.
function localFallback() {
  return quoteForHour(new Date().getHours());
}

export function useHourlyQuote() {
  const [quote, setQuote] = useState(localFallback);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetch("/api/quotes")
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data.quote?.text) setQuote(data.quote);
        })
        .catch(() => {});
    }

    load();
    // Re-fetch on the next hour boundary (then hourly) so a left-open app rolls
    // over to the new quote without a manual reload.
    const now = new Date();
    const msToNextHour = (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1_000;
    let interval;
    const timeout = setTimeout(() => {
      load();
      interval = setInterval(load, 60 * 60 * 1_000);
    }, Math.max(1_000, msToNextHour));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return quote;
}

// Kept for reference: the full list is the source of truth in ./quotes.
export { QUOTES };
