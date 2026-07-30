"use client";

import { useState } from "react";
import { removeStaffPin } from "./staffPin";

// Confirmation avant suppression — irréversible côté staff (redevient
// accessible sans PIN jusqu'à ce qu'il/elle en recrée un).
export default function PinDeleteModal({ staffId, onClose, onDeleted }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    const ok = await removeStaffPin(staffId);
    setSaving(false);
    if (!ok) { setError("Échec de la suppression — réessaie"); return; }
    onDeleted?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-xs rounded-3xl bg-[#f7efe4] border border-[#e5d5c5] shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-1">🔐 PIN de session</div>
        <h2 className="text-lg font-black text-[#2c1a10] mb-2">Supprimer ton PIN ?</h2>
        <p className="text-sm text-[#9a7060] mb-4">
          Reconnexion à ta session sans code jusqu&apos;à ce que tu en recrées un.
        </p>

        {error && <div className="text-xs text-red-600 font-bold text-center mb-3">{error}</div>}

        <button
          type="button"
          onClick={confirm}
          disabled={saving}
          className="w-full h-11 rounded-2xl bg-red-600 text-white font-black text-sm cursor-pointer disabled:opacity-50"
        >
          {saving ? "…" : "Supprimer mon PIN"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-2xl border border-[#e5d5c5] bg-white font-black text-sm text-[#9a7060] cursor-pointer mt-2"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
