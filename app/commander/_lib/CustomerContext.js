"use client";

import { createContext, useContext, useEffect, useState } from "react";

const CustomerContext = createContext(null);

// Real accounts now (phone + Twilio SMS code, see AccountView) — session is a
// signed cookie set by /api/auth/verify-code, restored here on mount via
// /api/auth/me so a reload doesn't sign the customer back out.
export function CustomerProvider({ children }) {
  const [customer, setCustomer] = useState({ connected: false, prenom: null, telephone: null, photoUrl: null });
  // A wheel reward won while signed out, held here (not persisted) until the
  // customer verifies their phone — see WheelModal / AccountView.
  const [pendingWheelReward, setPendingWheelReward] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.connected) {
          setCustomer({ connected: true, prenom: data.prenom, telephone: data.telephone, photoUrl: null });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = {
    customer,
    signIn: (prenom, telephone, photoUrl = null) => setCustomer({ connected: true, prenom, telephone, photoUrl }),
    signOut: () => {
      setCustomer({ connected: false, prenom: null, telephone: null, photoUrl: null });
      fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    },
    pendingWheelReward,
    setPendingWheelReward,
  };

  return <CustomerContext value={value}>{children}</CustomerContext>;
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer must be used within a CustomerProvider");
  return ctx;
}
