"use client";

import { useState } from "react";
import { MOKA } from "../_lib/theme";
import { useModalA11y } from "../_lib/useModalA11y";
import { getScreenResolution } from "../_lib/screenResolution";
import MokaPrizeWheel from "./MokaPrizeWheel";

const FONT_STACK = "var(--font-geist-sans), Arial, Helvetica, sans-serif";

function formatResetTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "America/Puerto_Rico",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

// Hosts the flower wheel (MokaPrizeWheel) and owns the backend glue: the spin
// is decided server-side (/api/wheel/spin — daily limit, weekly big-win cap,
// Notion record, account link), the wheel just lands on the returned slice.
// Rendered only while open (parent does `{wheelOpen && <WheelModal .../>}`),
// so a fresh mount resets state — no reset-on-close effect needed.
export default function WheelModal({ onClose, eligibility, onSpun, customer, onGoToAccount, onWinPendingVerification }) {
  const dialogRef = useModalA11y(onClose);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // MokaPrizeWheel's onSpin: return the winning slice index (+ the server
  // payload). Throwing aborts the spin and surfaces the message via onError.
  async function handleSpin() {
    setError(null);
    setSpinning(true);
    try {
      const res = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenResolution: getScreenResolution() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossible de tourner la roue.");
      }
      return { ...data, index: data.sliceIndex };
    } catch (err) {
      setSpinning(false);
      throw err;
    }
  }

  function handleResult(_prize, data) {
    setSpinning(false);
    setResult(data);
    onSpun();
    // Not connected: nothing was persisted server-side — the reward only
    // becomes real once the phone is verified (see AccountView).
    if (data.requiresVerification) {
      onWinPendingVerification({ reward: data.reward, code: data.code, expiresAt: data.expiresAt, sliceIndex: data.sliceIndex });
    }
  }

  function handleError(message) {
    setSpinning(false);
    setError(message);
  }

  const lockClose = spinning;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={lockClose ? undefined : onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wheel-modal-title"
        tabIndex={-1}
        className="relative w-full max-h-[90vh] rounded-t-3xl flex flex-col overflow-y-auto animate-sheet-up outline-none p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        style={{ backgroundColor: MOKA.cream }}
      >
        <div className="flex items-start justify-between mb-2">
          <h2 id="wheel-modal-title" className="text-lg font-black" style={{ color: MOKA.brown, fontFamily: FONT_STACK }}>
            Roue de la chance
          </h2>
          <button
            onClick={onClose}
            disabled={lockClose}
            className="w-11 h-11 -mt-2 -mr-2 rounded-full bg-white shadow flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ color: MOKA.brown }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <MokaPrizeWheel
          size={300}
          canSpin={eligibility.canSpin && !result}
          onSpin={handleSpin}
          onResult={handleResult}
          onError={handleError}
          showCaption={false}
        />

        {error && (
          <p role="alert" className="text-sm font-semibold text-center mt-2" style={{ color: "#8C2F2F" }}>
            {error}
          </p>
        )}

        {!result && !eligibility.canSpin && !error && (
          <p className="text-sm text-center mt-2" style={{ color: MOKA.brownLight }}>
            {eligibility.activeReward
              ? `Tu as déjà une récompense active : ${eligibility.activeReward.reward}.`
              : `Prochaine roue disponible dès ${formatResetTime(eligibility.nextResetAt)}.`}
          </p>
        )}

        {result && (
          <div className="text-center mt-2">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: MOKA.brownLight }}>
              Tu as gagné
            </p>
            <p className="text-xl font-black mt-1" style={{ color: MOKA.coral, fontFamily: FONT_STACK }}>
              {result.reward}
            </p>
            {result.code && (
              <p className="text-xs mt-2" style={{ color: MOKA.brownLight }}>
                Code {result.code} — utilisable jusqu&apos;à demain, même heure.
              </p>
            )}

            {result.blockedByExistingReward ? (
              <p className="text-sm font-semibold mt-4" style={{ color: MOKA.brown }}>
                Tu as déjà une récompense active ({result.existingReward.reward}) — ce nouveau gain n&apos;est pas enregistré.
              </p>
            ) : customer.connected ? (
              <p className="text-sm font-semibold mt-4" style={{ color: MOKA.green }}>
                Récompense enregistrée sur ton compte.
              </p>
            ) : (
              <div className="mt-4 rounded-2xl bg-white p-4">
                <p className="text-sm font-semibold" style={{ color: MOKA.brown }}>
                  Connecte-toi pour valider ta récompense
                </p>
                <p className="text-xs mt-1" style={{ color: MOKA.brownLight }}>
                  Sans connexion, ce gain ne sera pas enregistré.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onGoToAccount();
                  }}
                  className="mt-3 w-full py-3 rounded-full font-bold text-white cursor-pointer min-h-[44px]"
                  style={{ backgroundColor: MOKA.coral }}
                >
                  Se connecter
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
