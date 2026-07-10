"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useLocation } from "../_lib/LocationContext";
import { useCustomer } from "../_lib/CustomerContext";
import HeaderGreeting from "./HeaderGreeting";

export default function Header({ onGoToAccount }) {
  const { openPanel } = useLocation();
  const { customer } = useCustomer();

  return (
    // pt-safe + this wrapper's own background (not just the page root's) is what
    // keeps the cream fill unbroken behind the Dynamic Island / status bar.
    <div className="pt-safe" style={{ backgroundColor: MOKA.cream }}>
      <h1 className="sr-only">Menu MÖKA Café — Saint-Martin</h1>

      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <HeaderGreeting customer={customer} onGoToAccount={onGoToAccount} />
        </div>

        <button
          onClick={openPanel}
          aria-label="Changer de restaurant — Saint-Martin"
          className="shrink-0 flex items-center justify-center cursor-pointer p-3 -m-3 min-h-[44px] min-w-[44px]"
        >
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
            style={{ borderColor: MOKA.brownLight, color: MOKA.brown }}
          >
            <MapPin className="w-3 h-3" style={{ color: MOKA.coral }} />
            Saint-Martin
          </span>
        </button>
      </div>

      {/* pt-1.5/pb-2.5 (not equal py-2) — centered between the greeting row
          above and the promo banner below, then nudged a few px down from
          that strict center for a more balanced look. */}
      <div className="flex justify-center px-4 pt-1.5 pb-2.5">
        <Image src="/logo-moka.png" alt="MÖKA Drive" width={1930} height={461} priority className="h-7 w-auto" />
      </div>
    </div>
  );
}
