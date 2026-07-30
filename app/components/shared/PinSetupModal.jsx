"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { setStaffPin, verifyStaffPin } from "./staffPin";
import PinKeypad from "./PinKeypad";

const STAGE_TITLE = {
  verify: "Entre ton code actuel",
  first: "Choisis un code à 4 chiffres",
  confirm: "Confirme ton code",
};

// Création ET modification du PIN partagent ce modal. hasExistingPin fait
// commencer par une vérification de l'ancien code (spec "modifier mon
// PIN") — la première création (pas de PIN existant) saute directement à
// "first".
export default function PinSetupModal({ staffId, hasExistingPin, onClose, onSaved }) {
  const [stage, setStage] = useState(hasExistingPin ? "verify" : "first");
  const [firstPin, setFirstPin] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const restart = (message) => {
    setStage(hasExistingPin ? "verify" : "first");
    setFirstPin("");
    setError(message || null);
    setResetKey((k) => k + 1);
  };

  const handleComplete = async (pin) => {
    if (stage === "verify") {
      setSaving(true);
      const valid = await verifyStaffPin(staffId, pin);
      setSaving(false);
      if (!valid) { restart("PIN incorrect — réessaie"); return; }
      setStage("first");
      setError(null);
      setResetKey((k) => k + 1);
      return;
    }

    if (stage === "first") {
      setFirstPin(pin);
      setStage("confirm");
      setError(null);
      setResetKey((k) => k + 1);
      return;
    }

    // stage === "confirm"
    if (pin !== firstPin) {
      restart("Les codes ne correspondent pas — recommence");
      return;
    }

    setSaving(true);
    setError(null);
    const ok = await setStaffPin(staffId, pin);
    setSaving(false);
    if (!ok) {
      restart("Échec de l'enregistrement — réessaie");
      return;
    }
    onSaved?.();
    onClose();
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-xs rounded-3xl bg-[#f7efe4] border border-[#e5d5c5] shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-1">🔐 PIN de session</div>
        <h2 className="text-lg font-black text-[#2c1a10] mb-4">{STAGE_TITLE[stage]}</h2>

        <PinKeypad key={resetKey} onComplete={handleComplete} disabled={saving} />

        {saving && <div className="text-xs text-[#9a7060] font-bold text-center mt-3">Enregistrement…</div>}
        {error && <div className="text-xs text-red-600 font-bold text-center mt-3">{error}</div>}

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-2xl border border-[#e5d5c5] bg-white font-black text-sm text-[#9a7060] cursor-pointer mt-5"
        >
          Annuler
        </button>
      </div>
    </div>,
    document.body
  );
}
