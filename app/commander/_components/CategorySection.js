"use client";

import { MOKA } from "../_lib/theme";
import { slugify } from "../_lib/slug";
import ProductCard from "./ProductCard";

export default function CategorySection({ nom, produits, onSelectProduct, favorites, onToggleFavorite }) {
  if (!produits.length) return null;

  return (
    <section id={`cat-${slugify(nom)}`} className="scroll-mt-24 py-4">
      <h2 className="px-4 text-lg font-black mb-3 uppercase tracking-wide" style={{ color: MOKA.brown }}>
        {nom}
      </h2>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
        {produits.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={onSelectProduct}
            favorited={favorites.has(product.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </section>
  );
}
