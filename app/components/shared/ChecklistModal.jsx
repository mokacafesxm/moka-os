"use client";

// Checklist en overlay, sans navigation de page — même pattern que
// ReceiveModal/InvoiceScanPrompt. Déclenché depuis le flux de pointage
// "Comptage" (SplashScreen) quand ce pointage vient de déclencher
// l'ouverture d'un poste : une navigation Next.js complète (remontage de
// page, contexte) se sentait lente à l'usage, une modale reste sur l'écran
// déjà monté. Voir ChecklistRunner.jsx pour le contenu partagé avec la page
// /checklist (toujours utilisée par ChecklistBanner et /poste, inchangés).

import ChecklistRunner from "./ChecklistRunner";

export default function ChecklistModal({ staffId, onClose }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-[#f7efe4] rounded-3xl shadow-2xl overflow-y-auto p-5"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end -mt-1 -mr-1 mb-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] cursor-pointer font-black"
          >
            ×
          </button>
        </div>
        <ChecklistRunner staffId={staffId} onFinished={onClose} finishedLabel="Fermer" />
      </div>
    </div>
  );
}
