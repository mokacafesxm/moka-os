"use client";

import { Check, MapPin } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useLocation, MOKA_LOCATION } from "../_lib/LocationContext";
import { useModalA11y } from "../_lib/useModalA11y";

export default function LocationSheet() {
  const { open, closePanel, selectLocation } = useLocation();
  const dialogRef = useModalA11y(closePanel, open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={closePanel} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-sheet-title"
        tabIndex={-1}
        className="relative w-full rounded-t-3xl p-5 animate-sheet-up outline-none"
        style={{ backgroundColor: MOKA.cream }}
      >
        <h2 id="location-sheet-title" className="text-lg font-black mb-4" style={{ color: MOKA.brown }}>
          Choisir un restaurant
        </h2>

        <button
          onClick={() => selectLocation(MOKA_LOCATION.id)}
          className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white cursor-pointer min-h-[44px]"
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 border"
            style={{ borderColor: MOKA.brownLight }}
          >
            <MapPin className="w-5 h-5" style={{ color: MOKA.brown }} />
          </div>
          <div className="flex-1 text-left">
            <div className="font-bold text-sm" style={{ color: MOKA.brown }}>
              {MOKA_LOCATION.name}
            </div>
            <div className="text-xs" style={{ color: MOKA.brownLight }}>
              Retrait sur place
            </div>
          </div>
          <Check className="w-5 h-5 shrink-0" style={{ color: MOKA.coral }} />
        </button>

        <div className="mt-4 p-3 rounded-2xl opacity-50 cursor-not-allowed" style={{ backgroundColor: MOKA.placeholderTan }}>
          <div className="font-semibold text-sm" style={{ color: MOKA.brownLight }}>
            Plus de restaurants bientôt disponibles
          </div>
          <div className="text-xs" style={{ color: MOKA.brownLight }}>
            More locations coming soon
          </div>
        </div>

        <button
          onClick={closePanel}
          className="mt-5 w-full py-3.5 rounded-2xl font-bold text-white cursor-pointer min-h-[44px]"
          style={{ backgroundColor: MOKA.coral }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
