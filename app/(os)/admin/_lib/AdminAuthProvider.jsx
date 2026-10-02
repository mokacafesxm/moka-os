"use client";

import { createContext, useCallback, useContext, useState } from "react";

// Session-only, never persisted to localStorage — same ephemeral spirit as
// StaffContext's isAdmin (resets every reload). Unlike isAdmin though, this
// is a REAL credential checked server-side (see middleware.js +
// lib/auth/admin-basic-auth.js) — the page gate is cosmetic, this is the one
// that actually protects the Notion reads/writes underneath.
const KEY = "mokaAdminApiAuth";

function loadStored() {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStored);
  const [authFailed, setAuthFailed] = useState(false);

  const unlock = useCallback((username, password) => {
    const encoded = btoa(`${username}:${password}`);
    try {
      sessionStorage.setItem(KEY, encoded);
    } catch {
      // Private browsing / storage disabled — auth still works for this
      // page load, it just won't survive a reload.
    }
    setAuthFailed(false);
    setAuth(encoded);
  }, []);

  const relock = useCallback((failed = false) => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    setAuthFailed(failed);
    setAuth(null);
  }, []);

  // Every /api/admin/* call in this module should go through this, never
  // plain fetch — a stale/wrong credential surfaces as a clean "type it
  // again" prompt instead of a generic fetch failure.
  const adminFetch = useCallback(
    async (url, options = {}) => {
      const headers = { ...(options.headers || {}) };
      if (auth) headers.Authorization = `Basic ${auth}`;
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        relock(true);
        throw Object.assign(new Error("Authentification admin requise"), { code: "ADMIN_AUTH_REQUIRED" });
      }
      return res;
    },
    [auth, relock]
  );

  return (
    <AdminAuthContext.Provider value={{ unlocked: !!auth, authFailed, unlock, relock, adminFetch }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
