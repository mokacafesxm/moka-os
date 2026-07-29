"use client";

// Session PIN — un lock par staff sur re-sélectionner son avatar depuis le
// splash picker. Migré depuis localStorage (Sprint 18) vers MOKA_Staff.PIN_Hash
// pour fonctionner sur tout appareil, pas seulement celui où il a été créé.
// Toujours distinct de l'ancien PIN admin (StaffContext, supprimé au même
// sprint) — celui-ci reste un simple confort par staff, pas une vraie
// authentification (voir OrderPad auth hardening memory pour le suivi).
import { simpleHash } from "../../contexts/StaffContext";

export async function hasStaffPin(staffId) {
  if (!staffId) return false;
  try {
    const res = await fetch(`/api/staff/verify-pin?staffId=${staffId}`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.hasPin);
  } catch {
    return false;
  }
}

export async function setStaffPin(staffId, pin) {
  if (!staffId) return false;
  const res = await fetch("/api/staff", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: staffId, pinHash: simpleHash(pin) }),
  });
  return res.ok;
}

export async function verifyStaffPin(staffId, pin) {
  if (!staffId) return false;
  try {
    const res = await fetch("/api/staff/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, pinHash: simpleHash(pin) }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.valid);
  } catch {
    return false;
  }
}
