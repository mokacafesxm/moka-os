"use client";

import { MapPin } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useLocation } from "../_lib/LocationContext";
import { SOCIAL_ICONS } from "./SocialIcons";

export default function TopBar() {
  const { location, openPanel } = useLocation();

  return (
    <div
      className="flex items-center justify-between gap-2 px-4 py-1.5 text-white text-xs"
      style={{ backgroundColor: MOKA.green }}
    >
      <div className="flex items-center gap-2.5 shrink-0">
        {SOCIAL_ICONS.map((Icon, i) => (
          <Icon key={i} className="w-3.5 h-3.5 opacity-90" />
        ))}
      </div>

      <div className="font-bold tracking-wide whitespace-nowrap text-[11px] truncate">
        ORDER TAKEAWAY ONLINE!
      </div>

      <button
        onClick={openPanel}
        className="shrink-0 font-semibold text-[11px] flex items-center gap-1 cursor-pointer p-4 -m-4"
      >
        <MapPin className="w-3.5 h-3.5" />
        {location.name.split("—")[1]?.split(",")[0]?.trim() || "Marigot"}
      </button>
    </div>
  );
}
