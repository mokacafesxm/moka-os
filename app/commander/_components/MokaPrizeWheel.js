"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Coffee,
  Croissant,
  CupSoda,
  IceCreamCone,
  Tag,
  CakeSlice,
  Leaf,
  Ticket,
  Cookie,
  Sandwich,
  RefreshCw,
  Users,
  Crown,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Data — the single source of truth. Edit freely: order = petal order
 * (petal N sits at N o'clock, 12 at the top, 3 at the right pointer).
 * Each prize is { label, icon, color, probability }. `probability` is a
 * relative weight (need not sum to 1). Text ink (white vs brown) is
 * derived automatically from `color`, so you only ever set these four.
 * ------------------------------------------------------------------ */

// Reference-faithful coffee-shop tones. Petals cycle tan → sage → brown,
// with a deeper sage closing the ring at 12 — matching the flower reference.
const TONE = {
  tan: "#E7D7BC",
  sage: "#7C8A6B",
  brown: "#7A5A44",
  deepSage: "#5E6E51",
};

export const PRIZES = [
  { label: "Café offert", icon: Coffee, color: TONE.tan, probability: 12 },
  { label: "Pâtisserie offerte", icon: Croissant, color: TONE.sage, probability: 10 },
  { label: "Smoothie -50%", icon: CupSoda, color: TONE.brown, probability: 10 },
  { label: "Milkshake -50%", icon: IceCreamCone, color: TONE.tan, probability: 10 },
  { label: "-15% sur un brunch", icon: Tag, color: TONE.sage, probability: 9 },
  { label: "Dessert offert", icon: CakeSlice, color: TONE.brown, probability: 9 },
  { label: "Upgrade matcha offert", icon: Leaf, color: TONE.tan, probability: 9 },
  { label: "Golden Ticket", icon: Ticket, color: TONE.sage, probability: 2 },
  { label: "Pancakes -50%", icon: Cookie, color: TONE.brown, probability: 9 },
  { label: "Bagel ou toast -50%", icon: Sandwich, color: TONE.tan, probability: 9 },
  { label: "A other chance tomorrow", icon: RefreshCw, color: TONE.sage, probability: 8 },
  { label: "Breakfast for two", icon: Users, color: TONE.deepSage, probability: 3 },
];

/* ------------------------------------------------------------------ *
 * Geometry & motion constants
 * ------------------------------------------------------------------ */

const SEGMENTS = 12;
const SEGMENT_DEG = 360 / SEGMENTS;
// Pointer is fixed at 3 o'clock. In the petals' local frame, "outward" is
// +x (right), so a petal whose net rotation is 0 sits under the pointer and
// reads horizontally — everything else follows rigidly from that.
const POINTER_DEG = 0;
const FULL_TURNS = 5 * 360;
const SPIN_MS = 4400;
const SPIN_EASE = "cubic-bezier(0.16, 0.84, 0.24, 1)"; // decelerate, no bounce

// One rounded paddle "petal" pointing +x (tip near x=94), narrow rounded base
// near the hub. 12 of these rotated by 30° tile into the flower, the beige
// gaps between them doing the visual separation the reference has.
const PETAL_PATH =
  "M 14 -5 C 38 -10, 54 -24, 70 -24 A 24 24 0 1 1 70 24 C 54 24, 38 10, 14 5 C 7 3, 7 -3, 14 -5 Z";

const LABEL_X = 48; // label sits inner (clear of the hub), reads outward
const ICON_X = 69;
const ICON_SIZE = 14;
const NUM_X = 87; // number badge near the outer tip
const NUM_R = 7.5;
const LINE_H = 6.8;

const CREAM = "#FBF9EE";
const INK_DARK = "#5B3A28";
const BROWN = "#7A5230";
const FONT_STACK = "var(--font-geist-sans), system-ui, -apple-system, Segoe UI, Arial, sans-serif";

/* ------------------------------------------------------------------ *
 * Helpers (pure)
 * ------------------------------------------------------------------ */

// Perceived brightness → readable ink. Light petals get dark ink, dark
// petals get cream, so contrast holds no matter which color you drop in.
function inkFor(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return brightness > 0.62 ? INK_DARK : CREAM;
}

// Uppercase + greedy wrap to short lines so labels read at petal scale.
function wrapLabel(label, maxChars = 11, maxLines = 3) {
  const words = label.toUpperCase().split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if ((current + " " + word).length <= maxChars) current += " " + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  // Too many lines: keep the first maxLines-1, cram the rest into the last.
  return [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(" ")];
}

// SVG rotation (deg) that places petal i, with 12 at the top and 3 at the
// pointer. Petal i's local +x maps to i+1 o'clock.
function petalRotation(i) {
  return (i + 1) * SEGMENT_DEG - 90;
}

function weightedIndex(prizes, roll) {
  const total = prizes.reduce((sum, p) => sum + (p.probability || 0), 0);
  let acc = 0;
  const target = roll * total;
  for (let i = 0; i < prizes.length; i++) {
    acc += prizes[i].probability || 0;
    if (target < acc) return i;
  }
  return prizes.length - 1;
}

/* ------------------------------------------------------------------ *
 * Petal
 * ------------------------------------------------------------------ */

function Petal({ prize, index }) {
  const ink = inkFor(prize.color);
  const lines = useMemo(() => wrapLabel(prize.label), [prize.label]);
  const Icon = prize.icon;
  const firstDy = -(LINE_H * (lines.length - 1)) / 2;

  return (
    <g transform={`rotate(${petalRotation(index)})`}>
      <path
        d={PETAL_PATH}
        fill={prize.color}
        stroke={CREAM}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />

      {/* Content is authored reading outward (+x). It rotates rigidly with the
          petal, so it's upright at 3 o'clock and upside-down at 9 o'clock. */}
      <text
        x={LABEL_X}
        y={0}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={ink}
        fontSize="5.3"
        fontWeight="800"
        letterSpacing="0.01em"
        fontFamily={FONT_STACK}
      >
        {lines.map((line, li) => (
          <tspan key={li} x={LABEL_X} dy={li === 0 ? firstDy : LINE_H}>
            {line}
          </tspan>
        ))}
      </text>

      <g transform={`translate(${ICON_X - ICON_SIZE / 2}, ${-ICON_SIZE / 2})`}>
        <Icon size={ICON_SIZE} color={ink} strokeWidth={1.9} absoluteStrokeWidth />
      </g>

      <circle cx={NUM_X} cy={0} r={NUM_R} fill={CREAM} stroke={prize.color} strokeWidth={1} />
      <text
        x={NUM_X}
        y={0.4}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={BROWN}
        fontSize="8"
        fontWeight="800"
        fontFamily={FONT_STACK}
      >
        {index + 1}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ *
 * MokaPrizeWheel
 * ------------------------------------------------------------------ */

// Props:
//   onSpin?   async () => ({ index, ...payload }) — decides the winning slice.
//             When wired to a backend, return its sliceIndex as `index`; the
//             rest of the payload is handed back through onResult. Throw an
//             Error(message) to abort the spin (surfaced via onError). Omitted
//             (e.g. the /roue demo) → a local weighted pick is used instead.
//   canSpin?  gate the SPIN button (default true).
//   onResult? (prize, payload) once the wheel lands.
//   onError?  (message) if onSpin threw.
//   showCaption? render the built-in "Vous avez gagné" line (default true);
//             turn off when a parent renders its own richer result panel.
export default function MokaPrizeWheel({
  prizes = PRIZES,
  size = 340,
  onSpin,
  canSpin = true,
  onResult,
  onError,
  showCaption = true,
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);
  // Lazy init (not an effect): only read in the spin handler, never rendered,
  // so there's no hydration mismatch even though SSR resolves it to false.
  const [reducedMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const durationMs = reducedMotion ? 320 : SPIN_MS;
  const disabled = spinning || !canSpin || Boolean(result);

  function landOn(winner) {
    // Land the winner's local +x exactly under the pointer, always spinning
    // forward by at least the full-turn count.
    const targetMod = (((POINTER_DEG - petalRotation(winner)) % 360) + 360) % 360;
    const currentMod = (((rotation % 360) + 360) % 360);
    const delta = (((targetMod - currentMod) % 360) + 360) % 360;
    const turns = reducedMotion ? 0 : FULL_TURNS;
    setRotation((r) => r + turns + delta);
  }

  async function spin() {
    if (disabled) return;
    setResult(null);
    setSpinning(true);

    try {
      let winner;
      let payload = null;
      if (onSpin) {
        payload = await onSpin();
        // A null/invalid payload means the parent already handled the failure
        // (e.g. showed an eligibility error) — just stop spinning.
        if (!payload || typeof payload.index !== "number") {
          setSpinning(false);
          return;
        }
        winner = ((payload.index % prizes.length) + prizes.length) % prizes.length;
      } else {
        winner = weightedIndex(prizes, Math.random());
      }

      landOn(winner);
      timerRef.current = setTimeout(() => {
        setSpinning(false);
        setResult(prizes[winner]);
        onResult?.(prizes[winner], payload ?? { index: winner });
      }, durationMs);
    } catch (err) {
      setSpinning(false);
      onError?.(err?.message || "Impossible de contacter le serveur, réessaie.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Soft shadow lives on a wrapper so it doesn't spin with the wheel. */}
        <div
          className="absolute inset-0"
          style={{ filter: "drop-shadow(0 14px 30px rgba(74,52,32,0.22))" }}
        >
          <svg
            viewBox="-100 -100 200 200"
            width={size}
            height={size}
            role="img"
            aria-label="Roue des cadeaux MÖKA Café"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? `transform ${durationMs}ms ${SPIN_EASE}` : "none",
            }}
          >
            {prizes.map((prize, i) => (
              <Petal key={i} prize={prize} index={i} />
            ))}
          </svg>
        </div>

        {/* Fixed brown pointer at 3 o'clock, pointing left into the wheel. */}
        <div
          className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/3 z-20"
          style={{ filter: "drop-shadow(0 2px 3px rgba(74,52,32,0.4))" }}
          aria-hidden="true"
        >
          <div
            className="h-0 w-0"
            style={{
              borderTop: `${size * 0.05}px solid transparent`,
              borderBottom: `${size * 0.05}px solid transparent`,
              borderRight: `${size * 0.075}px solid ${TONE.brown}`,
            }}
          />
        </div>

        {/* Center hub = MÖKA CAFÉ logo + SPIN button. */}
        <button
          type="button"
          onClick={spin}
          disabled={disabled}
          aria-label={spinning ? "La roue tourne" : "Lancer la roue"}
          className="group absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full flex flex-col items-center justify-center transition-transform duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7A5A44]/40"
          style={{
            width: size * 0.3,
            height: size * 0.3,
            backgroundColor: CREAM,
            border: `${Math.max(3, size * 0.012)}px solid ${TONE.brown}`,
            boxShadow: "0 6px 16px rgba(74,52,32,0.22), inset 0 0 0 1px rgba(255,255,255,0.6)",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <Crown size={size * 0.05} color={TONE.brown} strokeWidth={2} className="mb-0.5" fill={TONE.brown} />
          <span
            className="font-black leading-none tracking-tight"
            style={{ color: TONE.brown, fontSize: size * 0.062, fontFamily: FONT_STACK }}
          >
            MÖKA
          </span>
          <span
            className="font-semibold leading-none"
            style={{ color: BROWN, fontSize: size * 0.028, letterSpacing: "0.28em", marginLeft: "0.28em" }}
          >
            CAFÉ
          </span>
          <span
            className="mt-1 rounded-full font-bold leading-none text-white transition-transform group-hover:scale-105 group-active:scale-95"
            style={{
              fontSize: size * 0.03,
              letterSpacing: "0.12em",
              padding: `${size * 0.012}px ${size * 0.03}px`,
              backgroundColor: spinning ? TONE.sage : disabled ? TONE.brown : "#C24755",
              opacity: disabled && !spinning ? 0.55 : 1,
            }}
          >
            {spinning ? "…" : "SPIN"}
          </span>
        </button>
      </div>

      {/* Built-in result caption (polite live region). Hidden when a parent
          renders its own result panel (e.g. the wheel modal). */}
      {showCaption && (
        <div className="min-h-[2.5rem] text-center" aria-live="polite">
          {result && (
            <p className="text-sm">
              <span style={{ color: BROWN }}>Vous avez gagné&nbsp;: </span>
              <span className="font-black" style={{ color: "#C24755" }}>
                {result.label}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
