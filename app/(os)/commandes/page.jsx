"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";
import ReceiveModal, { getOrderSupplier } from "../../components/shared/ReceiveModal";
import InvoiceScanPrompt from "../../components/shared/InvoiceScanPrompt";

const STATUTS = ["À commander", "Envoyé", "Livraison prévue", "Reçu"];

// Format exact tel qu'envoyé sur WhatsApp — voir PreviewModal, qui affiche
// ce même texte avant envoi.
function buildMessage(fournisseurNom, items, staffName) {
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: "America/Puerto_Rico",
  });
  const lines = items.map((p) => `• ${p.name} × ${p.qty} ${p.unit}`).join("\n");
  return `Bonjour ${fournisseurNom},\nCommande MÖKA CAFÉ — ${dateStr}\nPar : ${staffName || "MÖKA CAFÉ"}\n\n${lines}\n\nMerci de confirmer.\nMÖKA CAFÉ SXM 🌴`;
}

function waLink(supplier, message) {
  if (!supplier?.whatsapp) return null;
  return `https://wa.me/${String(supplier.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

// Preview avant envoi — même texte, mêmes 3 actions, que la commande soit
// composée seule ou dans le carousel multi-fournisseur ci-dessous.
function PreviewModal({ supplier, items, staffName, onClose, onSent, onEdit }) {
  const [sending, setSending] = useState(false);
  const message = buildMessage(supplier.name, items, staffName);
  const href = waLink(supplier, message);

  const handleSend = async (openWhatsApp) => {
    setSending(true);
    if (openWhatsApp && href) window.open(href, "_blank");
    await onSent();
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">👁 Prévisualisation</div>
        <h2 className="text-base font-black text-[#2c1a10]">{supplier.name}</h2>
        <div className="rounded-2xl bg-white border border-[#e5d5c5] p-4 text-sm text-[#2c1a10] whitespace-pre-wrap leading-relaxed">
          {message}
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleSend(true)}
            disabled={sending || !href}
            className="w-full h-12 rounded-2xl bg-[#25D366] text-white text-sm font-black cursor-pointer disabled:opacity-50"
          >
            {sending ? "…" : "💬 Envoyer WhatsApp"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="flex-1 h-11 rounded-xl bg-[#f0e8dc] text-[#2c1a10] text-xs font-black cursor-pointer"
            >
              ✏️ Modifier
            </button>
            <button
              type="button"
              onClick={() => handleSend(false)}
              disabled={sending}
              className="flex-1 h-11 rounded-xl bg-[#5a7828] text-white text-xs font-black cursor-pointer disabled:opacity-50"
            >
              ✅ Marquer envoyé
            </button>
          </div>
        </div>
        <button type="button" onClick={onClose} className="w-full h-10 text-[#9a7060] font-bold text-xs cursor-pointer">
          Fermer
        </button>
      </div>
    </div>
  );
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
  const { selectedStaffName } = useStaffContext();
  const [stage, setStage] = useState("select"); // "select" | "carousel" | "done"
  const [selectedIds, setSelectedIds] = useState([]);
  const [carts, setCarts] = useState({}); // supplierId -> { productId: qty }
  const [sentIds, setSentIds] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);

  const activeSuppliers = suppliers.filter((s) => selectedIds.includes(s.id));
  const activeSupplier = activeSuppliers[activeIndex] || null;

  const productsFor = (supplierName) => products.filter((p) => p.fournisseurDefaut === supplierName);
  const cartItemsFor = (supplierId, supplierName) => {
    const cart = carts[supplierId] || {};
    return productsFor(supplierName)
      .filter((p) => (cart[p.id] || 0) > 0)
      .map((p) => ({ id: p.id, name: p.name, qty: cart[p.id], unit: p.uniteCommande || p.unit || "" }));
  };

  const setQty = (supplierId, productId, qty) =>
    setCarts((c) => ({ ...c, [supplierId]: { ...c[supplierId], [productId]: Math.max(0, qty) } }));

  const toggleSupplier = (id) =>
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const reset = () => {
    setStage("select");
    setSelectedIds([]);
    setCarts({});
    setSentIds([]);
    setActiveIndex(0);
  };

  // POST vers /api/supplier-orders — commun à l'envoi individuel (preview)
  // et à "Envoyer tous". N'ouvre jamais WhatsApp elle-même : ça reste
  // synchrone dans le handler de clic appelant, pour ne pas se faire
  // bloquer comme popup (voir sendAll ci-dessous).
  const submitOrder = async (supplier, items) => {
    const message = buildMessage(supplier.name, items, selectedStaffName);
    const res = await fetch("/api/supplier-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        produit: `Order composée — ${supplier.name}`,
        quantite: items.length,
        fournisseurId: supplier.id,
        fournisseur: supplier.name,
        statut: "Envoyé",
        source: "Commandes",
        message,
        produits: items.map((p) => ({ name: p.name, qty: p.qty, unit: p.unit, produitId: p.id })),
      }),
    });
    return res.json();
  };

  const handlePreviewSent = async () => {
    if (!activeSupplier) return;
    try {
      await submitOrder(activeSupplier, cartItemsFor(activeSupplier.id, activeSupplier.name));
      setSentIds((cur) => [...cur, activeSupplier.id]);
      onSent();
      setShowPreview(false);
      if (activeIndex < activeSuppliers.length - 1) setActiveIndex((i) => i + 1);
      else setStage("done");
    } catch (err) {
      console.error("[Commandes] send failed", err);
    }
  };

  const sendAll = () => {
    const pending = activeSuppliers.filter(
      (s) => !sentIds.includes(s.id) && cartItemsFor(s.id, s.name).length > 0
    );
    if (pending.length === 0) return;
    setSendingAll(true);
    // Ouvre tous les liens WhatsApp d'abord, synchrone dans ce handler — un
    // window.open() déclenché après un await/setTimeout se fait bloquer par
    // le navigateur comme popup non sollicité.
    pending.forEach((s) => {
      const items = cartItemsFor(s.id, s.name);
      const href = waLink(s, buildMessage(s.name, items, selectedStaffName));
      if (href) window.open(href, "_blank");
    });
    Promise.all(pending.map((s) => submitOrder(s, cartItemsFor(s.id, s.name))))
      .then(() => {
        setSentIds((cur) => [...cur, ...pending.map((s) => s.id)]);
        onSent();
        setStage("done");
      })
      .catch((err) => console.error("[Commandes] sendAll failed", err))
      .finally(() => setSendingAll(false));
  };

  if (stage === "done") {
    return (
      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-5 text-center space-y-4">
        <div className="text-3xl">✅</div>
        <div className="font-black text-[#2c1a10]">
          {activeSuppliers.length > 1
            ? `${activeSuppliers.length} commandes envoyées`
            : `Commande envoyée à ${activeSuppliers[0]?.name || ""}`}
        </div>
        <button type="button" onClick={reset} className="text-xs font-bold text-[#9a7060] underline cursor-pointer">
          Nouvelle commande
        </button>
      </div>
    );
  }

  if (stage === "select") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-3">Fournisseur(s)</div>
          <div className="space-y-1.5">
            {suppliers.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-[#e5d5c5] px-3.5 py-3 cursor-pointer"
                style={{ background: selectedIds.includes(s.id) ? "#f0f7e5" : "white" }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggleSupplier(s.id)}
                  className="w-4 h-4 accent-[#5a7828]"
                />
                <span className="text-sm font-bold text-[#2c1a10]">{s.name}</span>
              </label>
            ))}
          </div>
        </div>

        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => { setActiveIndex(0); setStage("carousel"); }}
            className="w-full h-12 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer"
          >
            Continuer ({selectedIds.length}) →
          </button>
        )}
      </div>
    );
  }

  // stage === "carousel"
  const cartItems = activeSupplier ? cartItemsFor(activeSupplier.id, activeSupplier.name) : [];
  const supplierProducts = activeSupplier ? productsFor(activeSupplier.name) : [];
  const isLast = activeIndex === activeSuppliers.length - 1;
  const nextSupplier = !isLast ? activeSuppliers[activeIndex + 1] : null;
  const anyCartHasItems = activeSuppliers.some((s) => cartItemsFor(s.id, s.name).length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={reset} className="text-xs font-bold text-[#9a7060] underline cursor-pointer">
          ← Fournisseurs
        </button>
        {activeSuppliers.length > 1 && (
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-[#2c1a10] text-white">
            Fournisseur {activeIndex + 1}/{activeSuppliers.length}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-black text-[#2c1a10]">{activeSupplier?.name}</div>
          {sentIds.includes(activeSupplier?.id) && (
            <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-[#f0f7e5] text-[#5a7828]">✅ Envoyé</span>
          )}
        </div>
        {supplierProducts.length === 0 ? (
          <div className="text-sm text-[#9a7060] py-2">Aucun produit rattaché à ce fournisseur</div>
        ) : (
          <div className="space-y-2">
            {supplierProducts.map((p) => {
              const qty = carts[activeSupplier.id]?.[p.id] || 0;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[#2c1a10]">{p.name}</div>
                    <div className="text-[10px] text-[#9a7060]">{p.uniteCommande || p.unit}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => setQty(activeSupplier.id, p.id, qty - 1)} className="w-8 h-8 rounded-lg bg-[#f0e8dc] text-[#2c1a10] font-black cursor-pointer">−</button>
                    <span className="w-8 text-center font-black text-sm text-[#2c1a10]">{qty}</span>
                    <button type="button" onClick={() => setQty(activeSupplier.id, p.id, qty + 1)} className="w-8 h-8 rounded-lg bg-[#f0e8dc] text-[#2c1a10] font-black cursor-pointer">+</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cartItems.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="w-full h-12 rounded-2xl bg-[#f0e8dc] text-[#2c1a10] text-sm font-black cursor-pointer"
        >
          👁 Prévisualiser
        </button>
      )}

      <div className="flex items-center gap-2">
        {activeIndex > 0 && (
          <button
            type="button"
            onClick={() => setActiveIndex((i) => i - 1)}
            className="h-11 px-4 rounded-xl border border-[#e5d5c5] bg-white text-xs font-black text-[#9a7060] cursor-pointer"
          >
            ← Précédent
          </button>
        )}
        {!isLast && (
          <div className="flex-1">
            <button
              type="button"
              onClick={() => setActiveIndex((i) => i + 1)}
              className="w-full h-11 rounded-xl bg-white border border-[#e5d5c5] text-xs font-black text-[#2c1a10] cursor-pointer"
            >
              Suivant →
            </button>
            {nextSupplier && (
              <div className="text-[10px] text-[#9a7060] text-center mt-1">{nextSupplier.name}</div>
            )}
          </div>
        )}
      </div>

      {activeSuppliers.length > 1 && anyCartHasItems && (
        <button
          type="button"
          onClick={sendAll}
          disabled={sendingAll}
          className="w-full h-12 rounded-2xl bg-[#25D366] text-white text-sm font-black cursor-pointer disabled:opacity-50"
        >
          {sendingAll ? "Envoi…" : "💬 Envoyer tous"}
        </button>
      )}

      {showPreview && activeSupplier && (
        <PreviewModal
          supplier={activeSupplier}
          items={cartItems}
          staffName={selectedStaffName}
          onClose={() => setShowPreview(false)}
          onEdit={() => setShowPreview(false)}
          onSent={handlePreviewSent}
        />
      )}
    </div>
  );
}

function displayStatut(order) {
  if (order.statut === "Envoyé" && order.dateLivraisonPrevue) return "Livraison prévue";
  return order.statut;
}

// Les commandes groupées (Composer) stockent leurs lignes dans le texte du
// message envoyé, pas en données structurées côté GET (voir /api/supplier-
// orders) — on les extrait ici pour l'aperçu "3 produits" de la card.
function parseProduitNames(message) {
  if (!message) return [];
  return message
    .split("\n")
    .filter((l) => /^[•-]/.test(l.trim()))
    .map((l) => l.replace(/^[•-]\s*/, "").split(/[×—]/)[0].trim())
    .filter(Boolean);
}

const HISTORIQUE_STATUT_BAND = {
  "Reçu": "bg-[#5a7828]",
  "Envoyé": "bg-blue-400",
  "Livraison prévue": "bg-blue-400",
  "À commander": "bg-orange-400",
};
const HISTORIQUE_STATUT_BADGE = {
  "Reçu": "bg-green-100 text-green-700",
  "Envoyé": "bg-blue-100 text-blue-700",
  "Livraison prévue": "bg-blue-100 text-blue-700",
  "À commander": "bg-orange-100 text-orange-700",
};

function HistoriqueCard({ order, suppliers, onSelect, onMarkSent, onOpenReceive, showToast }) {
  const statut = displayStatut(order);
  const produits = parseProduitNames(order.message);
  const nbProduits = order.quantite || produits.length || 1;
  const produitsLabel = produits.length > 0 ? produits : [order.produit];

  const supplier = suppliers.find((s) => s.name === order.fournisseur);
  const waHref = waLink(supplier, order.message || `${order.fournisseur} — ${order.produit}`);

  return (
    <div className="bg-white rounded-2xl border border-[#e5d5c5] shadow-sm overflow-hidden mb-3">
      <div className={`h-1.5 ${HISTORIQUE_STATUT_BAND[statut] || "bg-gray-300"}`} />
      <button type="button" onClick={() => onSelect(order)} className="w-full text-left cursor-pointer">
        <div className="p-4 pb-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="font-black text-[#2c1a10]">{order.fournisseur}</div>
              <div className="text-xs text-[#9a7060] mt-0.5">
                {order.date?.slice(0, 10)} · {nbProduits} produit{nbProduits > 1 ? "s" : ""}
              </div>
            </div>
            <span className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${HISTORIQUE_STATUT_BADGE[statut] || "bg-gray-100 text-gray-500"}`}>
              {statut}
            </span>
          </div>
          <div className="text-xs text-[#9a7060] truncate mb-3">
            {produitsLabel.slice(0, 3).join(" · ")}{produitsLabel.length > 3 ? ` +${produitsLabel.length - 3}` : ""}
          </div>
        </div>
      </button>
      <div className="flex gap-2 px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        {statut === "À commander" && (
          <>
            {waHref && (
              <a href={waHref} target="_blank" rel="noreferrer" className="flex-1 py-2 rounded-xl bg-green-500 text-white text-xs font-black text-center">
                💬 WhatsApp
              </a>
            )}
            <button type="button" onClick={() => onMarkSent(order)} className="flex-1 py-2 rounded-xl bg-[#f0e8dc] text-[#2c1a10] text-xs font-black cursor-pointer">
              ✅ Marquer envoyé
            </button>
          </>
        )}
        {(statut === "Envoyé" || statut === "Livraison prévue") && (
          <button type="button" onClick={() => onOpenReceive(order)} className="flex-1 py-2 rounded-xl bg-[#2c1a10] text-white text-xs font-black cursor-pointer">
            📦 Marquer reçu
          </button>
        )}
        <button type="button" onClick={() => onSelect(order)} className="py-2 px-3 rounded-xl border border-[#e5d5c5] text-xs text-[#9a7060] cursor-pointer">
          Détail →
        </button>
      </div>
    </div>
  );
}


function HistoriqueTab({ orders, suppliers, onRefresh }) {
  const [filter, setFilter] = useState("Tous");
  const [detail, setDetail] = useState(null);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [toast, setToast] = useState(null);
  const [showPostReceipt, setShowPostReceipt] = useState(false);
  const [lastReceivedFournisseur, setLastReceivedFournisseur] = useState("");

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
    // Capturé avant de vider receivingOrder — InvoiceScanPrompt en a besoin
    // pour /api/invoice-scan, rendu après ce reset.
    setLastReceivedFournisseur(receivingOrder ? (getOrderSupplier(receivingOrder) || receivingOrder.fournisseur || "") : "");
    setReceivingOrder(null);
    setShowPostReceipt(true);
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
        <div>
          {filtered.map((o) => (
            <HistoriqueCard
              key={o.id}
              order={o}
              suppliers={suppliers}
              onSelect={setDetail}
              onMarkSent={markOrderSent}
              onOpenReceive={setReceivingOrder}
              showToast={showToast}
            />
          ))}
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

      {showPostReceipt && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm shadow-lg">
          <InvoiceScanPrompt fournisseur={lastReceivedFournisseur} onDone={() => setShowPostReceipt(false)} />
        </div>
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
