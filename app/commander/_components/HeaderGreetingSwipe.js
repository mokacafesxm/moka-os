"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MapPin, User } from "lucide-react";
import { MOKA } from "../_lib/theme";

const STEP_MS = 4000;

function GreetingSlide({ customer, onOpenLocation }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative w-11 h-11 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
        style={{ backgroundColor: MOKA.brown }}
      >
        {customer.photoUrl ? (
          <Image src={customer.photoUrl} alt="" fill sizes="44px" className="object-cover" />
        ) : (
          <User className="w-5 h-5 text-white" />
        )}
      </div>
      <span className="font-black text-sm truncate shrink-0" style={{ color: MOKA.brown }}>
        {customer.connected ? `Hi ${customer.prenom}` : "Bonjour"}
      </span>
      <button
        onClick={onOpenLocation}
        className="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 min-h-[36px] font-semibold text-xs cursor-pointer"
        style={{ borderColor: MOKA.brownLight, color: MOKA.brown }}
      >
        <MapPin className="w-3.5 h-3.5" style={{ color: MOKA.coral }} />
        Saint-Martin
      </button>
    </div>
  );
}

function QuoteSlide({ quote }) {
  return (
    <div>
      <div className="text-[0.625rem] font-bold uppercase tracking-wide" style={{ color: MOKA.brownLight }}>
        Quote of the day
      </div>
      <p className="text-sm font-semibold mt-0.5 line-clamp-2" style={{ color: MOKA.brown }}>
        {quote}
      </p>
    </div>
  );
}

// Alternates the *entire* greeting block (avatar, name, location pill) with
// a "quote of the day" slide — the whole block swipes out as one unit, not
// just a text line, cycling through each daily quote in turn, automatically.
export default function HeaderGreetingSwipe({ customer, quotes, onOpenLocation }) {
  const sequence = useMemo(() => {
    if (!quotes.length) return ["greeting"];
    return quotes.flatMap((quote) => ["greeting", quote]);
  }, [quotes]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (sequence.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % sequence.length), STEP_MS);
    return () => clearInterval(id);
  }, [sequence]);

  // Guards against a stale index if `sequence` shrinks (fallback -> fetched quotes).
  const current = sequence[index % sequence.length];

  return (
    <div className="min-h-[44px] flex items-center px-4 pt-3 pb-2 overflow-hidden">
      <div key={index} className="w-full animate-swipe-in">
        {current === "greeting" ? (
          <GreetingSlide customer={customer} onOpenLocation={onOpenLocation} />
        ) : (
          <QuoteSlide quote={current} />
        )}
      </div>
    </div>
  );
}
