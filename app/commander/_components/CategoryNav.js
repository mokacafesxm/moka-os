"use client";

import { MOKA } from "../_lib/theme";
import CategoryIcon from "./CategoryIcon";

export default function CategoryNav({ categories, activeCategory, onSelect }) {
  if (!categories.length) return null;

  return (
    <nav
      className="sticky top-0 z-20 backdrop-blur-md border-b px-4 py-3
                 flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar
                 md:grid md:overflow-visible md:snap-none md:justify-center md:gap-x-6 md:gap-y-5
                 md:[grid-template-columns:repeat(auto-fit,minmax(88px,112px))]"
      style={{ backgroundColor: `${MOKA.cream}f5`, borderColor: MOKA.brownLight }}
    >
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.nom)}
          aria-current={activeCategory === cat.nom ? "true" : undefined}
          className="w-20 md:w-auto flex flex-col items-center gap-1.5 shrink-0 snap-start cursor-pointer
                     md:hover:-translate-y-1 md:transition-transform md:duration-200"
        >
          <span
            className="rounded-full transition-shadow"
            style={activeCategory === cat.nom ? { boxShadow: `0 0 0 2px ${MOKA.green}` } : undefined}
          >
            <CategoryIcon nom={cat.nom} photo={cat.photo} />
          </span>
          <span
            className="text-[10px] md:text-xs font-bold uppercase text-center leading-tight break-words"
            style={{ color: MOKA.brown }}
          >
            {cat.nom}
          </span>
        </button>
      ))}
    </nav>
  );
}
