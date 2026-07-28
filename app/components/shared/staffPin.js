"use client";

// Session PIN — a per-device lock on re-selecting a staff member from the
// splash picker, distinct from the admin PIN (StaffContext.checkPin). Lives
// ONLY in localStorage, never in Notion: it's a local convenience lock per
// device, not an authentication system a manager needs to administer
// remotely (see OrderPad auth hardening memory for the follow-up on real
// access control).
import { simpleHash } from "../../contexts/StaffContext";

const PIN_KEY_PREFIX = "mokaStaffPin_";

function pinKey(staffId) {
  return `${PIN_KEY_PREFIX}${staffId}`;
}

export function hasStaffPin(staffId) {
  if (typeof window === "undefined" || !staffId) return false;
  return Boolean(localStorage.getItem(pinKey(staffId)));
}

export function setStaffPin(staffId, pin) {
  if (typeof window === "undefined" || !staffId) return;
  localStorage.setItem(pinKey(staffId), simpleHash(pin));
}

export function verifyStaffPin(staffId, pin) {
  if (typeof window === "undefined" || !staffId) return false;
  const saved = localStorage.getItem(pinKey(staffId));
  return Boolean(saved) && saved === simpleHash(pin);
}
