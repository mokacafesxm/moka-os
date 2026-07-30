"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { verifyStaffPin } from "./staffPin";
import PinKeypad from "./PinKeypad";

const MAX_ATTEMPTS = 3;

// Re-login gate for a staff/admin who has set a session PIN (Profil →
// Sécurité, ou son équivalent admin). Purely a local, per-device
// convenience lock — never blocks past 3 attempts server-side, just tells
// the person to go find another admin.
//
// Portalé vers document.body (comme QuickPointageButton) : SplashScreen
// fait glisser ses 2 phases via un `transform` sur un ancêtre, ce qui crée
// un containing block CSS pour tout `position: fixed` descendant — sans
// portail, la modale pouvait se retrouver mal positionnée/inaccessible
// selon la phase affichée au moment du tap. z-[200] > SplashScreen (z-100)
// puisque le portail sort de sa stacking context et doit désormais rivaliser
// directement avec elle. Ne déclenche jamais de navigation : router.push ne
// vit que dans SplashScreen.proceedWithStaff/submitIdentity, appelés depuis
// onVerified une fois la modale déjà fermée.
export default function PinEntryModal({ staffId, staffName, onClose, onVerified }) {
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleComplete = async (pin) => {
    setChecking(true);
    const valid = await verifyStaffPin(staffId, pin);
    setChecking(false);
    if (valid) {
      onVerified();
      return;
    }

    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (nextAttempts >= MAX_ATTEMPTS) {
      setLocked(true);
      setError("Contactez votre manager");
    } else {
      setError("PIN incorrect, réessayez");
    }
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
        <h2 className="text-lg font-black text-[#2c1a10] mb-4">{staffName}</h2>

        <PinKeypad key={attempts} onComplete={handleComplete} disabled={locked || checking} />

        {error && (
          <div className={`text-xs font-bold text-center mt-3 ${locked ? "text-[#9a7060]" : "text-red-600"}`}>
            {error}
          </div>
        )}

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
