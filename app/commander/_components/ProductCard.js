"use client";

import { MOKA } from "../_lib/theme";
import { formatPrice } from "../_lib/variants";

export default function ProductCard({ product, onSelect }) {
  const clickable = product.hasVariants && product.disponible;

  return (
    <button
      onClick={clickable ? () => onSelect(product) : undefined}
      className={`shrink-0 w-40 text-left rounded-2xl border overflow-hidden bg-white snap-start ${
        clickable ? "cursor-pointer active:scale-[0.98] transition-transform" : "cursor-default"
      }`}
      style={{ borderColor: MOKA.border }}
    >
      <div className="relative w-40 h-32 bg-[#f0e4d4]">
        {product.photo ? (
          <img src={product.photo} alt={product.nom} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl font-bold" style={{ color: MOKA.textMuted }}>
              {product.nom.slice(0, 1)}
            </span>
          </div>
        )}
        {!product.disponible && (
          <span
            className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full text-white"
            style={{ backgroundColor: MOKA.brown }}
          >
            Bientôt de retour
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="font-bold text-sm leading-tight line-clamp-2" style={{ color: MOKA.brown }}>
          {product.nom}
        </div>
        {product.description && (
          <div className="text-xs mt-1 line-clamp-2" style={{ color: MOKA.textMuted }}>
            {product.description}
          </div>
        )}
        <div className="text-sm font-bold mt-2" style={{ color: MOKA.olive }}>
          {product.hasVariants ? `Dès ${formatPrice(product.priceFrom)}` : formatPrice(product.priceFrom)}
        </div>
      </div>
    </button>
  );
}
