"use client";

import { useState } from "react";
import { MOKA } from "../_lib/theme";
import { formatPrice } from "../_lib/variants";

function HeartIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? MOKA.coral : "none"}
      stroke={filled ? MOKA.coral : MOKA.brownLight}
      strokeWidth="1.8"
      className="w-4 h-4"
    >
      <path d="M12 20.3s-7.5-4.6-9.8-9.1C.8 8 2.2 4.6 5.4 3.7c2-.55 4 .2 5 1.9 1-1.7 3-2.45 5-1.9 3.2.9 4.6 4.3 3.2 7.5-2.3 4.5-9.8 9.1-9.8 9.1Z" />
    </svg>
  );
}

export default function ProductCard({ product, onSelect, favorited, onToggleFavorite }) {
  const [pop, setPop] = useState(false);

  function handleToggleFavorite(e) {
    e.stopPropagation();
    onToggleFavorite(product.id);
    setPop(true);
    setTimeout(() => setPop(false), 300);
  }

  return (
    <div onClick={() => onSelect(product)} className="shrink-0 w-36 snap-start cursor-pointer">
      <div className="relative w-36 h-36 rounded-3xl overflow-hidden shadow-md bg-white active:scale-[0.97] transition-transform">
        {product.photo ? (
          <img src={product.photo} alt={product.nom} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#f0e4d4" }}>
            <span className="text-3xl font-bold" style={{ color: MOKA.brownLight }}>
              {product.nom.slice(0, 1)}
            </span>
          </div>
        )}

        {!product.disponible && (
          <span
            className="absolute top-2 left-2 text-[9px] font-bold px-2.5 py-1 rounded-full text-white uppercase tracking-wide"
            style={{ backgroundColor: MOKA.green }}
          >
            Back Soon
          </span>
        )}

        <button
          onClick={handleToggleFavorite}
          className="absolute top-0 right-0 w-11 h-11 flex items-center justify-center cursor-pointer"
          aria-label="Favori"
        >
          <span className={`w-7 h-7 rounded-xl bg-white shadow flex items-center justify-center ${pop ? "animate-pop" : ""}`}>
            <HeartIcon filled={favorited} />
          </span>
        </button>
      </div>

      <div className="mt-2 px-0.5">
        {product.categorie && (
          <div className="text-[10px] font-medium truncate" style={{ color: MOKA.brownLight }}>
            {product.categorie}
          </div>
        )}
        <div className="font-bold text-sm leading-tight line-clamp-1" style={{ color: MOKA.brown }}>
          {product.nom}
        </div>
        <div className="text-sm font-semibold mt-0.5" style={{ color: MOKA.brownLight }}>
          {product.hasVariants ? `Du ${formatPrice(product.priceFrom)}` : formatPrice(product.priceFrom)}
        </div>
      </div>
    </div>
  );
}
