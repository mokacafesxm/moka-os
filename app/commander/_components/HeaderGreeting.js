"use client";

import { useEffect, useState } from "react";
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
          // Same font size as the location pill in Header.js (text-xs) so the
          // two header controls read as one aligned, legible row.
          className="font-black text-xs truncate shrink-0 cursor-pointer p-2 -m-2 min-h-[44px]"
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
      <p className="text-sm font-semibold line-clamp-2" style={{ color: MOKA.brown }}>
        « {quote.text} »
      </p>
      <div className="text-[0.625rem] font-bold uppercase tracking-wide mt-0.5" style={{ color: MOKA.brownLight }}>
        {quote.author}
      </div>
    </div>
  );
}

// Alternates the *entire* greeting block (avatar, name) with the current
// hourly quote slide — the whole block swipes out as one unit, not just a
// text line. There's a single quote per hour now (same for everyone, picked
// server-side), so this just toggles greeting <-> that one quote; it does not
// cycle through a list. The location pill lives outside this component (see
// Header.js) so it never disappears mid-swipe.
export default function HeaderGreetingSwipe({ customer, quote, onGoToAccount }) {
  const hasQuote = Boolean(quote?.text);
  const [showQuote, setShowQuote] = useState(false);

  useEffect(() => {
    if (!hasQuote) return;
    const id = setInterval(() => setShowQuote((s) => !s), STEP_MS);
    return () => clearInterval(id);
  }, [hasQuote]);

  const showingQuote = hasQuote && showQuote;

  return (
    <div className="min-h-[44px] flex items-center overflow-hidden">
      <div key={showingQuote ? `quote-${quote.text}` : "greeting"} className="w-full animate-swipe-in">
        {showingQuote ? (
          <QuoteSlide quote={quote} />
        ) : (
          <GreetingSlide customer={customer} onGoToAccount={onGoToAccount} />
        )}
      </div>
    </div>
  );
}
