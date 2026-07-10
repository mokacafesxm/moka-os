"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { MOKA } from "../_lib/theme";
import { formatPrice, groupOptionValues, findMatchingVariant } from "../_lib/variants";
import { useModalA11y } from "../_lib/useModalA11y";
import VariantSegmented from "./VariantSegmented";
import ExtrasGroup from "./ExtrasGroup";

const DESCRIPTION_TRUNCATE_LENGTH = 90;

export default function ProductPopup({ product, onClose, onAdd }) {
  const optionGroups = product.hasVariants ? groupOptionValues(product.variants) : [];
  const extraGroups = product.extras || [];

  const [selection, setSelection] = useState(() => {
    const initial = {};
    if (product.hasVariants) {
      for (const { name, value } of product.variants[0]?.options || []) initial[name] = value;
    }
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [descExpanded, setDescExpanded] = useState(false);
  // Optional add-ons, kept separate from `selection` (the mandatory Variantes
  // dimensions): { [groupName]: string | null } for "single" groups,
  // { [groupName]: string[] } for "multi" groups.
  const [extrasSelection, setExtrasSelection] = useState({});
  const [extrasFreeText, setExtrasFreeText] = useState({}); // { [optionLabel]: string }

  const matchedVariant = product.hasVariants ? findMatchingVariant(product.variants, selection) : null;
  const baseUnitPrice = matchedVariant ? parseFloat(matchedVariant.price) : product.priceFrom;
  const variantLabel = product.hasVariants ? Object.values(selection).join(", ") : null;

  // Every selected extra option's price, flattened across all groups.
  // Depends on `product.extras` (stable reference from getMenuData) rather
  // than the `extraGroups` fallback expression, which would otherwise be a
  // fresh array literal every render.
  const selectedExtraOptions = useMemo(() => {
    const result = [];
    for (const group of extraGroups) {
      const picked = extrasSelection[group.name];
      const labels = group.type === "multi" ? picked || [] : picked ? [picked] : [];
      for (const label of labels) {
        const option = group.options.find((o) => o.label === label);
        if (option) result.push({ group: group.name, option });
      }
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.extras, extrasSelection]);

  const extrasCost = selectedExtraOptions.reduce((sum, { option }) => sum + (option.price || 0), 0);
  const unitPrice = baseUnitPrice + extrasCost;
  const total = unitPrice * quantity;

  // Human-readable lines for the cart/order text — same simple-string
  // convention as `variant`, so downstream (cart, order confirmation) doesn't
  // need to understand the extras data shape at all.
  const extrasLines = selectedExtraOptions.map(({ option }) => {
    const detail = option.freeText && extrasFreeText[option.label]?.trim() ? `: ${extrasFreeText[option.label].trim()}` : "";
    const priceSuffix = option.price > 0 ? ` (+${formatPrice(option.price)})` : "";
    return `${option.label}${detail}${priceSuffix}`;
  });

  function toggleExtra(groupName, type, label) {
    setExtrasSelection((prev) => {
      if (type === "multi") {
        const current = prev[groupName] || [];
        const next = current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
        return { ...prev, [groupName]: next };
      }
      // single: clicking the selected chip again clears it (optional group).
      return { ...prev, [groupName]: prev[groupName] === label ? null : label };
    });
  }

  const isLongDescription = (product.description?.length || 0) > DESCRIPTION_TRUNCATE_LENGTH;
  const dialogRef = useModalA11y(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-popup-title"
        tabIndex={-1}
        className="relative w-full max-h-[90vh] rounded-t-3xl flex flex-col overflow-hidden animate-sheet-up outline-none"
        style={{ backgroundColor: MOKA.cream }}
      >
        <div className="overflow-y-auto flex-1">
          <div className="relative w-full h-60 shrink-0" style={{ backgroundColor: MOKA.placeholderTan }}>
            {product.photo ? (
              <Image src={product.photo} alt={product.nom} fill priority sizes="100vw" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-5xl font-bold" style={{ color: MOKA.brownLight }}>
                  {product.nom.slice(0, 1)}
                </span>
              </div>
            )}

            {!product.disponible && (
              <span
                className="absolute top-3 left-3 text-[0.625rem] font-bold px-2.5 py-1 rounded-full text-white uppercase tracking-wide"
                style={{ backgroundColor: MOKA.green }}
              >
                Back Soon
              </span>
            )}

            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white shadow flex items-center justify-center cursor-pointer"
              style={{ color: MOKA.brown }}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          <div className="p-5">
            {product.categorie && (
              <div className="text-xs font-medium mb-1" style={{ color: MOKA.brownLight }}>
                {product.categorie}
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <h2 id="product-popup-title" className="text-xl font-black flex-1" style={{ color: MOKA.brown }}>
                {product.nom}
              </h2>
              <span className="text-2xl font-black shrink-0" style={{ color: MOKA.coral }}>
                {product.hasVariants ? `Dès ${formatPrice(product.priceFrom)}` : formatPrice(product.priceFrom)}
              </span>
            </div>

            {product.description && (
              <div>
                <p
                  className={`text-sm mt-2 ${!descExpanded && isLongDescription ? "line-clamp-2" : ""}`}
                  style={{ color: MOKA.brownLight }}
                >
                  {product.description}
                </p>
                {isLongDescription && (
                  <button
                    onClick={() => setDescExpanded((v) => !v)}
                    className="text-xs font-bold mt-1 cursor-pointer p-3.5 -m-3.5 min-h-[44px]"
                    style={{ color: MOKA.brown }}
                  >
                    {descExpanded ? "Voir moins" : "Voir plus"}
                  </button>
                )}
              </div>
            )}

            {optionGroups.map((group) => (
              <div key={group.name} className="mt-5">
                <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MOKA.brownLight }}>
                  {group.name}
                </div>
                <VariantSegmented
                  options={group.values}
                  selected={selection[group.name]}
                  onSelect={(value) => setSelection((s) => ({ ...s, [group.name]: value }))}
                />
              </div>
            ))}

            {extraGroups.map((group) => (
              <ExtrasGroup
                key={group.name}
                group={group}
                selected={extrasSelection[group.name] ?? (group.type === "multi" ? [] : null)}
                freeText={extrasFreeText}
                onToggle={(label, type) => toggleExtra(group.name, type, label)}
                onFreeTextChange={(label, value) => setExtrasFreeText((prev) => ({ ...prev, [label]: value }))}
              />
            ))}
          </div>
        </div>

        <div
          className="shrink-0 flex items-center gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t"
          style={{ borderColor: `${MOKA.brownLight}33`, backgroundColor: MOKA.cream }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center cursor-pointer font-bold"
              style={{ color: MOKA.brown }}
              aria-label="Retirer un"
            >
              −
            </button>
            <span className="w-5 text-center font-bold text-sm" style={{ color: MOKA.brown }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center cursor-pointer font-bold"
              style={{ color: MOKA.brown }}
              aria-label="Ajouter un"
            >
              +
            </button>
          </div>

          <button
            onClick={() => product.disponible && onAdd({ variantLabel, unitPrice, quantity, extras: extrasLines })}
            disabled={!product.disponible}
            className={`flex-1 py-3.5 rounded-full font-bold text-white flex items-center justify-center gap-2 min-h-[44px] ${
              product.disponible ? "cursor-pointer" : "cursor-not-allowed opacity-60"
            }`}
            style={{ backgroundColor: product.disponible ? MOKA.coral : MOKA.brownLight }}
          >
            {product.disponible ? `Ajouter au panier — ${formatPrice(total)}` : "Indisponible"}
          </button>
        </div>
      </div>
    </div>
  );
}
