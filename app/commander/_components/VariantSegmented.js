"use client";

import { MOKA } from "../_lib/theme";

// Single-row segmented control. Options size to their own content and scroll
// horizontally (snap) rather than being squeezed to equal widths — that's
// what caused options to truncate illegibly with 4+ values. The trailing
// gradient hints that more options are scrollable off-screen.
export default function VariantSegmented({ options, selected, onSelect }) {
  return (
    <div className="relative">
      <div
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory no-scrollbar rounded-full p-1"
        style={{ backgroundColor: MOKA.placeholderTan }}
      >
        {options.map((value) => {
          const isSelected = selected === value;
          return (
            <button
              key={value}
              onClick={() => onSelect(value)}
              aria-pressed={isSelected}
              className="shrink-0 snap-start rounded-full px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors min-h-[40px] cursor-pointer"
              style={isSelected ? { backgroundColor: MOKA.coral, color: "white" } : { color: MOKA.brown }}
            >
              {value}
            </button>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 h-full w-8 rounded-r-full"
        style={{ background: `linear-gradient(to right, transparent, ${MOKA.placeholderTan})` }}
      />
    </div>
  );
}
