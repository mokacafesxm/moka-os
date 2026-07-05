"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useLocation } from "../_lib/LocationContext";

const LOCATION_PILL_CLASS =
  "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 min-h-[44px] font-semibold text-xs";

export default function Header() {
  const { openPanel } = useLocation();

  return (
    <div className="flex items-center px-4 pt-4 pb-3 gap-2">
      <h1 className="sr-only">Menu MÖKA Café — Saint-Martin</h1>

      <button
        onClick={openPanel}
        className={`${LOCATION_PILL_CLASS} cursor-pointer`}
        style={{ borderColor: MOKA.brownLight, color: MOKA.brown }}
      >
        <MapPin className="w-3.5 h-3.5" style={{ color: MOKA.coral }} />
        Saint-Martin
      </button>

      <div className="flex-1 flex justify-center">
        <Image src="/logo-moka.png" alt="MÖKA Drive" width={1930} height={461} priority className="h-10 w-auto" />
      </div>

      {/* Invisible clone of the location pill balances the logo's centering. */}
      <span aria-hidden="true" className={`${LOCATION_PILL_CLASS} invisible`}>
        <MapPin className="w-3.5 h-3.5" />
        Saint-Martin
      </span>
    </div>
  );
}
