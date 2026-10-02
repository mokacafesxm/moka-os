"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../../_lib/AdminAuthProvider";
import { STATUS_COLOR, formatDateHeure, formatEuros, paymentLabel } from "../_lib/format";

const NEXT_STATUS = { Nouvelle: "En préparation", "En préparation": "Prête", Prête: "Récupérée" };

export default function OrderDetailDrawer({ orderId, onClose, onStatusChanged }) {
  const { adminFetch } = useAdminAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminFetch(`/api/admin/orders/${orderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setOrder(data.order || null);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger cette commande.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, adminFetch]);

  async function advanceStatus() {
    if (!order) return;
    setAdvancing(true);
    setError("");
    try {
      // Not an /api/admin/* route — this is the same write-back the KDS
      // board already uses (see app/api/orders/status/route.js), reused
      // as-is rather than duplicated behind the admin Basic Auth gate.
      const res = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec");
      setOrder((prev) => ({ ...prev, prepStatus: data.status }));
      onStatusChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md sm:max-h-[85vh] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f0e8dc] text-[#2c1a10] font-black cursor-pointer flex items-center justify-center"
          aria-label="Fermer"
        >
          ×
        </button>

        {loading ? (
          <div className="text-sm text-[#9a7060] text-center py-10">…</div>
        ) : !order ? (
          <div className="text-sm text-[#9a7060] text-center py-10">Commande introuvable.</div>
        ) : (
          <>
            <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Commande</div>
            <h2 className="text-xl font-black text-[#2c1a10] -mt-0.5 mb-1">{order.code}</h2>
            <div className="text-xs text-[#9a7060] font-semibold mb-4">
              {formatDateHeure(order.createdAt)} · {order.client || "—"} · {order.telephone || "—"}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${STATUS_COLOR[order.prepStatus] || ""}`}>
                {order.prepStatus}
              </span>
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#f0e8dc] text-[#9a7060]">
                {paymentLabel(order.stripePaymentIntent)}
              </span>
              {order.reward && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                  🎁 {order.reward}
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-[#e5d5c5] p-3 mb-4 space-y-1.5">
              {order.items.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-semibold text-[#2c1a10]">
                      {item.qty}x {item.name}
                      {item.variant ? ` (${item.variant})` : ""}
                    </span>
                    {item.extras?.length > 0 && (
                      <div className="text-[11px] text-[#9a7060]">+ {item.extras.join(", ")}</div>
                    )}
                  </div>
                  <span className="text-[#2c1a10] font-black shrink-0">{formatEuros(item.price)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#e5d5c5]">
                <span className="text-sm font-black text-[#2c1a10]">Total</span>
                <span className="text-sm font-black text-[#2c1a10]">{formatEuros(order.total)}</span>
              </div>
            </div>

            {order.comment && (
              <div className="rounded-2xl bg-[#f7efe4] p-3 mb-4 text-sm text-[#2c1a10]">
                <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-1">Commentaire</div>
                {order.comment}
              </div>
            )}

            <div className="space-y-1 text-xs text-[#9a7060] font-semibold mb-4">
              <div>Créée le {formatDateHeure(order.createdAt)}</div>
              {order.readyAt && <div>Prête le {formatDateHeure(order.readyAt)}</div>}
              {order.pickedUpAt && <div>Récupérée le {formatDateHeure(order.pickedUpAt)}</div>}
            </div>

            {error && <div className="text-xs font-semibold text-red-700 mb-3">{error}</div>}

            <div className="flex gap-2">
              {NEXT_STATUS[order.prepStatus] && (
                <button
                  type="button"
                  onClick={advanceStatus}
                  disabled={advancing}
                  className="flex-1 h-11 rounded-xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer disabled:opacity-50"
                >
                  {advancing ? "…" : `→ ${NEXT_STATUS[order.prepStatus]}`}
                </button>
              )}
              {order.stripeUrl && (
                <a
                  href={order.stripeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 h-11 rounded-xl border border-[#e5d5c5] text-[#2c1a10] text-sm font-black cursor-pointer flex items-center justify-center"
                >
                  Rembourser ↗
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
