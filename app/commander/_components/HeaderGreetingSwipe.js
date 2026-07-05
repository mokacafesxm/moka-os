"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { MOKA } from "../_lib/theme";

const STEP_MS = 4000;

function GreetingSlide({ customer, onGoToAccount }) {
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
      {customer.connected ? (
        <span className="font-black text-sm truncate shrink-0" style={{ color: MOKA.brown }}>
          Hi {customer.prenom}
        </span>
      ) : (
        <button
          onClick={onGoToAccount}
          className="font-black text-sm truncate shrink-0 cursor-pointer p-2 -m-2 min-h-[44px]"
          style={{ color: MOKA.brown }}
        >
          Connectez-vous
        </button>
      )}
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

// Alternates the *entire* greeting block (avatar, name) with a "quote of the
// day" slide — the whole block swipes out as one unit, not just a text
// line, cycling through each daily quote in turn, automatically. The
// location pill lives outside this component now (see Header.js) so it
// never disappears mid-swipe.
export default function HeaderGreetingSwipe({ customer, quotes, onGoToAccount }) {
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
    <div className="min-h-[44px] flex items-center overflow-hidden">
      <div key={index} className="w-full animate-swipe-in">
        {current === "greeting" ? (
          <GreetingSlide customer={customer} onGoToAccount={onGoToAccount} />
        ) : (
          <QuoteSlide quote={current} />
        )}
      </div>
    </div>
  );
}
