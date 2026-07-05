"use client";

import { MOKA } from "../_lib/theme";
import ProductGridTile from "./ProductGridTile";

export default function ProductGrid({ products, onSelectProduct, favorites, onToggleFavorite, emptyMessage }) {
  if (!products.length) {
    return (
      <div className="flex-1 min-w-0 py-16 px-4 text-center text-sm" style={{ color: MOKA.brownLight }}>
        {emptyMessage || "Aucun produit dans cette catégorie pour l'instant."}
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 px-4 py-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-5">
        {products.map((product) => (
          <ProductGridTile
            key={product.id}
            product={product}
            onSelect={onSelectProduct}
            favorited={favorites.has(product.id)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}
