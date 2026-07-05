"use client";

import Image from "next/image";
import { MOKA } from "../_lib/theme";
import { useLocation } from "../_lib/LocationContext";
import { useCustomer } from "../_lib/CustomerContext";
import { useDailyQuotes } from "../_lib/useDailyQuotes";
import HeaderGreetingSwipe from "./HeaderGreetingSwipe";

export default function Header() {
  const { openPanel } = useLocation();
  const { customer } = useCustomer();
  const quotes = useDailyQuotes();

  return (
    // pt-safe + this wrapper's own background (not just the page root's) is what
    // keeps the cream fill unbroken behind the Dynamic Island / status bar.
    <div className="pt-safe" style={{ backgroundColor: MOKA.cream }}>
      <h1 className="sr-only">Menu MÖKA Café — Saint-Martin</h1>

      <HeaderGreetingSwipe customer={customer} quotes={quotes} onOpenLocation={openPanel} />

      <div className="flex justify-center px-4 pb-2">
        <Image src="/logo-moka.png" alt="MÖKA Drive" width={1930} height={461} priority className="h-7 w-auto" />
      </div>
    </div>
  );
}
