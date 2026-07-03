"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { MOKA } from "../_lib/theme";

function relativeTime(ts) {
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 30) return "à l'instant";
  if (diffSec < 60) return "il y a moins d'1 min";
  return `il y a ${Math.round(diffSec / 60)} min`;
}

// Data is server-fetched with a 2min cache (see getMenuData.js) — this shows
// how fresh it is and lets the customer force a re-fetch without a full page
// reload (router.refresh() re-runs the Server Component, not the browser).
export default function FreshnessIndicator({ generatedAt }) {
  const router = useRouter();
  const [label, setLabel] = useState(() => relativeTime(generatedAt));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setLabel(relativeTime(generatedAt));
    const id = setInterval(() => setLabel(relativeTime(generatedAt)), 30000);
    return () => clearInterval(id);
  }, [generatedAt]);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 800);
  }

  return (
    <button
      onClick={handleRefresh}
      className="flex items-center gap-1.5 mx-auto text-[11px] font-medium cursor-pointer px-3 py-3 -my-2"
      style={{ color: MOKA.brownLight }}
    >
      <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
      Menu {label}
    </button>
  );
}
