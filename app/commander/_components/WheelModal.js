"use client";

import { useState } from "react";
import { Coffee, Gift } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useModalA11y } from "../_lib/useModalA11y";
import { getScreenResolution } from "../_lib/screenResolution";
import { SLICES, REWARD, REWARD_COLOR, REWARD_LINES } from "../_lib/wheelSlices";

const SLICE_DEG = 360 / SLICES.length;
const SPIN_DURATION_MS = 4200;
const LANDED_DURATION_MS = 1000;
const FULL_TURNS_DEG = 6 * 360;
const CENTER = 100;
const OUTER_R = 96;
const ICON_R = 74;
const TEXT_R = 54;
const FONT_STACK = "var(--font-geist-sans), Arial, Helvetica, sans-serif";
// The pointer sits at 3 o'clock (90° clockwise from top), not 12 — the
// landing-rotation math below targets this same angle.
const POINTER_ANGLE_DEG = 90;

// One simple gift icon for concrete-item wins only — percentage discounts
// and the no-win slice stay text-only, closer to a classic raffle wheel.
const NO_ICON_REWARDS = new Set([
  REWARD.PERCENT_5,
  REWARD.PERCENT_10,
  REWARD.PERCENT_15,
  REWARD.PERCENT_20,
  REWARD.REPLAY_TOMORROW,
]);

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

function polarPoint(angleDeg, r) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

// Text is drawn "upright" at the top (angle 0) then the whole slice group is
// rotated into place. Slices in the bottom half would end up upside down
// after that rotation, so labels there get an extra 180° flip around their
// own pivot to stay readable right-side up (icon position is unaffected —
// it's part of the same flipped group, so it stays paired with its text).
function WheelSlices({ highlightIndex }) {
  return (
    <>
      {SLICES.map((reward, i) => {
        const startAngle = i * SLICE_DEG;
        const endAngle = startAngle + SLICE_DEG;
        const midAngle = startAngle + SLICE_DEG / 2;
        const start = polarPoint(startAngle, OUTER_R);
        const end = polarPoint(endAngle, OUTER_R);
        const lines = REWARD_LINES[reward] || [reward];
        const hasIcon = !NO_ICON_REWARDS.has(reward);
        const flip = midAngle > 90 && midAngle < 270;
        const isHighlighted = i === highlightIndex;
        const iconY = CENTER - ICON_R;
        // No-icon slices center their text a bit further out, roughly where
        // the icon+text pair's midpoint would have sat, instead of looking
        // low/off-balance in the space the icon would have used.
        const textY = hasIcon ? CENTER - TEXT_R : CENTER - (ICON_R + TEXT_R) / 2;
        const pivotY = (iconY + textY) / 2;

        return (
          <g key={i}>
            <path
              d={`M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${OUTER_R} ${OUTER_R} 0 0 1 ${end.x} ${end.y} Z`}
              fill={REWARD_COLOR[reward]}
              stroke={MOKA.cream}
              strokeWidth={isHighlighted ? 3 : 1}
              style={isHighlighted ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.95))" } : undefined}
            />
            <g transform={`rotate(${midAngle}, ${CENTER}, ${CENTER})`}>
              <g transform={flip ? `rotate(180, ${CENTER}, ${pivotY})` : undefined}>
                {hasIcon && (
                  <g transform={`translate(${CENTER - 7}, ${iconY - 7})`}>
                    <Gift size={14} color="#FFFFFF" strokeWidth={2.5} />
                  </g>
                )}
                <text x={CENTER} y={textY} textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="700" fontFamily={FONT_STACK}>
                  {lines.map((line, li) => (
                    <tspan key={li} x={CENTER} dy={li === 0 ? 0 : 10}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            </g>
          </g>
        );
      })}
    </>
  );
}

function WheelCenterHub() {
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center z-10"
      style={{ backgroundColor: MOKA.cream, border: `3px solid ${MOKA.brown}`, boxShadow: `0 2px 8px ${MOKA.navShadow}` }}
      aria-hidden="true"
    >
      <span className="text-xl font-black" style={{ color: MOKA.brown, fontFamily: FONT_STACK }}>
        M
      </span>
    </div>
  );
}

// At 3 o'clock now (was 12) — points left, into the wheel.
function WheelPointer() {
  return (
    <div className="absolute top-1/2 -right-3 -translate-y-1/2 z-10 flex items-center" aria-hidden="true">
      <div
        className="w-0 h-0"
        style={{ borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderRight: `14px solid ${MOKA.brown}` }}
      />
      <Coffee className="w-5 h-5 ml-[-3px]" style={{ color: MOKA.brown }} strokeWidth={2.5} />
    </div>
  );
}

// Deterministic scatter (no Math.random — components must stay pure): angle
// jitter and distance vary with index so the burst still reads as random.
const CONFETTI_COLORS = [MOKA.brownLight, MOKA.brown, MOKA.green, MOKA.coral];
const CONFETTI_DOTS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * 360 + ((i % 3) - 1) * 7;
  const dist = 42 + ((i * 7) % 28);
  const rad = (angle * Math.PI) / 180;
  return {
    dx: Math.cos(rad) * dist,
    dy: Math.sin(rad) * dist,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: (i % 5) * 0.03,
  };
});

function Confetti() {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-0 h-0 z-20" aria-hidden="true">
      {CONFETTI_DOTS.map((d, i) => (
        <span
          key={i}
          className="absolute w-2 h-2 -ml-1 -mt-1 rounded-full animate-confetti"
          style={{ backgroundColor: d.color, "--dx": `${d.dx}px`, "--dy": `${d.dy}px`, animationDelay: `${d.delay}s` }}
        />
      ))}
    </div>
  );
}

// Rendered only while open (parent does `{wheelOpen && <WheelModal .../>}`,
// same pattern as ProductPopup) so a fresh mount is what resets state —
// no reset-on-close effect needed.
export default function WheelModal({ onClose, eligibility, onSpun, customer, onGoToAccount, onWinPendingVerification }) {
  const dialogRef = useModalA11y(onClose);
  const [phase, setPhase] = useState("idle"); // idle | spinning | landed | result
  const [rotation, setRotation] = useState(0);
  const [landedIndex, setLandedIndex] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // Lazy initializer, not an effect — this only ever mounts client-side
  // (parent conditionally renders it), so window is always available here.
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const spinDurationMs = reducedMotion ? 300 : SPIN_DURATION_MS;
  const landedDurationMs = reducedMotion ? 100 : LANDED_DURATION_MS;

  async function handleSpin() {
    setError(null);
    setPhase("spinning");

    try {
      const res = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenResolution: getScreenResolution() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Impossible de tourner la roue.");
        setPhase("idle");
        return;
      }

      // Rotate so the winning slice's own midpoint angle ends up exactly at
      // the pointer's fixed screen angle (3 o'clock) once the spin stops.
      const sliceMidAngle = data.sliceIndex * SLICE_DEG + SLICE_DEG / 2;
      const landingOffset = ((POINTER_ANGLE_DEG - sliceMidAngle) % 360 + 360) % 360;
      setRotation(FULL_TURNS_DEG + landingOffset);

      setTimeout(() => {
        setLandedIndex(data.sliceIndex);
        setPhase("landed");
        onSpun();
        setTimeout(() => {
          setResult(data);
          // Not connected: nothing was persisted server-side — the reward
          // only becomes real once the phone is verified (see AccountView).
          if (data.requiresVerification) {
            onWinPendingVerification({ reward: data.reward, code: data.code, expiresAt: data.expiresAt, sliceIndex: data.sliceIndex });
          }
          setPhase("result");
        }, landedDurationMs);
      }, spinDurationMs);
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
      setPhase("idle");
    }
  }

  const canSpinNow = eligibility.canSpin && phase === "idle";

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={phase === "spinning" || phase === "landed" ? undefined : onClose} />

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
          <h2 id="wheel-modal-title" className="text-lg font-black" style={{ color: MOKA.brown, fontFamily: FONT_STACK }}>
            Roue de la chance
          </h2>
          <button
            onClick={onClose}
            disabled={phase === "spinning" || phase === "landed"}
            className="w-11 h-11 -mt-2 -mr-2 rounded-full bg-white shadow flex items-center justify-center cursor-pointer shrink-0"
            style={{ color: MOKA.brown }}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {phase !== "result" && (
          <div className="relative w-64 h-64 mx-auto mb-6">
            <svg
              viewBox="0 0 200 200"
              className="absolute inset-0"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: phase === "spinning" ? `transform ${spinDurationMs}ms cubic-bezier(0.76, 0, 0.24, 1)` : "none",
                filter: `drop-shadow(0 8px 16px ${MOKA.navShadow})`,
              }}
            >
              <WheelSlices highlightIndex={phase === "landed" ? landedIndex : null} />
            </svg>
            <WheelCenterHub />
            <WheelPointer />
            {phase === "landed" && <Confetti />}
          </div>
        )}

        {result && phase === "result" && (
          <div className="text-center py-4">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: MOKA.brownLight }}>
              Tu as gagné
            </p>
            <p className="text-xl font-black mt-1" style={{ color: MOKA.coral, fontFamily: FONT_STACK }}>
              {result.reward}
            </p>
            <p className="text-xs mt-2" style={{ color: MOKA.brownLight }}>
              Code {result.code} — utilisable jusqu&apos;à demain, même heure.
            </p>

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

        {(phase === "idle" || phase === "spinning") && (
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
              className={`w-full py-3.5 rounded-full font-bold flex items-center justify-center min-h-[44px] ${
                canSpinNow ? "cursor-pointer" : "cursor-not-allowed"
              }`}
              style={{
                backgroundColor: canSpinNow ? MOKA.coral : MOKA.placeholderTan,
                color: canSpinNow ? "#FFFFFF" : MOKA.brownLight,
              }}
            >
              {phase === "spinning" ? "Ça tourne…" : "Tourner la roue"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
