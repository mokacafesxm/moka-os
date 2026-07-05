"use client";

// Stable per-device identifier for the wheel of fortune — localStorage (not
// sessionStorage) because it must survive across days/sessions to enforce
// "one spin per reset period" before any real customer account exists.
const STORAGE_KEY = "moka-commander-device-id";

export function getDeviceId() {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}
