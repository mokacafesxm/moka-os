"use client";

import Image from "next/image";
import { MapPin, User } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useLocation } from "../_lib/LocationContext";
import { useCustomer } from "../_lib/CustomerContext";
import { useDailyQuotes } from "../_lib/useDailyQuotes";
import HeaderTagline from "./HeaderTagline";

const LOCATION_PILL_CLASS =
  "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 min-h-[44px] font-semibold text-xs";

export default function Header() {
  const { openPanel } = useLocation();
  const { customer } = useCustomer();
  const quotes = useDailyQuotes();

  return (
    // pt-safe + this wrapper's own background (not just the page root's) is what
    // keeps the cream fill unbroken behind the Dynamic Island / status bar.
    <div className="pt-safe" style={{ backgroundColor: MOKA.cream }}>
      <h1 className="sr-only">Menu MÖKA Café — Saint-Martin</h1>

      {/* Personalized greeting */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
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
        <div className="min-w-0 flex-1">
          <div className="font-black text-sm truncate" style={{ color: MOKA.brown }}>
            {customer.connected ? `Hi ${customer.prenom}` : "Bonjour"}
          </div>
          <HeaderTagline quotes={quotes} />
        </div>
      </div>

      {/* Logo + location */}
      <div className="flex items-center px-4 pb-3 gap-2">
        <button
          onClick={openPanel}
          className={`${LOCATION_PILL_CLASS} cursor-pointer`}
          style={{ borderColor: MOKA.brownLight, color: MOKA.brown }}
        >
          <MapPin className="w-3.5 h-3.5" style={{ color: MOKA.coral }} />
          Saint-Martin
        </button>

        <div className="flex-1 flex justify-center">
          <Image src="/logo-moka.png" alt="MÖKA Drive" width={1930} height={461} priority className="h-7 w-auto" />
        </div>

        {/* Invisible clone of the location pill balances the logo's centering. */}
        <span aria-hidden="true" className={`${LOCATION_PILL_CLASS} invisible`}>
          <MapPin className="w-3.5 h-3.5" />
          Saint-Martin
        </span>
      </div>
    </div>
  );
}
