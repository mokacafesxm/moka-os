"use client";

import { MOKA } from "../_lib/theme";
import { slugify } from "../_lib/slug";
import CategoryIcon from "./CategoryIcon";

export default function CategoryNav({ categories }) {
  if (!categories.length) return null;

  function scrollToCategory(nom) {
    const el = document.getElementById(`cat-${slugify(nom)}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav
      className="sticky top-0 z-20 flex gap-4 overflow-x-auto px-4 py-3 backdrop-blur-md border-b"
      style={{ backgroundColor: `${MOKA.cream}f5`, borderColor: MOKA.brownLight }}
    >
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => scrollToCategory(cat.nom)}
          className="flex flex-col items-center gap-1 shrink-0 cursor-pointer"
        >
          <CategoryIcon nom={cat.nom} photo={cat.photo} />
          <span className="text-[11px] font-bold uppercase whitespace-nowrap" style={{ color: MOKA.brown }}>
            {cat.nom}
          </span>
        </button>
      ))}
    </nav>
  );
}
