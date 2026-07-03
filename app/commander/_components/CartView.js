"use client";

import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { formatPrice } from "../_lib/variants";
import { useCart } from "../_lib/CartContext";

function CartLine({ item, onUpdateQty, onRemove }) {
  const lineTotal = item.price * item.qty;

  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm">
      <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0" style={{ backgroundColor: "#f0e4d4" }}>
        {item.photo ? (
          <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-xl font-bold" style={{ color: MOKA.brownLight }}>
              {item.name.slice(0, 1)}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate" style={{ color: MOKA.brown }}>
          {item.name}
        </div>
        {item.variant && (
          <div className="text-xs truncate" style={{ color: MOKA.brownLight }}>
            {item.variant}
          </div>
        )}
        <div
          className="flex items-center gap-2 mt-2 rounded-full border px-1 py-0.5 w-fit"
          style={{ borderColor: MOKA.brownLight }}
        >
          <button
            onClick={() => onUpdateQty(item.id, item.variant, item.qty - 1)}
            className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer font-bold"
            style={{ color: MOKA.brown }}
            aria-label="Retirer un"
          >
            −
          </button>
          <span className="w-4 text-center text-xs font-bold" style={{ color: MOKA.brown }}>
            {item.qty}
          </span>
          <button
            onClick={() => onUpdateQty(item.id, item.variant, item.qty + 1)}
            className="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer font-bold"
            style={{ color: MOKA.brown }}
            aria-label="Ajouter un"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col items-end justify-between self-stretch shrink-0">
        <button
          onClick={() => onRemove(item.id, item.variant)}
          aria-label="Supprimer"
          className="cursor-pointer"
          style={{ color: MOKA.brownLight }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <div className="text-right">
          <div className="text-[11px]" style={{ color: MOKA.brownLight }}>
            {formatPrice(item.price)}
          </div>
          <div className="font-bold text-sm" style={{ color: MOKA.brown }}>
            {formatPrice(lineTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartView({ onGoHome }) {
  const { items, subtotal, updateQty, removeItem, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center px-6 py-24">
        <ShoppingBag className="w-14 h-14 mb-4" style={{ color: MOKA.brownLight }} strokeWidth={1.5} />
        <p className="font-bold text-lg" style={{ color: MOKA.brown }}>
          Votre panier est vide
        </p>
        <button
          onClick={onGoHome}
          className="mt-5 px-6 py-3 rounded-2xl font-bold text-white cursor-pointer"
          style={{ backgroundColor: MOKA.coral }}
        >
          Voir le menu
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-40">
      <h2 className="text-lg font-black uppercase tracking-wide mb-3" style={{ color: MOKA.brown }}>
        Mon panier
      </h2>

      <div className="space-y-3">
        {items.map((item) => (
          <CartLine key={`${item.id}::${item.variant || ""}`} item={item} onUpdateQty={updateQty} onRemove={removeItem} />
        ))}
      </div>

      <div className="mt-6 pt-4 border-t" style={{ borderColor: `${MOKA.brownLight}33` }}>
        <div className="flex justify-between text-sm mb-1" style={{ color: MOKA.brownLight }}>
          <span>Sous-total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between font-bold text-base" style={{ color: MOKA.brown }}>
          <span>Total</span>
          <span>{formatPrice(subtotal)}</span>
        </div>

        <button onClick={clearCart} className="mt-3 text-xs underline cursor-pointer" style={{ color: MOKA.brownLight }}>
          Vider le panier
        </button>
      </div>

      <div className="fixed bottom-24 left-0 right-0 px-4 z-20">
        <Link
          href="/commander/checkout"
          className="block text-center py-3.5 rounded-2xl font-bold text-white shadow-lg"
          style={{ backgroundColor: MOKA.coral }}
        >
          Continuer — {formatPrice(subtotal)}
        </Link>
      </div>
    </div>
  );
}
