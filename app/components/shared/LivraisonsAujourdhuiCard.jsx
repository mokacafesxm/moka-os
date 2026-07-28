"use client";

// Sprint 15 — carte "Livraison prévue aujourd'hui" en très grande évidence,
// partagée entre Bar, Cuisine et le dashboard Manager (voir poste/page.jsx
// et manager/page.jsx). Réutilise le vrai receiveModal (swipe par produit,
// voir ReceiveModal.jsx) — aucune logique de réception réécrite ici.

import { useMemo, useState } from "react";
import ReceiveModal, { parseOrderProducts } from "./ReceiveModal";

const SXM_TZ = "America/Puerto_Rico";

export function getSXMDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SXM_TZ }).format(date);
}

function groupBy(list, key) {
  const groups = {};
  for (const item of list) {
    const k = item[key] || "—";
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

export default function LivraisonsAujourdhuiCard({ orders, onReceived }) {
  const [receivingOrder, setReceivingOrder] = useState(null);
  const todaySXM = useMemo(() => getSXMDateString(), []);

  const today = useMemo(
    () => (orders || []).filter((o) => o.dateLivraisonPrevue?.slice(0, 10) === todaySXM && o.statut !== "Reçu"),
    [orders, todaySXM]
  );
  const grouped = useMemo(() => groupBy(today, "fournisseur"), [today]);
  const fournisseurs = Object.entries(grouped);

  if (fournisseurs.length === 0) return null;

  return (
    <div className="space-y-3">
      {fournisseurs.map(([fournisseur, group]) => {
        const order = group[0];
        const produitsCount = parseOrderProducts(order).length || group.length;
        return (
          <div key={fournisseur} className="bg-[#2c1a10] text-white rounded-3xl p-5 shadow-xl">
            <div className="text-sm font-black mb-1">🚚 Livraison prévue aujourd&apos;hui</div>
            <div className="text-lg font-black leading-tight">{fournisseur}</div>
            <div className="text-xs text-[#c8b4a8] font-semibold mb-4">
              {produitsCount} produit{produitsCount !== 1 ? "s" : ""}
            </div>
            <button
              type="button"
              onClick={() => setReceivingOrder(order)}
              className="w-full h-12 rounded-2xl bg-white text-[#2c1a10] text-sm font-black cursor-pointer active:scale-[0.98] transition-all"
            >
              ✅ Confirmer la réception →
            </button>
          </div>
        );
      })}

      {receivingOrder && (
        <ReceiveModal
          order={receivingOrder}
          onClose={() => setReceivingOrder(null)}
          onReceived={() => { setReceivingOrder(null); onReceived?.(); }}
        />
      )}
    </div>
  );
}
