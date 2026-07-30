"use client";

import { useState } from "react";
import ClientOrdersKDS from "../../_components/ClientOrdersKDS";
import CommandeClientModal from "../../components/shared/CommandeClientModal";

// Onglet dédié pour Salle (voir NavBottom) — remplace le bouton "Nouvelle
// commande client" + modal plein écran de Mon Poste : même composant
// ClientOrdersKDS que le dashboard admin (app/_components/ClientOrdersKDS,
// backed par /api/orders/board), donc même style et même cadence de poll
// (5s, déjà alignée sur le cache serveur withNotionCache).
export default function KdsPage() {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="min-h-dvh" style={{ background: "#f7efe4" }}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Salle</div>
          <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">🖥 KDS</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="h-10 px-4 rounded-xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform"
        >
          + Nouvelle commande
        </button>
      </div>

      <ClientOrdersKDS />

      {showCreate && <CommandeClientModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
