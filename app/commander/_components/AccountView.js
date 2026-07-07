"use client";

import { useState } from "react";
import { User, Bell, ChevronRight } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useCustomer } from "../_lib/CustomerContext";
import SavedCardSection from "./SavedCardSection";
import PhoneNumberInput from "./PhoneNumberInput";
import AccountInfoForm from "./AccountInfoForm";
import AccountPromos from "./AccountPromos";

const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

// Real phone-based accounts, single entry point for both sign-in and
// signup: phone -> SMS code -> (existing number: connected immediately) or
// (new number: one prenom-only step, then connected). The session cookie
// set by verify-code is what CustomerContext restores on reload via
// /api/auth/me — nothing here manages the session itself.
export default function AccountView({ onOpenWheel }) {
  const { customer, signIn, signOut, pendingWheelReward, setPendingWheelReward } = useCustomer();
  const [step, setStep] = useState("phone"); // phone | code | prenom
  const [connectedView, setConnectedView] = useState("menu"); // menu | info | promos
  const [phone, setPhone] = useState("");
  const [prenom, setPrenom] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSendCode(e) {
    e.preventDefault();
    setError(null);
    if (!PHONE_PATTERN.test(phone.trim())) {
      setError("Format international requis, ex. +590690123456");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d'envoyer le code.");
        return;
      }
      setStep("code");
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), pendingReward: pendingWheelReward }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Code invalide.");
        return;
      }

      setPendingWheelReward(null);
      if (data.blockedByExistingReward) {
        setNotice(`Tu as déjà une récompense active (${data.existingReward.reward}) — ton nouveau gain n'a pas été enregistré.`);
      } else if (data.rewardSaved) {
        setNotice("Ta récompense a bien été enregistrée sur ton compte.");
      }

      if (data.isNewClient) {
        setStep("prenom");
      } else {
        signIn(data.prenom, data.telephone);
      }
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetPrenom(e) {
    e.preventDefault();
    setError(null);
    if (!prenom.trim()) {
      setError("Entre ton prénom");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/set-prenom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prenom: prenom.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d'enregistrer ton prénom.");
        return;
      }
      signIn(data.prenom, phone.trim());
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-full border bg-white px-5 py-3.5 text-sm outline-none min-h-[44px] focus:ring-2 focus:ring-offset-2 focus:ring-[#587F25]";
  const inputStyle = { borderColor: MOKA.brownLight, color: MOKA.brown };

  // Focused sub-screens for a connected client — each has its own back
  // button and title, so they replace the whole account view rather than
  // nesting inside it.
  if (customer.connected && connectedView === "info") {
    return <AccountInfoForm onBack={() => setConnectedView("menu")} />;
  }
  if (customer.connected && connectedView === "promos") {
    return <AccountPromos onBack={() => setConnectedView("menu")} onOpenWheel={onOpenWheel} />;
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
            { label: "Mes commandes", onClick: undefined },
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
      ) : step === "phone" ? (
        <form onSubmit={handleSendCode} className="space-y-3">
          <PhoneNumberInput onChange={setPhone} inputId="account-phone" inputClassName={inputClass} inputStyle={inputStyle} />
          {error && (
            <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
              submitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
            style={{ backgroundColor: MOKA.coral }}
          >
            {submitting ? "Envoi…" : "Recevoir un code par SMS"}
          </button>
        </form>
      ) : step === "code" ? (
        <form onSubmit={handleVerifyCode} className="space-y-3">
          <p className="text-sm" style={{ color: MOKA.brownLight }}>
            Code envoyé au {phone}.
          </p>
          <label htmlFor="account-code" className="sr-only">
            Code de vérification
          </label>
          <input
            id="account-code"
            required
            inputMode="numeric"
            placeholder="Code à 6 chiffres"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
          {error && (
            <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
              submitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
            style={{ backgroundColor: MOKA.coral }}
          >
            {submitting ? "Vérification…" : "Confirmer"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setError(null);
              setCode("");
            }}
            className="w-full text-center text-xs pt-1 cursor-pointer underline"
            style={{ color: MOKA.brownLight }}
          >
            Changer de numéro
          </button>
        </form>
      ) : (
        <form onSubmit={handleSetPrenom} className="space-y-3">
          <p className="text-sm" style={{ color: MOKA.brownLight }}>
            Numéro vérifié — encore une info et c&apos;est prêt.
          </p>
          <label htmlFor="account-new-prenom" className="sr-only">
            Prénom
          </label>
          <input
            id="account-new-prenom"
            required
            placeholder="Prénom"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
          {error && (
            <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
              submitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
            style={{ backgroundColor: MOKA.coral }}
          >
            {submitting ? "Enregistrement…" : "Créer mon compte"}
          </button>
        </form>
      )}
    </div>
  );
}
