"use client";

// Part of the anonymous wheel-spin fingerprint (see wheel/_shared.js's
// computeFingerprint) — combined server-side with IP + user-agent.
export function getScreenResolution() {
  if (typeof window === "undefined" || !window.screen) return "";
  return `${window.screen.width}x${window.screen.height}`;
}
