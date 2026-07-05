"use client";

import Image from "next/image";
import { MOKA } from "../_lib/theme";
import { formatPrice } from "../_lib/variants";

function CompactTile({ product, onSelect }) {
  return (
    <button onClick={() => onSelect(product)} className="text-left cursor-pointer">
      <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-white shadow-sm">
        {product.photo ? (
          <Image
            src={product.photo}
            alt={product.nom}
            fill
            sizes="(min-width: 1024px) 16vw, (min-width: 768px) 25vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: MOKA.placeholderTan }}>
            <span className="text-xl font-bold" style={{ color: MOKA.brownLight }}>
              {product.nom.slice(0, 1)}
            </span>
          </div>
        )}
        {!product.disponible && (
          <span
            className="absolute top-1.5 left-1.5 text-[8px] font-bold px-2 py-0.5 rounded-full text-white uppercase"
            style={{ backgroundColor: MOKA.green }}
          >
            Back Soon
          </span>
        )}
      </div>
      <div className="mt-1.5 text-xs font-bold leading-tight line-clamp-1" style={{ color: MOKA.brown }}>
        {product.nom}
      </div>
      <div className="text-[11px] font-semibold" style={{ color: MOKA.brownLight }}>
        {product.hasVariants ? `Du ${formatPrice(product.priceFrom)}` : formatPrice(product.priceFrom)}
      </div>
    </button>
  );
}

export default function CategoryPanel({ categoryName, products, onSelectProduct }) {
  const open = !!categoryName;
  const items = open ? products.filter((p) => p.categorie === categoryName) : [];

  return (
    <div
      className={`grid transition-all duration-300 ease-in-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <div
          className="px-4 py-4 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-4 border-b"
          style={{ borderColor: `${MOKA.brownLight}33` }}
        >
          {items.length === 0 ? (
            <div className="col-span-3 text-sm py-6 text-center" style={{ color: MOKA.brownLight }}>
              Aucun produit dans cette catégorie pour l'instant.
            </div>
          ) : (
            items.map((p) => <CompactTile key={p.id} product={p} onSelect={onSelectProduct} />)
          )}
        </div>
      </div>
    </div>
  );
}
