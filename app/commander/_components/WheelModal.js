"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useModalA11y } from "../_lib/useModalA11y";
import { getScreenResolution } from "../_lib/screenResolution";
import { SLICES, REWARD, REWARD_COLOR, REWARD_LINES } from "../_lib/wheelSlices";

const SLICE_DEG = 360 / SLICES.length;
const SPIN_DURATION_MS = 4200;
const LANDED_DURATION_MS = 1000;
const FULL_TURNS_DEG = 6 * 360;
const CENTER = 100;
// The dial is smaller than the full viewBox now — the freed-up radius
// (OUTER_R to ICON_RING_R) is the icon ring's lane, sitting just inside the
// 100-unit edge instead of on top of the slice text.
const OUTER_R = 78;
const TEXT_R = 51;
const ICON_RING_R = 89;
const ICON_BADGE_R = 9;
const LINE_HEIGHT = 8.5;
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

// Labels sit at their slice's own position but are never rotated — they
// stay screen-horizontal no matter where the slice lands, instead of the
// previous radial orientation that read sideways/upside-down off the
// 3-o'clock pointer.
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
        const isHighlighted = i === highlightIndex;
        const textPos = polarPoint(midAngle, TEXT_R);
        const firstDy = -(LINE_HEIGHT * (lines.length - 1)) / 2;

        return (
          <g key={i}>
            <path
              d={`M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${OUTER_R} ${OUTER_R} 0 0 1 ${end.x} ${end.y} Z`}
              fill={REWARD_COLOR[reward]}
              stroke={MOKA.cream}
              strokeWidth={isHighlighted ? 3 : 1}
              style={isHighlighted ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.95))" } : undefined}
            />
            <text
              x={textPos.x}
              y={textPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#FFFFFF"
              fontSize="7.2"
              fontWeight="700"
              fontFamily={FONT_STACK}
            >
              {lines.map((line, li) => (
                <tspan key={li} x={textPos.x} dy={li === 0 ? firstDy : LINE_HEIGHT}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </>
  );
}

// A separate ring just outside the dial: one clean badge per concrete-item
// slice (percentage/no-win slices get none), so the icon never competes
// with the label for space inside the triangle.
function WheelIconRing({ highlightIndex }) {
  return (
    <>
      {SLICES.map((reward, i) => {
        if (NO_ICON_REWARDS.has(reward)) return null;
        const midAngle = i * SLICE_DEG + SLICE_DEG / 2;
        const pos = polarPoint(midAngle, ICON_RING_R);
        const isHighlighted = i === highlightIndex;

        return (
          <g key={i}>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={ICON_BADGE_R}
              fill={MOKA.cream}
              stroke={REWARD_COLOR[reward]}
              strokeWidth={isHighlighted ? 2.5 : 1.5}
            />
            <g transform={`translate(${pos.x - 6}, ${pos.y - 6})`}>
              <Gift size={12} color={MOKA.brown} strokeWidth={2.5} />
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

// At 3 o'clock, points left into the wheel. Bold coral + drop shadow so it
// reads clearly against any of the 4 slice tones; bumps once when the spin
// lands (see the "landed" phase) to underline the stop.
function WheelPointer({ bounce }) {
  return (
    <div
      className={`absolute top-1/2 -right-2 -translate-y-1/2 z-10 ${bounce ? "animate-bump" : ""}`}
      style={{ filter: "drop-shadow(0 2px 4px rgba(44,26,16,0.45))" }}
      aria-hidden="true"
    >
      <div
        className="w-0 h-0"
        style={{ borderTop: "11px solid transparent", borderBottom: "11px solid transparent", borderRight: `20px solid ${MOKA.coral}` }}
      />
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
              <WheelIconRing highlightIndex={phase === "landed" ? landedIndex : null} />
            </svg>
            <WheelCenterHub />
            <WheelPointer bounce={phase === "landed"} />
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
