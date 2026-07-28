"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";
import ReceiveModal from "../../components/shared/ReceiveModal";

const STATUTS = ["À commander", "Envoyé", "Livraison prévue", "Reçu"];

function buildMessage(fournisseurNom, items) {
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "America/Puerto_Rico",
  });
  const lines = items.map((p) => `- ${p.name} — ${p.qty} ${p.unit}`).join("\n");
  return `Bonjour ${fournisseurNom} 👋\n\nCommande du ${dateStr} :\n\n${lines}\n\nMerci 🙏\n— Équipe MÖKA`;
}

function todaySXM() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date());
}

function Tabs({ tab, setTab }) {
  const items = [
    { key: "composer", label: "Composer" },
    { key: "historique", label: "Historique" },
    { key: "suivi", label: "Suivi" },
  ];
  return (
    <div className="flex gap-1.5 mb-4 bg-white/60 rounded-2xl p-1.5 border border-[#e5d5c5]">
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setTab(t.key)}
          className={`flex-1 h-10 rounded-xl text-xs font-black cursor-pointer transition-colors ${
            tab === t.key ? "bg-[#2c1a10] text-white" : "text-[#6b4a3d]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ComposerTab({ suppliers, products, onSent }) {
  const [supplierId, setSupplierId] = useState("");
  const [cart, setCart] = useState({});
  const [sending, setSending] = useState(false);
  const [sentOrder, setSentOrder] = useState(null); // { id, fournisseurNom } once posted, for the "livraison demain" prompt
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);

  const supplier = suppliers.find((s) => s.id === supplierId);
  const supplierProducts = useMemo(
    () => (supplier ? products.filter((p) => p.fournisseurDefaut === supplier.name) : []),
    [products, supplier]
  );

  const cartItems = supplierProducts
    .filter((p) => (cart[p.id] || 0) > 0)
    .map((p) => ({ id: p.id, name: p.name, qty: cart[p.id], unit: p.uniteCommande || p.unit || "" }));

  const setQty = (id, qty) => setCart((c) => ({ ...c, [id]: Math.max(0, qty) }));

  const reset = () => {
    setSupplierId("");
    setCart({});
    setSentOrder(null);
    setDeliveryConfirmed(false);
  };

  const send = async () => {
    if (!supplier || cartItems.length === 0) return;
    setSending(true);
    const message = buildMessage(supplier.name, cartItems);
    try {
      const res = await fetch("/api/supplier-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produit: `Order composée — ${supplier.name}`,
          quantite: cartItems.length,
          fournisseurId: supplier.id,
          fournisseur: supplier.name,
          statut: "Envoyé",
          source: "Commandes",
          message,
          produits: cartItems.map((p) => ({ name: p.name, qty: p.qty, unit: p.unit, produitId: p.id })),
        }),
      });
      const data = await res.json();
      if (supplier.whatsapp) {
        window.open(`https://wa.me/${String(supplier.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`, "_blank");
      }
      setSentOrder({ id: data.id, fournisseurNom: supplier.name });
      onSent();
    } catch (err) {
      console.error("[Commandes] send failed", err);
    } finally {
      setSending(false);
    }
  };

  const confirmLivraisonDemain = async () => {
    if (!sentOrder?.id) return;
    setConfirmingDelivery(true);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    try {
      await fetch("/api/supplier-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sentOrder.id, dateLivraisonPrevue: tomorrow }),
      });
      setDeliveryConfirmed(true);
    } catch (err) {
      console.error("[Commandes] confirmLivraisonDemain failed", err);
    } finally {
      setConfirmingDelivery(false);
    }
  };

  if (sentOrder) {
    return (
      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-5 text-center space-y-4">
        <div className="text-3xl">✅</div>
        <div className="font-black text-[#2c1a10]">Commande envoyée à {sentOrder.fournisseurNom}</div>
        {!deliveryConfirmed ? (
          <div className="rounded-2xl bg-[#fef3c7] border border-[#fcd34d] p-3 space-y-2">
            <div className="text-xs font-bold text-[#854f0b]">
              📦 Livraison prévue demain {new Date(Date.now() + 86400000).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
            </div>
            <button
              type="button"
              onClick={confirmLivraisonDemain}
              disabled={confirmingDelivery}
              className="w-full h-10 rounded-xl bg-[#854f0b] text-white text-xs font-black cursor-pointer disabled:opacity-50"
            >
              {confirmingDelivery ? "…" : "Confirmer livraison prévue"}
            </button>
          </div>
        ) : (
          <div className="text-xs font-bold text-[#5a7828]">🚚 Livraison demain confirmée</div>
        )}
        <button type="button" onClick={reset} className="text-xs font-bold text-[#9a7060] underline cursor-pointer">
          Nouvelle commande
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-2">Fournisseur</div>
        <select
          value={supplierId}
          onChange={(e) => { setSupplierId(e.target.value); setCart({}); }}
          className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] text-sm font-bold text-[#2c1a10] outline-none"
        >
          <option value="">Sélectionner…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {supplier && (
        <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-3">Produits</div>
          {supplierProducts.length === 0 ? (
            <div className="text-sm text-[#9a7060] py-2">Aucun produit rattaché à ce fournisseur</div>
          ) : (
            <div className="space-y-2">
              {supplierProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[#2c1a10]">{p.name}</div>
                    <div className="text-[10px] text-[#9a7060]">{p.uniteCommande || p.unit}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => setQty(p.id, (cart[p.id] || 0) - 1)} className="w-8 h-8 rounded-lg bg-[#f0e8dc] text-[#2c1a10] font-black cursor-pointer">−</button>
                    <span className="w-8 text-center font-black text-sm text-[#2c1a10]">{cart[p.id] || 0}</span>
                    <button type="button" onClick={() => setQty(p.id, (cart[p.id] || 0) + 1)} className="w-8 h-8 rounded-lg bg-[#f0e8dc] text-[#2c1a10] font-black cursor-pointer">+</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cartItems.length > 0 && (
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="w-full h-12 rounded-2xl bg-[#25D366] text-white text-sm font-black cursor-pointer disabled:opacity-50"
        >
          {sending ? "Envoi…" : `💬 Envoyer sur WhatsApp (${cartItems.length})`}
        </button>
      )}
    </div>
  );
}

function StatutBadge({ statut }) {
  const style = {
    "À commander": { bg: "#f0e8dc", color: "#9a7060" },
    "Envoyé": { bg: "#dbeafe", color: "#1e40af" },
    "Livraison prévue": { bg: "#fef3c7", color: "#854f0b" },
    "Reçu": { bg: "#f0f7e5", color: "#5a7828" },
    "Annulé": { bg: "#fee2e2", color: "#b91c1c" },
  }[statut] || { bg: "#f0e8dc", color: "#9a7060" };
  return (
    <span className="text-[9px] font-black px-2 py-1 rounded-lg shrink-0" style={{ background: style.bg, color: style.color }}>
      {statut}
    </span>
  );
}

function displayStatut(order) {
  if (order.statut === "Envoyé" && order.dateLivraisonPrevue) return "Livraison prévue";
  return order.statut;
}

const actionBtnClass = "flex-1 h-9 rounded-xl text-[11px] font-black cursor-pointer flex items-center justify-center gap-1";

// Statut-driven footer actions — "À commander" (WhatsApp/copier/marquer envoyé),
// "Envoyé" (re-envoyer/marquer reçu), "Reçu" (voir message), "Annulé" (rien).
function OrderActions({ order, suppliers, onMarkSent, onOpenReceive, onViewMessage, showToast }) {
  const statut = displayStatut(order);
  if (statut === "Annulé") return null;

  const supplier = suppliers.find((s) => s.name === order.fournisseur);
  const wa = supplier?.whatsapp;
  const message = order.message || `${order.fournisseur} — ${order.produit}`;
  const waHref = wa ? `https://wa.me/${String(wa).replace(/\D/g, "")}?text=${encodeURIComponent(message)}` : null;

  const copyMessage = (e) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(message).then(() => showToast("Message copié ✅"));
  };

  if (statut === "À commander") {
    return (
      <div className="flex gap-2 px-3.5 pb-3.5" onClick={(e) => e.stopPropagation()}>
        {waHref && (
          <a href={waHref} target="_blank" rel="noreferrer" className={`${actionBtnClass} bg-[#25D366] text-white`}>
            💬 WhatsApp
          </a>
        )}
        <button type="button" onClick={copyMessage} className={`${actionBtnClass} bg-[#f0e8dc] text-[#2c1a10]`}>
          📋 Copier
        </button>
        <button type="button" onClick={() => onMarkSent(order)} className={`${actionBtnClass} bg-[#5a7828] text-white`}>
          ✅ Envoyé
        </button>
      </div>
    );
  }

  if (statut === "Envoyé" || statut === "Livraison prévue") {
    return (
      <div className="flex gap-2 px-3.5 pb-3.5" onClick={(e) => e.stopPropagation()}>
        {waHref && (
          <a href={waHref} target="_blank" rel="noreferrer" className={`${actionBtnClass} bg-[#25D366] text-white`}>
            💬 Re-envoyer
          </a>
        )}
        <button type="button" onClick={() => onOpenReceive(order)} className={`${actionBtnClass} bg-[#5a7828] text-white`}>
          ✅ Marquer reçu
        </button>
      </div>
    );
  }

  if (statut === "Reçu" && order.message) {
    return (
      <div className="px-3.5 pb-3.5" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => onViewMessage(order)} className="text-[11px] font-bold text-[#9a7060] underline cursor-pointer">
          📋 Voir le message
        </button>
      </div>
    );
  }

  return null;
}

function HistoriqueTab({ orders, suppliers, onRefresh }) {
  const [filter, setFilter] = useState("Tous");
  const [detail, setDetail] = useState(null);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (text, type = "success") => setToast({ text, type });

  const withOverrides = useMemo(
    () => orders.map((o) => (overrides[o.id] ? { ...o, ...overrides[o.id] } : o)),
    [orders, overrides]
  );

  const filtered = withOverrides
    .filter((o) => filter === "Tous" || displayStatut(o) === filter)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // markOrderSent — same PATCH shape as the legacy page.js implementation:
  // statut "Envoyé" + dateEnvoi, then reflect it in the list immediately
  // rather than waiting on the next supplierOrders refresh.
  const markOrderSent = async (order) => {
    try {
      const res = await fetch("/api/supplier-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, statut: "Envoyé", dateEnvoi: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      setOverrides((cur) => ({ ...cur, [order.id]: { statut: "Envoyé" } }));
      showToast("Commande marquée comme envoyée ✅");
      onRefresh();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  };

  // markOrderReceived — opens the real receiveModal (swipe per product); the
  // saga behind /api/supplier-orders/receive flips statut to "Reçu" itself
  // once every line is confirmed, so this only needs to reflect it locally.
  const handleReceived = () => {
    if (receivingOrder) setOverrides((cur) => ({ ...cur, [receivingOrder.id]: { statut: "Reçu" } }));
    setReceivingOrder(null);
    showToast("Commande marquée comme reçue ✅");
    onRefresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["Tous", ...STATUTS].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer ${
              filter === s ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="text-center text-sm text-[#9a7060] py-10">Aucune commande</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const statut = displayStatut(o);
            const isAnnule = statut === "Annulé";
            return (
              <div
                key={o.id}
                className={`rounded-2xl border border-[#e5d5c5] bg-white overflow-hidden ${isAnnule ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setDetail(o)}
                  className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-black text-sm text-[#2c1a10] truncate">{o.fournisseur}</div>
                    <div className="text-[11px] text-[#9a7060]">{o.date?.slice(0, 10)}</div>
                  </div>
                  <StatutBadge statut={statut} />
                </button>
                <OrderActions
                  order={o}
                  suppliers={suppliers}
                  onMarkSent={markOrderSent}
                  onOpenReceive={setReceivingOrder}
                  onViewMessage={setDetail}
                  showToast={showToast}
                />
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-black text-[#2c1a10]">{detail.produit}</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-[#9a7060]">Fournisseur</span><span className="font-bold text-[#2c1a10]">{detail.fournisseur}</span></div>
              <div className="flex justify-between"><span className="text-[#9a7060]">Statut</span><span className="font-bold text-[#2c1a10]">{displayStatut(detail)}</span></div>
              <div className="flex justify-between"><span className="text-[#9a7060]">Date</span><span className="font-bold text-[#2c1a10]">{detail.date?.slice(0, 10)}</span></div>
              {detail.dateLivraisonPrevue && (
                <div className="flex justify-between"><span className="text-[#9a7060]">Livraison prévue</span><span className="font-bold text-[#2c1a10]">{detail.dateLivraisonPrevue.slice(0, 10)}</span></div>
              )}
              {detail.message && (
                <div className="pt-2 border-t border-[#e5d5c5] mt-2">
                  <div className="text-[10px] font-bold text-[#9a7060] uppercase mb-1">Message envoyé</div>
                  <div className="text-xs text-[#2c1a10] whitespace-pre-wrap">{detail.message}</div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setDetail(null)} className="w-full py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
              Fermer
            </button>
          </div>
        </div>
      )}

      {receivingOrder && (
        <ReceiveModal order={receivingOrder} onClose={() => setReceivingOrder(null)} onReceived={handleReceived} />
      )}

      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg"
          style={{ background: toast.type === "error" ? "#b91c1c" : "#5a7828" }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function SuiviTab({ orders }) {
  const today = todaySXM();
  const counts = STATUTS.reduce((acc, s) => ({ ...acc, [s]: orders.filter((o) => displayStatut(o) === s).length }), {});
  const livraisonsAujourdhui = orders.filter((o) => o.dateLivraisonPrevue?.slice(0, 10) === today && o.statut !== "Reçu").length;

  return (
    <div className="grid grid-cols-2 gap-3">
      {STATUTS.map((s) => (
        <div key={s} className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
          <div className="text-2xl font-black text-[#2c1a10]">{counts[s]}</div>
          <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mt-1">{s}</div>
        </div>
      ))}
      <div className="col-span-2 rounded-2xl border border-[#e5d5c5] bg-[#dbeafe] p-4">
        <div className="text-2xl font-black text-[#1e40af]">{livraisonsAujourdhui}</div>
        <div className="text-[10px] font-bold text-[#1e40af] uppercase tracking-wide mt-1">Livraisons prévues aujourd&apos;hui</div>
      </div>
    </div>
  );
}

export default function CommandesPage() {
  const router = useRouter();
  const { isAdmin, canCommandes } = useStaffContext();
  const { suppliers, products, supplierOrders, refreshSupplierOrders } = useAppContext();

  const [tab, setTab] = useState("composer");

  useEffect(() => {
    if (!isAdmin || !canCommandes) router.replace("/manager");
  }, [isAdmin, canCommandes, router]);

  if (!isAdmin || !canCommandes) return null;

  return (
    <div className="min-h-dvh px-4 py-4" style={{ background: "#f7efe4" }}>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Admin</div>
      <h1 className="text-xl font-black text-[#2c1a10] mb-4">🛒 Commandes fournisseurs</h1>

      <Tabs tab={tab} setTab={setTab} />

      {tab === "composer" && <ComposerTab suppliers={suppliers} products={products} onSent={refreshSupplierOrders} />}
      {tab === "historique" && <HistoriqueTab orders={supplierOrders} suppliers={suppliers} onRefresh={refreshSupplierOrders} />}
      {tab === "suivi" && <SuiviTab orders={supplierOrders} />}
    </div>
  );
}
