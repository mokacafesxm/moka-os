"use client";

import Header from "./_components/Header";
import SearchBar from "./_components/SearchBar";
import { MOKA } from "./_lib/theme";

// Reuses the real (static) header components so there's no layout jump once
// the Notion-backed content below replaces this skeleton. Mirrors the
// two-column kiosk layout: a narrow rail skeleton + a grid skeleton.
export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: MOKA.cream }}>
      <Header />
      <SearchBar value="" onChange={() => {}} />

      <div className="flex items-start animate-pulse">
        <div className="shrink-0 w-20 md:w-56 flex flex-col gap-4 px-2 md:px-4 py-3 border-r" style={{ borderColor: MOKA.brownLight }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-14 h-14 rounded-full shrink-0" style={{ backgroundColor: MOKA.brownLight }} />
          ))}
        </div>

        <div className="flex-1 min-w-0 px-4 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-3xl" style={{ backgroundColor: "white" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
