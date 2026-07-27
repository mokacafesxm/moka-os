"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Stock/Commandes/Rapports pointent vers "/" (l'ancien page.js) — cette
// app n'a pas de deep-link par URL vers un onglet précis (activeTab /
// adminSection y sont de l'état React en mémoire, jamais reflété dans
// l'URL) et page.js reste intouché (règle en vigueur depuis Sprint 4).
// Un clic dans l'ancienne UI reste nécessaire pour atteindre l'onglet exact.
const ADMIN_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "📊", href: "/manager" },
  { key: "restaurant", label: "Restaurant", icon: "🏪", href: "/restaurant" },
  { key: "equipe", label: "Équipe", icon: "👥", href: "/equipe" },
  { key: "recettes", label: "Recettes", icon: "📖", href: "/recettes" },
  { key: "stock", label: "Stock", icon: "📦", href: "/" },
  { key: "commandes", label: "Commandes", icon: "📋", href: "/" },
  { key: "rapports", label: "Rapports", icon: "📈", href: "/" },
  { key: "incidents", label: "Incidents", icon: "🚨", href: "/incidents" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-2"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
    >
      <div
        className="flex items-stretch justify-between rounded-3xl px-2 py-1.5 mx-auto max-w-lg overflow-x-auto"
        style={{
          background: "rgba(247,239,228,0.45)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "0 8px 32px rgba(44,26,16,0.15), inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      >
        {ADMIN_ITEMS.map((item) => {
          const isActive = item.href !== "/" && pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-11 py-1.5 px-1 rounded-2xl cursor-pointer transition-colors shrink-0"
              style={{ background: isActive ? "rgba(255,255,255,0.7)" : "transparent" }}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span
                className={`text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${isActive ? "text-[#2c1a10]" : "text-[#9a7060]"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
