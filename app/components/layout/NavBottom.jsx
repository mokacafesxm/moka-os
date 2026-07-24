"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { key: "home", label: "Accueil", icon: "🏠", href: "/home" },
  { key: "poste", label: "Mon Poste", icon: "🍽", href: "/poste" },
  { key: "taches", label: "Mes Tâches", icon: "✅", href: "/taches" },
  { key: "recherche", label: "Recherche", icon: "🔍", href: null },
  { key: "profil", label: "Profil", icon: "👤", href: null },
];

export default function NavBottom() {
  const pathname = usePathname();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-2"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
    >
      <div
        className="flex items-stretch justify-between rounded-3xl px-2 py-1.5 mx-auto max-w-md"
        style={{
          background: "rgba(247, 239, 228, 0.7)",
          backdropFilter: "blur(32px) saturate(180%)",
          WebkitBackdropFilter: "blur(32px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.5)",
          boxShadow: "0 8px 32px rgba(44,26,16,0.15), inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.href && pathname === item.href;
          const content = (
            <>
              <span className="text-lg leading-none">{item.icon}</span>
              <span
                className={`text-[9px] font-black uppercase tracking-wide ${isActive ? "text-[#5a7828]" : "text-[#9a7060]"}`}
              >
                {item.label}
              </span>
            </>
          );
          const className = `flex-1 flex flex-col items-center justify-center gap-0.5 min-h-11 py-1.5 rounded-2xl transition-colors ${
            item.href ? "cursor-pointer" : "cursor-default opacity-40"
          }`;
          const style = { background: isActive ? "rgba(90,120,40,0.14)" : "transparent" };

          if (!item.href) {
            return (
              <div key={item.key} className={className} style={style}>
                {content}
              </div>
            );
          }

          return (
            <Link key={item.key} href={item.href} className={className} style={style}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
