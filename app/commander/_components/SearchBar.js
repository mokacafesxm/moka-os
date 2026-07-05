"use client";

import { forwardRef } from "react";
import { MOKA } from "../_lib/theme";

const SearchBar = forwardRef(function SearchBar({ value, onChange }, ref) {
  return (
    <div className="px-4 pb-3">
      <div
        className="flex items-center gap-2 rounded-full border bg-white px-4 py-2.5 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-[#587F25]"
        style={{ borderColor: MOKA.brownLight }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke={MOKA.brownLight} strokeWidth="2" className="w-4 h-4 shrink-0">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <label htmlFor="commander-search" className="sr-only">
          Rechercher un produit
        </label>
        <input
          id="commander-search"
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full bg-transparent outline-none text-sm placeholder:text-[#976146]"
          style={{ color: MOKA.brown }}
        />
      </div>
    </div>
  );
});

export default SearchBar;
