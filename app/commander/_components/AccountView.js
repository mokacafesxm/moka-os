"use client";

import { useState } from "react";
import { User, Bell, ChevronRight } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useCustomer } from "../_lib/CustomerContext";
import SavedCardSection from "./SavedCardSection";
import PhoneAuthFlow from "./PhoneAuthFlow";
import AccountInfoForm from "./AccountInfoForm";
import AccountPromos from "./AccountPromos";
import AccountOrders from "./AccountOrders";

// Real phone-based accounts — the sign-in / signup flow itself lives in the
// shared PhoneAuthFlow so the checkout can reuse the exact same steps. This
// view just frames it and, once connected, shows the account menu.
export default function AccountView({ onOpenWheel }) {
  const { customer, signOut } = useCustomer();
  const [connectedView, setConnectedView] = useState("menu"); // menu | info | promos | orders
  const [notice, setNotice] = useState(null);

  // Focused sub-screens for a connected client — each has its own back
  // button and title, so they replace the whole account view rather than
  // nesting inside it.
  if (customer.connected && connectedView === "info") {
    return <AccountInfoForm onBack={() => setConnectedView("menu")} />;
  }
  if (customer.connected && connectedView === "promos") {
    return <AccountPromos onBack={() => setConnectedView("menu")} onOpenWheel={onOpenWheel} />;
  }
  if (customer.connected && connectedView === "orders") {
    return <AccountOrders onBack={() => setConnectedView("menu")} />;
  }

  return (
    <div className="px-4 pt-4 pb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: MOKA.brown }}
          >
            {customer.connected ? (
              <span className="text-white font-bold">{customer.prenom.slice(0, 1).toUpperCase()}</span>
            ) : (
              <User className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black truncate" style={{ color: MOKA.brown }}>
              {customer.connected ? `Bonjour, ${customer.prenom}` : "Bonjour"}
            </h2>
            <div className="text-xs truncate" style={{ color: MOKA.brownLight }}>
              {customer.connected ? "Ravi de vous revoir" : "Connectez-vous pour continuer"}
            </div>
          </div>
        </div>
        <button
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-white shadow-sm cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" style={{ color: MOKA.brown }} />
        </button>
      </div>

      {customer.connected ? (
        <div className="space-y-2">
          {notice && (
            <p className="text-sm font-semibold rounded-2xl bg-white px-4 py-3" style={{ color: MOKA.green }}>
              {notice}
            </p>
          )}
          {[
            { label: "Mes commandes", onClick: () => setConnectedView("orders") },
            { label: "Mes informations", onClick: () => setConnectedView("info") },
            { label: "Mes promos", onClick: () => setConnectedView("promos") },
          ].map(({ label, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 min-h-[44px] text-left font-semibold cursor-pointer"
              style={{ color: MOKA.brown }}
            >
              {label}
              <ChevronRight className="w-4 h-4" style={{ color: MOKA.brownLight }} />
            </button>
          ))}

          <SavedCardSection />

          <button
            onClick={signOut}
            className="w-full mt-4 py-3.5 rounded-full font-bold cursor-pointer min-h-[44px]"
            style={{ color: MOKA.coral, backgroundColor: "white" }}
          >
            Se déconnecter
          </button>
        </div>
      ) : (
        <PhoneAuthFlow idPrefix="account" onNotice={setNotice} />
      )}
    </div>
  );
}
