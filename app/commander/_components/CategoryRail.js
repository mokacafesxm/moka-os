"use client";

import { MOKA } from "../_lib/theme";
import CategoryIcon from "./CategoryIcon";

// Kiosk-style category rail: sticky left column, icon-only-ish on mobile
// (~80px, label still fits below the icon), icon+label row on desktop
// (~224px). Only the sibling product grid scrolls — this rail sticks via
// position:sticky and scrolls internally if it's ever taller than the
// viewport (max-h-screen + overflow-y-auto). The thin scrollbar (rather
// than a hidden one) is what signals there's more to scroll to.
export default function CategoryRail({ categories, activeCategory, onSelect }) {
  if (!categories.length) return null;

  return (
    <aside
      className="sticky top-0 self-start shrink-0 max-h-screen overflow-y-auto category-rail-scroll
                 w-20 md:w-56 border-r"
      style={{ borderColor: `${MOKA.brownLight}33`, backgroundColor: `${MOKA.cream}f5` }}
    >
      {categories.map((cat) => {
        const isActive = activeCategory?.id === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat)}
            aria-current={isActive ? "true" : undefined}
            aria-label={cat.nom}
            className="w-full flex flex-col md:flex-row items-center gap-1.5 md:gap-3
                       px-2 md:px-4 py-3 cursor-pointer text-center md:text-left"
            style={isActive ? { backgroundColor: `${MOKA.green}1a` } : undefined}
          >
            <span
              className="rounded-full transition-shadow shrink-0"
              style={isActive ? { boxShadow: `0 0 0 2px ${MOKA.green}` } : undefined}
            >
              <CategoryIcon nom={cat.nom} photo={cat.photo} />
            </span>
            <span
              className="text-[0.625rem] md:text-sm font-bold uppercase leading-tight break-words"
              style={{ color: MOKA.brown }}
            >
              {cat.nom}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
