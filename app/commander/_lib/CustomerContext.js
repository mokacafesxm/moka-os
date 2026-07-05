"use client";

import { createContext, useContext, useState } from "react";

const CustomerContext = createContext(null);

// No real customer accounts yet — AccountView's mock login writes here so the
// personalized header (Header.js) has something real to reflect end to end.
// Swap the mock login for a real auth call later; Header and anything else
// reading useCustomer() won't need to change.
export function CustomerProvider({ children }) {
  const [customer, setCustomer] = useState({ connected: false, prenom: null, photoUrl: null });

  const value = {
    customer,
    signIn: (prenom, photoUrl = null) => setCustomer({ connected: true, prenom, photoUrl }),
    signOut: () => setCustomer({ connected: false, prenom: null, photoUrl: null }),
  };

  return <CustomerContext value={value}>{children}</CustomerContext>;
}

export function useCustomer() {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer must be used within a CustomerProvider");
  return ctx;
}
