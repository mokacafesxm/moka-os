"use client";

import { createContext, useContext, useEffect, useState } from "react";

const LocationContext = createContext(null);
const STORAGE_KEY = "moka-commander-location";

// Single real location for now — the panel already shows a disabled
// "more locations coming soon" section to prep for multi-location later.
export const MOKA_LOCATION = { id: "marigot", name: "MÖKA Café — Marigot, Saint-Martin" };

export function LocationProvider({ children }) {
  const [locationId, setLocationId] = useState(MOKA_LOCATION.id);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setLocationId(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, locationId);
    } catch {}
  }, [locationId]);

  const value = {
    location: MOKA_LOCATION,
    open,
    openPanel: () => setOpen(true),
    closePanel: () => setOpen(false),
    selectLocation: (id) => {
      setLocationId(id);
      setOpen(false);
    },
  };

  return <LocationContext value={value}>{children}</LocationContext>;
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useLocation must be used within a LocationProvider");
  return ctx;
}
