"use client";

// Sprint 15 — carte "Livraison prévue aujourd'hui" en très grande évidence,
// partagée entre Bar, Cuisine et le dashboard Manager (voir poste/page.jsx
// et manager/page.jsx). Réutilise le vrai receiveModal (swipe par produit,
// voir ReceiveModal.jsx) — aucune logique de réception réécrite ici.
//
// Sprint 18 — la card est désormais TOUJOURS affichée (jamais null) : sans
// livraison prévue aujourd'hui, une card grise discrète propose "Réception
// H&R" — un sélecteur parmi toutes les commandes "Envoyé" (peu importe leur
// date), pour les cas où une livraison arrive un autre jour que prévu.

import { useMemo, useState } from "react";
import ReceiveModal, { parseOrderProducts, getOrderSupplier } from "./ReceiveModal";
import InvoiceScanPrompt from "./InvoiceScanPrompt";

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

function OrderPickerModal({ orders, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">📦 Livraison reçue</h2>
        <p className="text-xs text-[#9a7060]">Sélectionne la commande reçue à réceptionner.</p>

        {orders.length === 0 ? (
          <div className="text-sm text-[#9a7060] py-4 text-center">Aucune commande envoyée en attente de réception</div>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => {
              const nbProduits = parseOrderProducts(o).length || 1;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onPick(o)}
                  className="w-full flex items-center justify-between rounded-xl border border-[#e5d5c5] bg-white p-3 text-left cursor-pointer"
                >
                  <div>
                    <div className="text-sm font-bold text-[#2c1a10]">{getOrderSupplier(o) || o.fournisseur}</div>
                    <div className="text-[11px] text-[#9a7060]">{o.date?.slice(0, 10)} · {nbProduits} produit{nbProduits !== 1 ? "s" : ""}</div>
                  </div>
                  <span className="text-[#9a7060]">→</span>
                </button>
              );
            })}
          </div>
        )}

        <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
          Fermer
        </button>
      </div>
    </div>
  );
}

export default function LivraisonsAujourdhuiCard({ orders, onReceived }) {
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showPostReceipt, setShowPostReceipt] = useState(false);
  const [lastReceivedFournisseur, setLastReceivedFournisseur] = useState("");
  const todaySXM = useMemo(() => getSXMDateString(), []);

  const today = useMemo(
    () => (orders || []).filter((o) => o.dateLivraisonPrevue?.slice(0, 10) === todaySXM && o.statut !== "Reçu"),
    [orders, todaySXM]
  );
  const grouped = useMemo(() => groupBy(today, "fournisseur"), [today]);
  const fournisseurs = Object.entries(grouped);

  const envoyees = useMemo(() => (orders || []).filter((o) => o.statut === "Envoyé"), [orders]);

  const handleReceived = () => {
    // Capturé avant de vider receivingOrder — InvoiceScanPrompt en a besoin
    // pour /api/invoice-scan, rendu après ce reset.
    setLastReceivedFournisseur(receivingOrder ? (getOrderSupplier(receivingOrder) || receivingOrder.fournisseur || "") : "");
    setReceivingOrder(null);
    setShowPostReceipt(true);
    onReceived?.();
  };

  const dismissPostReceipt = () => setShowPostReceipt(false);

  if (fournisseurs.length === 0) {
    return (
      <>
        <div className="rounded-2xl border border-[#e5d5c5] bg-[#f0e8dc] p-4">
          <div className="text-sm font-bold text-[#9a7060] mb-3">📦 Aucune livraison prévue aujourd&apos;hui</div>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="w-full h-11 rounded-2xl border border-[#e5d5c5] bg-white text-sm font-black text-[#2c1a10] cursor-pointer active:scale-[0.98] transition-all"
          >
            Livraison reçue
          </button>
        </div>

        {showPicker && (
          <OrderPickerModal
            orders={envoyees}
            onClose={() => setShowPicker(false)}
            onPick={(o) => { setShowPicker(false); setReceivingOrder(o); }}
          />
        )}

        {receivingOrder && (
          <ReceiveModal order={receivingOrder} onClose={() => setReceivingOrder(null)} onReceived={handleReceived} />
        )}

        {showPostReceipt && (
          <InvoiceScanPrompt fournisseur={lastReceivedFournisseur} onDone={dismissPostReceipt} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {fournisseurs.map(([fournisseur, group]) => {
        const order = group[0];
        const produitsCount = parseOrderProducts(order).length || group.length;
        return (
          <div key={fournisseur} className="rounded-3xl p-5 shadow-xl text-white" style={{ background: "#d97706" }}>
            <div className="text-sm font-black mb-1">🚚 Livraison prévue · {fournisseur}</div>
            <div className="text-xs text-white/80 font-semibold mb-4">
              {produitsCount} produit{produitsCount !== 1 ? "s" : ""}
            </div>
            <button
              type="button"
              onClick={() => setReceivingOrder(order)}
              className="w-full h-12 rounded-2xl bg-white text-[#2c1a10] text-sm font-black cursor-pointer active:scale-[0.98] transition-all"
            >
              Réceptionner →
            </button>
          </div>
        );
      })}

      {receivingOrder && (
        <ReceiveModal order={receivingOrder} onClose={() => setReceivingOrder(null)} onReceived={handleReceived} />
      )}

      {showPostReceipt && (
        <InvoiceScanPrompt fournisseur={lastReceivedFournisseur} onDone={dismissPostReceipt} />
      )}
    </div>
  );
}
