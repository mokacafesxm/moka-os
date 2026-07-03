"use client";

import { MOKA } from "../_lib/theme";

export default function VariantTile({ label, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-xl border text-sm font-semibold cursor-pointer transition-colors"
      style={
        selected
          ? { backgroundColor: MOKA.olive, borderColor: MOKA.olive, color: "white" }
          : { backgroundColor: "white", borderColor: MOKA.border, color: MOKA.brown }
      }
    >
      {label}
    </button>
  );
}
