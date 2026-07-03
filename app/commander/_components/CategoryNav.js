"use client";

import { MOKA } from "../_lib/theme";
import CategoryIcon from "./CategoryIcon";

export default function CategoryNav({ categories, activeCategory, onSelect }) {
  if (!categories.length) return null;

  return (
    <nav
      className="sticky top-0 z-20 flex gap-4 overflow-x-auto px-4 py-3 backdrop-blur-md border-b"
      style={{ backgroundColor: `${MOKA.cream}f5`, borderColor: MOKA.brownLight }}
    >
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.nom)}
          className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
        >
          <span
            className="rounded-full transition-shadow"
            style={activeCategory === cat.nom ? { boxShadow: `0 0 0 2px ${MOKA.coral}` } : undefined}
          >
            <CategoryIcon nom={cat.nom} photo={cat.photo} />
          </span>
          <span className="text-[11px] font-bold uppercase whitespace-nowrap" style={{ color: MOKA.brown }}>
            {cat.nom}
          </span>
        </button>
      ))}
    </nav>
  );
}
