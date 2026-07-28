"use client";

import { useState } from "react";
import { setStaffPin } from "./staffPin";
import PinDigits from "./PinDigits";

export default function PinSetupModal({ staffId, onClose, onSaved }) {
  const [stage, setStage] = useState("first"); // "first" | "confirm"
  const [firstPin, setFirstPin] = useState("");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(null);

  const handleDigitsChange = (next) => {
    setDigits(next);
    const pin = next.join("");
    if (pin.length !== 4) return;

    if (stage === "first") {
      setFirstPin(pin);
      setStage("confirm");
      setDigits(["", "", "", ""]);
      setError(null);
      return;
    }

    // stage === "confirm"
    if (pin !== firstPin) {
      setError("Les codes ne correspondent pas — recommence");
      setStage("first");
      setFirstPin("");
      setDigits(["", "", "", ""]);
      return;
    }

    setStaffPin(staffId, pin);
    onSaved?.();
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
        <h2 className="text-lg font-black text-[#2c1a10] mb-4">
          {stage === "first" ? "Choisis un code à 4 chiffres" : "Confirme ton code"}
        </h2>

        <PinDigits key={stage} digits={digits} onChange={handleDigitsChange} autoFocusFirst />

        {error && <div className="text-xs text-red-600 font-bold text-center mt-3">{error}</div>}

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-2xl border border-[#e5d5c5] bg-white font-black text-sm text-[#9a7060] cursor-pointer mt-5"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
