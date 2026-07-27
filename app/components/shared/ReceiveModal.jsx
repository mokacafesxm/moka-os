"use client";

// Sprint 14 — faithful extraction of the receiveModal built inline in the
// old app/(os)/page.js (swipe-per-product, quantité reçue/unité, confirmed-
// so-far list) so it can be genuinely reused from /poste's Livraisons
// section instead of being reimplemented. page.js's own inline modal is
// left untouched (same risk-averse call as everywhere else in this
// migration: don't refactor a business-critical, daily-use flow just to
// dedupe code) — this is a parallel, identical copy, not a shared import.

import { useMemo, useRef, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";

function parseOrderProducts(order) {
  const isNew = (s) => !String(s || "").toLowerCase().includes("new order");

  const parseString = (s) => {
    const cleaned = s.replace(/^[•\-]\s*/, "").trim();
    const crossIdx = cleaned.indexOf(" × ");
    const dashIdx = cleaned.indexOf(" — ");
    const sepIdx = crossIdx !== -1 ? crossIdx : dashIdx;
    if (sepIdx === -1) return { name: cleaned, qty: 1, unit: "" };
    const name = cleaned.slice(0, sepIdx).trim();
    const qtyUnit = cleaned.slice(sepIdx + 3).trim();
    const m = qtyUnit.match(/^([0-9.,]+)\s*(.*)$/);
    return { name, qty: m ? parseFloat(m[1].replace(",", ".")) || 1 : 1, unit: m ? m[2].trim() : "" };
  };

  const parseMessageLines = (msg) =>
    String(msg || "").split("\n")
      .filter((l) => /^[•\-]/.test(l.trim()))
      .map((l) => {
        const cleaned = l.replace(/^[•\-]\s*/, "").trim();
        const m = cleaned.match(/^(.+?)\s*[×x]\s*([0-9.,]+)\s*(.*)$/i)
          || cleaned.match(/^(.+?)\s*—\s*([0-9.,]+)\s*(.*)$/);
        if (!m) return { name: cleaned, qty: 1, unit: "" };
        return { name: m[1].trim(), qty: parseFloat(m[2].replace(",", ".")) || 1, unit: m[3].trim() };
      })
      .filter((p) => p.name && isNew(p.name));

  const produitsArray = order.produits || order.products || order.items || order.Items || [];
  if (Array.isArray(produitsArray) && produitsArray.length > 0) {
    const parsed = produitsArray.map((p) =>
      typeof p === "string"
        ? parseString(p)
        : { name: p.produit || p.ingredient || p.name || p.Produit || "", qty: Number(p.quantite || p.qty || p.Quantite || 1), unit: p.unite || p.unit || p.Unite || "" }
    ).filter((p) => p.name && isNew(p.name));
    if (parsed.length > 0) return parsed;
  }

  const produitName = order.produit || order.ingredient || order.Produit || order.Ingredient || order.product || order.item || order.Item || "";
  const produitQty = Number(order.quantite || order.qty || order.Quantite || order.quantity || 1);
  const produitUnite = order.unite || order.unit || order.Unite || order.uniteCommande || "";
  if (produitName && isNew(produitName)) {
    return [{ name: produitName, qty: produitQty || 1, unit: produitUnite }];
  }

  if (order.message) {
    const lines = parseMessageLines(order.message);
    if (lines.length > 0) return lines;
  }

  for (const key of Object.keys(order)) {
    const val = order[key];
    if (
      typeof val === "string" && val.length > 0 && val.length < 100 &&
      isNew(val) && !val.includes("@") && !val.includes("http") &&
      ["produit", "ingredient", "product", "item", "article"].some((k) => key.toLowerCase().includes(k))
    ) {
      return [{ name: val, qty: Number(order.quantite || order.qty || 1), unit: order.unite || "" }];
    }
  }

  return [];
}

function getOrderSupplier(order) {
  return order.fournisseur || order.supplier || order.fournisseurNom || "";
}

export { parseOrderProducts, getOrderSupplier };

export default function ReceiveModal({ order, onClose, onReceived }) {
  const { products: productsDb, stockLive, referentiels } = useAppContext();

  const parsedProducts = useMemo(() => {
    const parsed = parseOrderProducts(order);
    if (parsed.length > 0) return parsed;
    return [{
      name: order.produit || order.ingredient || order.nom || getOrderSupplier(order) || "Produit",
      qty: Number(order.quantite || order.qty || 1),
      unit: order.unite || order.unit || "",
    }];
  }, [order]);

  const totalSteps = parsedProducts.length;
  const [currentStep, setCurrentStep] = useState(0);
  const [confirmed, setConfirmed] = useState([]);
  const [receiveQty, setReceiveQty] = useState(String(parsedProducts[0]?.qty || ""));
  const [receiveUnit, setReceiveUnit] = useState(parsedProducts[0]?.unit || "");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const swipeTouchStart = useRef(null);

  const product = parsedProducts[currentStep];

  const unitChoices = useMemo(() => {
    if (referentiels?.unites?.length) {
      return referentiels.unites.map((u) => u.abreviation || u.nom).filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
    }
    return ["kg", "g", "L", "ml", "pièce", "carton", "sachet", "bouteille"];
  }, [referentiels]);

  const goToStep = (step) => {
    if (step < 0 || step >= totalSteps) return;
    setCurrentStep(step);
    setReceiveQty(String(parsedProducts[step]?.qty || ""));
    setReceiveUnit(parsedProducts[step]?.unit || "");
  };

  const goBackStep = () => {
    setConfirmed((c) => c.slice(0, -1));
    setReceiveQty(String(parsedProducts[currentStep - 1]?.qty || ""));
    setReceiveUnit(parsedProducts[currentStep - 1]?.unit || "");
    setCurrentStep((s) => s - 1);
  };

  const confirmStep = async () => {
    const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    const catalogItem = (productsDb || []).find((db) => norm(db.ingredient || db.name || "") === norm(product.name));
    const stockItem = (stockLive || []).find((s) =>
      (catalogItem?.id && s.ingredientId === catalogItem.id) ||
      norm(s.name) === norm(product.name) ||
      norm(s.ingredient) === norm(product.name)
    );

    const newConfirmed = [...confirmed, {
      ...product,
      stockId: stockItem?.id || null,
      receivedQty: Number(receiveQty) || product.qty || 1,
      receivedUnit: receiveUnit || product.unit || stockItem?.uniteStock || "",
    }];
    const isFinal = currentStep >= totalSteps - 1;

    setSaving(true);
    setError(null);
    let saga = null;
    try {
      const response = await fetch("/api/supplier-orders/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          isFinal,
          lines: newConfirmed.map((line) => ({
            stockId: line.stockId,
            name: line.name,
            quantity: line.receivedQty,
            unite: line.receivedUnit,
          })),
        }),
      });
      saga = await response.json().catch(() => null);
      if (!response.ok) throw new Error(saga?.error || `Erreur réception ${response.status}`);
    } catch (e) {
      setError("Erreur réception stock — réessaie, rien n'a été perdu");
      setSaving(false);
      return;
    }
    setSaving(false);

    if (!isFinal) {
      setConfirmed(newConfirmed);
      goToStep(currentStep + 1);
      return;
    }

    onReceived({ order, fullyReceived: Boolean(saga?.fullyReceived), lines: saga?.lines || [], confirmedCount: newConfirmed.length });
  };

  if (!product) return null;
  const productName = product.name || product.ingredient || product.produit || product.nom || "Produit";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "85vh" }}
        onTouchStart={(e) => { swipeTouchStart.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (swipeTouchStart.current === null) return;
          const delta = e.changedTouches[0].clientX - swipeTouchStart.current;
          swipeTouchStart.current = null;
          if (delta < -60 && currentStep < totalSteps - 1) goToStep(currentStep + 1);
          if (delta > 60 && currentStep > 0) goBackStep();
        }}
      >
        <div className="shrink-0 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide">
              {getOrderSupplier(order)} · Produit {currentStep + 1} / {totalSteps}
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] cursor-pointer font-black">×</button>
          </div>
          <div className="text-2xl font-black text-[#2c1a10] leading-tight mb-1">{productName}</div>
          <div className="text-xs text-[#9a7060] font-semibold mb-3">
            {getOrderSupplier(order)} · Commandé : {product.qty || "?"} {product.unit}
          </div>

          {totalSteps > 1 && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] text-[#9a7060] truncate max-w-[30%]">
                {currentStep > 0 ? `← ${parsedProducts[currentStep - 1]?.name}` : ""}
              </span>
              <div className="flex-1 flex gap-1 justify-center">
                {parsedProducts.map((_, i) => (
                  <div key={i}
                    className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                      i === currentStep ? "bg-[#2c1a10] w-6" :
                      i < currentStep ? "bg-[#5a7828] w-3" : "bg-[#e5d5c5] w-3"
                    }`}
                    onClick={() => goToStep(i)}
                  />
                ))}
              </div>
              <span className="text-[9px] text-[#9a7060] truncate max-w-[30%] text-right">
                {currentStep < totalSteps - 1 ? `${parsedProducts[currentStep + 1]?.name} →` : ""}
              </span>
            </div>
          )}
          {totalSteps > 1 && currentStep === 0 && (
            <div className="text-center text-[10px] text-[#c8b4a8] animate-pulse">
              ← Swipez pour naviguer →
            </div>
          )}
        </div>

        <div key={currentStep} className="flex-1 overflow-y-auto px-5 py-3 min-h-0 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-500">{error}</div>
          )}
          <div>
            <label className="block text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-1.5">Quantité réellement reçue</label>
            <input
              type="number"
              value={receiveQty}
              onChange={(e) => setReceiveQty(e.target.value)}
              placeholder={String(product.qty || "")}
              className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-lg font-black text-[#2c1a10] outline-none focus:border-[#2c1a10]"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-1.5">Unité</label>
            <select
              value={receiveUnit}
              onChange={(e) => setReceiveUnit(e.target.value)}
              className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-[#2c1a10] outline-none"
            >
              {product.unit && <option value={product.unit}>{product.unit}</option>}
              {!product.unit && <option value="">Unité d&apos;origine</option>}
              {unitChoices.filter((u) => u !== product.unit).map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {confirmed.length > 0 && (
            <div className="bg-[#f0f7e5] rounded-2xl p-3">
              <div className="text-[10px] font-black text-[#5a7828] mb-2 uppercase">Déjà reçus</div>
              {confirmed.map((c, i) => (
                <div key={i} className="text-xs text-[#2c1a10] py-1 flex justify-between">
                  <span className="font-bold">{c.name}</span>
                  <span className="text-[#5a7828] font-black">✓ {c.receivedQty} {c.receivedUnit}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 pt-3 pb-5 border-t border-[#e5d5c5] space-y-2" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
          <button
            onClick={confirmStep}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer active:scale-[0.98] transition-all shadow-md disabled:opacity-60"
          >
            {saving ? "Enregistrement…" : currentStep < totalSteps - 1
              ? `✅ Confirmer · Suivant : ${parsedProducts[currentStep + 1]?.name || ""} →`
              : "✅ Confirmer et terminer la réception"}
          </button>
          {currentStep > 0 && (
            <button
              onClick={goBackStep}
              className="w-full py-2 text-xs font-bold text-[#9a7060] cursor-pointer hover:text-[#2c1a10] transition-colors"
            >
              ← Retour à {parsedProducts[currentStep - 1]?.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
