"use client";

// Bandeau post-réception — le stock est déjà mis à jour à ce stade
// (ReceiveModal a fait son travail, avant que ce composant n'apparaisse). La
// photo de facture, si prise, part vers /api/invoice-scan SANS être
// attendue : l'écran se ferme tout de suite, l'extraction Vision + le
// matching + l'écriture tournent côté serveur à leur rythme. Toute
// correction (matching manquant, ou prix qui dévie de plus de 10% du
// dernier connu) se fait après coup dans "Factures à valider" (/rapports) —
// jamais de relecture bloquante ici. Remplace l'ancien FactureScanModal
// (toujours disponible séparément pour un scan manuel avec relecture) pour
// ce point d'entrée précis. Partagé entre LivraisonsAujourdhuiCard (Bar/
// Cuisine/Manager) et /commandes (admin) — deux flux de réception distincts,
// même bandeau.

import { useState } from "react";
import { compressImage } from "../../../lib/http/compress-image";

export default function InvoiceScanPrompt({ fournisseur, onDone }) {
  const [sending, setSending] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) { onDone(); return; }
    setSending(true);
    try {
      const base64 = await compressImage(file);
      if (base64) {
        fetch("/api/invoice-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mediaType: "image/jpeg", fournisseur }),
        }).catch((error) => console.error("[InvoiceScanPrompt] scan failed", error));
      }
    } finally {
      setSending(false);
      onDone();
    }
  };

  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-[#f0f7e5] p-3.5 flex items-center justify-between gap-2">
      <div className="text-xs font-bold text-[#5a7828]">✅ Livraison reçue</div>
      <div className="flex items-center gap-2 shrink-0">
        <label className={`h-9 px-3 rounded-xl bg-[#2c1a10] text-white text-[11px] font-black cursor-pointer flex items-center gap-1.5 ${sending ? "opacity-50 pointer-events-none" : ""}`}>
          📸 Photo de la facture
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} disabled={sending} />
        </label>
        <button type="button" onClick={onDone} className="h-9 px-2.5 text-[#9a7060] text-[11px] font-bold cursor-pointer">
          Passer
        </button>
      </div>
    </div>
  );
}
