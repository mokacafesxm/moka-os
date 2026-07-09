"use client";

import { useState } from "react";
import { MOKA } from "../_lib/theme";
import { useCustomer } from "../_lib/CustomerContext";
import PhoneNumberInput from "./PhoneNumberInput";

const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

const inputClass =
  "w-full rounded-full border bg-white px-5 py-3.5 text-sm outline-none min-h-[44px] focus:ring-2 focus:ring-offset-2 focus:ring-[#587F25]";
const inputStyle = { borderColor: MOKA.brownLight, color: MOKA.brown };

// Single real-account flow shared by the Compte tab and the checkout
// coordinates step: phone -> SMS code -> (existing number: connected
// immediately) or (new number: one prenom-only step, then connected).
// verify-code sets the session cookie; signIn just mirrors it into context.
// onConnected fires once the customer is fully signed in (both branches) so
// the checkout can advance straight to the pickup slot.
export default function PhoneAuthFlow({ idPrefix = "auth", sendLabel = "Recevoir un code par SMS", onConnected, onNotice }) {
  const { signIn, pendingWheelReward, setPendingWheelReward } = useCustomer();
  const [step, setStep] = useState("phone"); // phone | code | prenom
  const [phone, setPhone] = useState("");
  const [prenom, setPrenom] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function finishConnected(connectedPrenom, connectedTelephone) {
    signIn(connectedPrenom, connectedTelephone);
    onConnected?.(connectedPrenom, connectedTelephone);
  }

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
        onNotice?.(`Tu as déjà une récompense active (${data.existingReward.reward}) — ton nouveau gain n'a pas été enregistré.`);
      } else if (data.rewardSaved) {
        onNotice?.("Ta récompense a bien été enregistrée sur ton compte.");
      }

      if (data.isNewClient) {
        setStep("prenom");
      } else {
        finishConnected(data.prenom, data.telephone);
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
      finishConnected(data.prenom, phone.trim());
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  const errorLine = error && (
    <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
      {error}
    </p>
  );
  const primaryBtnClass = (busy) =>
    `w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
      busy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
    }`;

  if (step === "phone") {
    return (
      <form onSubmit={handleSendCode} className="space-y-3">
        <PhoneNumberInput onChange={setPhone} inputId={`${idPrefix}-phone`} inputClassName={inputClass} inputStyle={inputStyle} />
        {errorLine}
        <button type="submit" disabled={submitting} className={primaryBtnClass(submitting)} style={{ backgroundColor: MOKA.coral }}>
          {submitting ? "Envoi…" : sendLabel}
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={handleVerifyCode} className="space-y-3">
        <p className="text-sm" style={{ color: MOKA.brownLight }}>
          Code envoyé au {phone}.
        </p>
        <label htmlFor={`${idPrefix}-code`} className="sr-only">
          Code de vérification
        </label>
        <input
          id={`${idPrefix}-code`}
          required
          inputMode="numeric"
          placeholder="Code à 6 chiffres"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
        {errorLine}
        <button type="submit" disabled={submitting} className={primaryBtnClass(submitting)} style={{ backgroundColor: MOKA.coral }}>
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
    );
  }

  return (
    <form onSubmit={handleSetPrenom} className="space-y-3">
      <p className="text-sm" style={{ color: MOKA.brownLight }}>
        Numéro vérifié — encore une info et c&apos;est prêt.
      </p>
      <label htmlFor={`${idPrefix}-new-prenom`} className="sr-only">
        Prénom
      </label>
      <input
        id={`${idPrefix}-new-prenom`}
        required
        placeholder="Prénom"
        value={prenom}
        onChange={(e) => setPrenom(e.target.value)}
        className={inputClass}
        style={inputStyle}
      />
      {errorLine}
      <button type="submit" disabled={submitting} className={primaryBtnClass(submitting)} style={{ backgroundColor: MOKA.coral }}>
        {submitting ? "Enregistrement…" : "Créer mon compte"}
      </button>
    </form>
  );
}
