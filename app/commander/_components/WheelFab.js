"use client";

import { Gift } from "lucide-react";
import { MOKA } from "../_lib/theme";

// Floating button sitting beside BottomNav (which is centered), same bottom
// offset, off to the side so they never overlap.
export default function WheelFab({ canSpin, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={canSpin ? "Tourner la roue de la chance — disponible" : "Roue de la chance"}
      className="fixed bottom-4 right-4 z-30 w-14 h-14 rounded-full flex items-center justify-center cursor-pointer"
      style={{
        backgroundColor: MOKA.coral,
        boxShadow: `0 8px 20px ${MOKA.navShadow}`,
      }}
    >
      <Gift className="w-6 h-6 text-white" />
      {canSpin && (
        <span
          className="absolute top-0 right-0 w-4 h-4 rounded-full border-2 animate-bump"
          style={{ backgroundColor: MOKA.green, borderColor: MOKA.cream }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
