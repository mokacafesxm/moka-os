"use client";

// Scan facture fournisseur — extraction de PRIX uniquement, jamais le
// stock (le stock est géré exclusivement par ReceiveModal, voir son propre
// fichier). Déclenché en option juste après une réception de livraison
// (LivraisonsAujourdhuiCard / commandes admin), totalement indépendant du
// flux de réception lui-même : sauter cette étape ne change rien au stock
// déjà mis à jour.

import { useState } from "react";
import { parseJsonResponse } from "../../../lib/http/safe-json";

const UNITE_OPTIONS = ["kg", "L", "pièce", "boîte", "carton", "g", "mL"];

// Même compression client (canvas, max 800px, JPEG 0.7, fallback Safari)
// que le flux facture existant de app/(os)/page.js (handleInvoicePhoto) —
// dupliquée ici plutôt qu'importée : page.js est un monolithe legacy que
// les nouveaux composants partagés n'importent pas (même choix que
// ReceiveModal.jsx, extrait sans dépendre de page.js).
function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 800;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
            else { w = Math.round((w * MAX) / h); h = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w || 800;
          canvas.height = h || 600;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          if (dataUrl && dataUrl.length > 100) resolve(dataUrl.split(",")[1]);
          else resolve(e.target.result.split(",")[1]);
        } catch {
          resolve(e.target.result.split(",")[1]);
        }
      };
      img.onerror = () => resolve(e.target.result.split(",")[1]);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

const inputClass = "w-full h-10 px-3 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]";

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ChoiceStep({ onFile, onSkip }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[#9a7060] font-semibold -mt-1 mb-2">
        Prix uniquement — n&apos;affecte pas le stock déjà réceptionné.
      </p>
      <label className="w-full h-12 rounded-2xl bg-[#2c1a10] text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all">
        📷 Prendre en photo
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </label>
      <label className="w-full h-12 rounded-2xl border border-[#e5d5c5] bg-white text-[#2c1a10] font-black text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all">
        🖼 Depuis la galerie
        <input type="file" accept="image/*" className="hidden" onChange={onFile} />
      </label>
      <button type="button" onClick={onSkip} className="w-full h-11 text-[#9a7060] font-bold text-sm cursor-pointer">
        Passer
      </button>
    </div>
  );
}

function ProduitRow({ produit, onChange, onRemove }) {
  const set = (k) => (e) => onChange({ ...produit, [k]: e.target.value });
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input value={produit.nom} onChange={set("nom")} className={`${inputClass} flex-1`} placeholder="Nom du produit" />
        <button type="button" onClick={onRemove} className="w-8 h-8 shrink-0 rounded-lg bg-red-50 text-red-600 font-black text-sm cursor-pointer">×</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[9px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Qté</label>
          <input type="number" value={produit.quantite ?? ""} onChange={set("quantite")} className={inputClass} />
        </div>
        <div>
          <label className="block text-[9px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Unité</label>
          <select value={produit.unite || ""} onChange={set("unite")} className={inputClass}>
            <option value="">—</option>
            {UNITE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Prix unit.</label>
          <input type="number" value={produit.prix_unitaire ?? ""} onChange={set("prix_unitaire")} className={inputClass} />
        </div>
      </div>
    </div>
  );
}

export default function FactureScanModal({ onClose, onSaved }) {
  const [step, setStep] = useState("choice"); // choice | loading | review | saving
  const [error, setError] = useState(null);
  const [fournisseur, setFournisseur] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [produits, setProduits] = useState([]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep("loading");
    setError(null);
    try {
      const base64 = await compressImage(file);
      if (!base64) throw new Error("Photo illisible, réessaie");
      const res = await fetch("/api/scan-facture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType: "image/jpeg" }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || data.error) throw new Error(data.error || `Erreur ${res.status}`);
      setFournisseur(data.fournisseur || "");
      setDate(data.date || new Date().toISOString().slice(0, 10));
      setProduits(
        Array.isArray(data.produits)
          ? data.produits.map((p) => ({
              nom: p.nom || "",
              quantite: p.quantite ?? "",
              unite: p.unite || "",
              prix_unitaire: p.prix_unitaire ?? "",
            }))
          : []
      );
      setStep("review");
    } catch (err) {
      setError(err.message);
      setStep("choice");
    }
  };

  const updateProduit = (i, next) => setProduits((list) => list.map((p, idx) => (idx === i ? next : p)));
  const removeProduit = (i) => setProduits((list) => list.filter((_, idx) => idx !== i));

  const save = async () => {
    const valid = produits.filter((p) => String(p.nom || "").trim());
    if (valid.length === 0) { setError("Aucun produit à enregistrer"); return; }
    setStep("saving");
    setError(null);
    try {
      const res = await fetch("/api/prix-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produits: valid.map((p) => ({
            nom: p.nom,
            fournisseur,
            prix_unitaire: p.prix_unitaire ? Number(p.prix_unitaire) : null,
            unite: p.unite,
            date,
            source: "facture",
          })),
        }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      onSaved?.();
    } catch (err) {
      setError(err.message);
      setStep("review");
    }
  };

  return (
    <ModalShell title="📸 Scanner la facture" onClose={onClose}>
      {error && <div className="text-xs font-bold text-red-600 -mt-1">{error}</div>}

      {step === "choice" && <ChoiceStep onFile={handleFile} onSkip={onClose} />}

      {(step === "loading" || step === "saving") && (
        <div className="py-10 text-center">
          <div className="text-sm font-bold text-[#9a7060]">
            {step === "loading" ? "Lecture de la facture…" : "Enregistrement…"}
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Fournisseur</label>
              <input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {produits.length === 0 ? (
            <div className="text-sm text-[#9a7060] py-4 text-center">Aucun produit reconnu</div>
          ) : (
            <div className="space-y-2">
              {produits.map((p, i) => (
                <ProduitRow key={i} produit={p} onChange={(next) => updateProduit(i, next)} onRemove={() => removeProduit(i)} />
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl text-[#9a7060] font-bold text-sm cursor-pointer">
              Annuler
            </button>
            <button type="button" onClick={save} className="flex-1 h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer">
              ✅ Enregistrer les prix
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
