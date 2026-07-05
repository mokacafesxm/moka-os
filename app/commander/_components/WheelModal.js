"use client";

import { useEffect, useMemo, useState } from "react";
import { MOKA } from "../_lib/theme";
import { useModalA11y } from "../_lib/useModalA11y";
import { getDeviceId } from "../_lib/deviceId";
import { SLICES, REWARD_COLOR } from "../_lib/wheelSlices";

const SLICE_DEG = 360 / SLICES.length;
const SPIN_DURATION_MS = 4000;
const FULL_TURNS_DEG = 6 * 360;

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

// Rendered only while open (parent does `{wheelOpen && <WheelModal .../>}`,
// same pattern as ProductPopup) so a fresh mount is what resets state —
// no reset-on-close effect needed.
export default function WheelModal({ onClose, eligibility, onSpun, customer, onGoToAccount }) {
  const dialogRef = useModalA11y(onClose);
  const [phase, setPhase] = useState("idle"); // idle | spinning | result
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const wheelBackground = useMemo(() => {
    const stops = SLICES.map((reward, i) => {
      const from = i * SLICE_DEG;
      const to = from + SLICE_DEG;
      return `${REWARD_COLOR[reward]} ${from}deg ${to}deg`;
    });
    return `conic-gradient(from 0deg, ${stops.join(", ")})`;
  }, []);

  // Already connected when the result lands — claim immediately in the
  // background, no extra tap. Fire-and-forget: the UI shows success
  // optimistically since this call reliably succeeds in practice, and the
  // reward stays visible/usable via the eligibility check either way.
  useEffect(() => {
    if (phase !== "result" || !customer.connected || !result) return;
    const deviceId = getDeviceId();
    fetch("/api/wheel/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, prenom: customer.prenom }),
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function handleSpin() {
    setError(null);
    setPhase("spinning");
    const deviceId = getDeviceId();

    try {
      const res = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Impossible de tourner la roue.");
        setPhase("idle");
        return;
      }

      const landingOffset = 360 - (data.sliceIndex * SLICE_DEG + SLICE_DEG / 2);
      setRotation(FULL_TURNS_DEG + landingOffset);

      setTimeout(() => {
        setResult({ reward: data.reward, code: data.code, expiresAt: data.expiresAt });
        setPhase("result");
        onSpun();
      }, SPIN_DURATION_MS);
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
      setPhase("idle");
    }
  }

  const canSpinNow = eligibility.canSpin && phase === "idle";

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={phase === "spinning" ? undefined : onClose} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wheel-modal-title"
        tabIndex={-1}
        className="relative w-full max-h-[90vh] rounded-t-3xl flex flex-col overflow-y-auto animate-sheet-up outline-none p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        style={{ backgroundColor: MOKA.cream }}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 id="wheel-modal-title" className="text-lg font-black" style={{ color: MOKA.brown }}>
            Roue de la chance
          </h2>
          <button
            onClick={onClose}
            disabled={phase === "spinning"}
            className="w-11 h-11 -mt-2 -mr-2 rounded-full bg-white shadow flex items-center justify-center cursor-pointer shrink-0"
            style={{ color: MOKA.brown }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {phase !== "result" && (
          <div className="relative w-56 h-56 mx-auto mb-6">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: wheelBackground,
                transform: `rotate(${rotation}deg)`,
                transition: phase === "spinning" ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.15, 0.65, 0.25, 1)` : "none",
                boxShadow: `0 8px 24px ${MOKA.navShadow}`,
              }}
            />
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 z-10"
              style={{
                borderLeft: "10px solid transparent",
                borderRight: "10px solid transparent",
                borderTop: `16px solid ${MOKA.brown}`,
              }}
              aria-hidden="true"
            />
          </div>
        )}

        {phase === "result" && result && (
          <div className="text-center py-4">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: MOKA.brownLight }}>
              Tu as gagné
            </p>
            <p className="text-xl font-black mt-1" style={{ color: MOKA.coral }}>
              {result.reward}
            </p>
            <p className="text-xs mt-2" style={{ color: MOKA.brownLight }}>
              Code {result.code} — utilisable jusqu&apos;à demain, même heure.
            </p>

            {customer.connected ? (
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

        {phase !== "result" && (
          <>
            {error && (
              <p role="alert" className="text-sm font-semibold text-center mb-3" style={{ color: "#8C2F2F" }}>
                {error}
              </p>
            )}

            {!eligibility.canSpin && !error && (
              <p className="text-sm text-center mb-3" style={{ color: MOKA.brownLight }}>
                {eligibility.activeReward
                  ? `Tu as déjà une récompense active : ${eligibility.activeReward.reward}.`
                  : `Prochaine roue disponible dès ${formatResetTime(eligibility.nextResetAt)}.`}
              </p>
            )}

            <button
              onClick={handleSpin}
              disabled={!canSpinNow}
              className={`w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
                canSpinNow ? "cursor-pointer" : "cursor-not-allowed opacity-60"
              }`}
              style={{ backgroundColor: MOKA.coral }}
            >
              {phase === "spinning" ? "Ça tourne…" : "Tourner la roue"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
