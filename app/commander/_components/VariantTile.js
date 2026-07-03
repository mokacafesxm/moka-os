"use client";

import { MOKA } from "../_lib/theme";

export default function VariantTile({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition-colors min-h-[44px]"
      style={
        selected
          ? { backgroundColor: MOKA.coral, borderColor: MOKA.coral, color: "white" }
          : { backgroundColor: "white", borderColor: MOKA.brownLight, color: MOKA.brown }
      }
    >
      {label}
    </button>
  );
}
