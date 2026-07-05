"use client";

import { useEffect, useMemo, useState } from "react";
import { MOKA } from "../_lib/theme";

const FIXED_TEXT = "Pickup your brunch";
const STEP_MS = 4000;

// Alternates "Pickup your brunch" with each daily quote in turn — fixed,
// quote[0], fixed, quote[1], ... looping — swiping in automatically, no
// user interaction. The key-remount + CSS animation below is the same
// technique the rest of /commander uses for its micro-interactions.
export default function HeaderTagline({ quotes }) {
  const sequence = useMemo(() => {
    if (!quotes.length) return [FIXED_TEXT];
    return quotes.flatMap((quote) => [FIXED_TEXT, quote]);
  }, [quotes]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (sequence.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % sequence.length), STEP_MS);
    return () => clearInterval(id);
  }, [sequence]);

  // Guards against a stale index if `sequence` shrinks (fallback -> fetched
  // quotes) right between a render and the next interval tick.
  const current = sequence[index % sequence.length];

  return (
    <div className="relative h-4 overflow-hidden">
      <p
        key={index}
        className="absolute inset-0 text-xs font-medium truncate animate-swipe-in"
        style={{ color: MOKA.brownLight }}
      >
        {current}
      </p>
    </div>
  );
}
