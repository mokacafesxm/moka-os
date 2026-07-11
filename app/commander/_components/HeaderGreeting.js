"use client";

import Image from "next/image";
import { User } from "lucide-react";
import { MOKA } from "../_lib/theme";

// Static greeting block — avatar + name (or a "Connectez-vous" prompt when
// signed out). No swipe, no rotation: the quote-of-the-day slide this used to
// alternate with has been removed entirely.
export default function HeaderGreeting({ customer, onGoToAccount }) {
  return (
    <div className="min-h-[44px] flex items-center gap-3">
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
