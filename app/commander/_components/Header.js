"use client";

import Image from "next/image";
import { MapPin } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useLocation } from "../_lib/LocationContext";

export default function Header() {
  const { openPanel } = useLocation();

  return (
    <div className="text-center pt-4 pb-3">
      <h1 className="sr-only">Menu MÖKA Café — Saint-Martin</h1>
      <Image
        src="/logo-moka.png"
        alt="MÖKA Drive"
        width={1930}
        height={461}
        priority
        className="h-10 w-auto mx-auto"
      />
      <button
        onClick={openPanel}
        className="mt-2 inline-flex items-center gap-1.5 justify-center rounded-full border px-4 py-2 min-h-[44px] font-semibold text-xs cursor-pointer"
        style={{ borderColor: MOKA.brownLight, color: MOKA.brown }}
      >
        <MapPin className="w-3.5 h-3.5" style={{ color: MOKA.coral }} />
        Saint-Martin
      </button>
    </div>
  );
}
