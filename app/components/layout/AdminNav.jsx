"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";

// Sprint 14 — Stock et Commandes ont maintenant leurs propres routes dans
// le nouveau shell (/stock, /commandes), migrées depuis adminSection
// "products"/"inventory"/"stock" et "orders" de l'ancien page.js. Seul
// Rapports pointe encore vers "/" (pas migré ce sprint).
const ADMIN_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "📊", href: "/manager" },
  { key: "restaurant", label: "Restaurant", icon: "🏪", href: "/restaurant" },
  { key: "equipe", label: "Équipe", icon: "👥", href: "/equipe" },
  { key: "commandes", label: "Commandes", icon: "🛒", href: "/commandes" },
  { key: "recettes", label: "Recettes", icon: "📖", href: "/recettes" },
  { key: "specials", label: "Spécial du mois", icon: "🍹", href: "/specials" },
  { key: "stock", label: "Stock", icon: "📦", href: "/stock" },
  { key: "rapports", label: "Rapports", icon: "📈", href: "/rapports" },
  { key: "incidents", label: "Incidents", icon: "🚨", href: "/incidents" },
  { key: "parametres", label: "Paramètres", icon: "⚙️", href: "/parametres" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const { canCommandes, setSplashDone, lockAdmin } = useStaffContext();

  // Sprint 13 — Commandes stays hidden unless the currently signed-in
  // identity has "Commandes" in Access (Thibaut/Guillaume only for now).
  const items = ADMIN_ITEMS.filter((item) => item.key !== "commandes" || canCommandes);

  // lockAdmin() ici, pas juste setSplashDone(false) : isAdmin vit dans
  // StaffProvider (jamais démonté par le retour au splash) — sans ça, un
  // staff choisi ensuite sur l'écran "Qui es-tu ?" hériterait à tort du
  // layout admin (AdminNav/sidebar) au lieu du sien.
  const changerSession = () => {
    lockAdmin();
    setSplashDone(false);
  };

  return (
    <>
      {/* Mobile (< md) — barre flottante en bas */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-2"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex justify-end pr-1 pb-1">
          <button
            type="button"
            onClick={changerSession}
            className="flex items-center gap-1.5 rounded-full bg-[#e8336d] text-white px-4 py-2 text-xs font-black cursor-pointer shrink-0 active:scale-[0.98] transition-transform"
          >
            <span aria-hidden="true">←</span>
            Changer de session
          </button>
        </div>
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
          {items.map((item) => {
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

      {/* Tablette (>= md) — sidebar gauche fixe, élargie à 64px, labels sous les icônes */}
      <div className="hidden md:flex md:flex-col md:fixed md:left-0 md:top-0 md:h-full md:w-16 md:border-r md:border-[#e5d5c5] md:bg-white md:pt-8 md:pb-4 md:items-center md:gap-1.5 md:overflow-y-auto z-40">
        {items.map((item) => {
          const isActive = item.href !== "/" && pathname === item.href;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="w-14 flex flex-col items-center justify-center gap-1 min-h-12 py-1.5 px-1 rounded-2xl cursor-pointer transition-colors shrink-0"
              style={{ background: isActive ? "rgba(90,120,40,0.14)" : "transparent" }}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span
                className={`text-[8px] font-black uppercase tracking-wide text-center leading-tight ${isActive ? "text-[#2c1a10]" : "text-[#9a7060]"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={changerSession}
          aria-label="Changer de session"
          title="Changer de session"
          className="mt-auto w-11 h-11 shrink-0 rounded-full bg-[#e8336d] text-white font-black flex items-center justify-center cursor-pointer active:scale-[0.98] transition-transform"
        >
          <span aria-hidden="true">←</span>
        </button>
      </div>
    </>
  );
}
