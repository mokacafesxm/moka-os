"use client";

import { useMemo, useState } from "react";
import { MOKA } from "../_lib/theme";
import { formatPrice, groupOptionValues, findMatchingVariant } from "../_lib/variants";
import VariantTile from "./VariantTile";

export default function ProductBottomSheet({ product, onClose, onAdd }) {
  const optionGroups = useMemo(() => groupOptionValues(product.variants), [product]);

  const [selection, setSelection] = useState(() => {
    const initial = {};
    for (const { name, value } of product.variants[0]?.options || []) initial[name] = value;
    return initial;
  });

  const matchedVariant = findMatchingVariant(product.variants, selection);
  const price = matchedVariant ? parseFloat(matchedVariant.price) : product.priceFrom;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        style={{ backgroundColor: MOKA.cream }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xl font-black" style={{ color: MOKA.brown }}>
              {product.nom}
            </h3>
            {product.description && (
              <p className="text-sm mt-1" style={{ color: MOKA.brownLight }}>
                {product.description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: "white", color: MOKA.brown }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {optionGroups.map((group) => (
          <div key={group.name} className="mb-4">
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MOKA.brownLight }}>
              {group.name}
            </div>
            <div className="flex flex-wrap gap-2">
              {group.values.map((value) => (
                <VariantTile
                  key={value}
                  label={value}
                  selected={selection[group.name] === value}
                  onClick={() => setSelection((s) => ({ ...s, [group.name]: value }))}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="mt-6 pt-4 border-t" style={{ borderColor: MOKA.brownLight }}>
          <button
            onClick={onAdd}
            className="w-full py-3.5 rounded-2xl font-bold text-white cursor-pointer flex items-center justify-center gap-2"
            style={{ backgroundColor: MOKA.coral }}
          >
            Ajouter — {formatPrice(price)}
          </button>
        </div>
      </div>
    </div>
  );
}
