"use client";

// "Nouvelle commande client" (Salle + Manager) now opens straight onto the
// real KDS board — same component/data as the admin dashboard's
// "Commandes clients" section (app/_components/ClientOrdersKDS.js, backed
// by /api/orders/board) — not a new system. "+ Nouvelle commande" stacks
// the existing creation flow (CommandeClientModal) on top when needed.
import { useState } from "react";
import ClientOrdersKDS from "../../_components/ClientOrdersKDS";
import CommandeClientModal from "./CommandeClientModal";

export default function CommandeClientKDSModal({ onClose }) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-[#f7efe4]">
      <div
        className="shrink-0 px-4 pb-3 flex items-center justify-between border-b border-[#e5d5c5] bg-white gap-2"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <h2 className="text-lg font-black text-[#2c1a10]">🛎 Commandes clients</h2>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="h-9 px-3 rounded-xl bg-[#2c1a10] text-white text-xs font-black cursor-pointer whitespace-nowrap"
          >
            + Nouvelle commande
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] font-black cursor-pointer shrink-0"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ClientOrdersKDS />
      </div>

      {showCreate && <CommandeClientModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
