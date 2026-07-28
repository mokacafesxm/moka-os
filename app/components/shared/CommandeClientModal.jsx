"use client";

// Sprint 17 — "Nouvelle commande client" : prend une commande à table/comptoir
// et l'envoie sur le vrai tableau KDS (app/_components/ClientOrdersKDS.js,
// alimenté par la même base Notion "Commandes clients" que le site public
// /commander) via /api/orders/staff-create — pas un système parallèle.

import { useMemo, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { useStaffContext } from "../../contexts/StaffContext";

export default function CommandeClientModal({ onClose }) {
  const { products } = useAppContext();
  const { selectedStaffName } = useStaffContext();

  const [activeCategory, setActiveCategory] = useState("Tous");
  const [cart, setCart] = useState({}); // id -> qty
  const [tableName, setTableName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null); // orderCode once sent

  const catalogue = useMemo(() => products.filter((p) => p.visibleOrderPad === true), [products]);
  const categories = useMemo(
    () => ["Tous", ...Array.from(new Set(catalogue.map((p) => p.category).filter(Boolean)))],
    [catalogue]
  );
  const filtered = useMemo(
    () => (activeCategory === "Tous" ? catalogue : catalogue.filter((p) => p.category === activeCategory)),
    [catalogue, activeCategory]
  );

  const setQty = (id, qty) => setCart((c) => {
    const next = { ...c };
    if (qty <= 0) delete next[id];
    else next[id] = qty;
    return next;
  });

  const cartItems = catalogue
    .filter((p) => (cart[p.id] || 0) > 0)
    .map((p) => ({ id: p.id, name: p.name, qty: cart[p.id], unit: p.unit || "" }));

  const send = async () => {
    if (cartItems.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/staff-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartItems, tableName, staffName: selectedStaffName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setSent(data.orderCode);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative w-full max-w-sm rounded-3xl bg-[#f5ede0] p-6 shadow-2xl text-center space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="text-4xl">✅</div>
          <div className="text-lg font-black text-[#2c1a10]">Commande envoyée ✅</div>
          <div className="text-sm text-[#9a7060]">{sent}</div>
          <button type="button" onClick={onClose} className="w-full h-11 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div
        className="relative w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pt-5 pb-3 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#2c1a10]">🛎 Nouvelle commande client</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] cursor-pointer font-black"
          >
            ×
          </button>
        </div>

        <div className="shrink-0 px-5 pb-3">
          <input
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="Table / Nom (optionnel)"
            className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-2.5 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
          />
        </div>

        <div className="shrink-0 px-5 pb-3 flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer ${
                activeCategory === c ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-[#9a7060] py-10">Aucun produit disponible</div>
          ) : (
            filtered.map((p) => {
              const qty = cart[p.id] || 0;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-2xl border border-[#e5d5c5] bg-white p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[#2c1a10] truncate">{p.name}</div>
                    {p.category && <div className="text-[10px] text-[#9a7060]">{p.category}</div>}
                  </div>
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => setQty(p.id, 1)}
                      className="shrink-0 h-9 px-4 rounded-xl bg-[#f0e8dc] text-[#2c1a10] text-xs font-black cursor-pointer"
                    >
                      + Ajouter
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => setQty(p.id, qty - 1)} className="w-8 h-8 rounded-lg bg-[#f0e8dc] text-[#2c1a10] font-black cursor-pointer">−</button>
                      <span className="w-6 text-center font-black text-sm text-[#2c1a10]">{qty}</span>
                      <button type="button" onClick={() => setQty(p.id, qty + 1)} className="w-8 h-8 rounded-lg bg-[#f0e8dc] text-[#2c1a10] font-black cursor-pointer">+</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="shrink-0 px-5 pt-3 pb-5 border-t border-[#e5d5c5] space-y-2" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
          {error && <div className="text-xs font-bold text-red-600">{error}</div>}
          <button
            type="button"
            onClick={send}
            disabled={cartItems.length === 0 || sending}
            className="w-full h-12 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {sending ? "Envoi…" : `Envoyer en cuisine${cartItems.length > 0 ? ` (${cartItems.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
