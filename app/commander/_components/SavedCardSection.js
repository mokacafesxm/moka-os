"use client";

import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { CreditCard } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { getStripeClient } from "../_lib/stripeClient";

const STRIPE_APPEARANCE = {
  theme: "stripe",
  variables: {
    colorPrimary: MOKA.coral,
    colorText: MOKA.brown,
    colorTextSecondary: MOKA.brownLight,
    colorBackground: "#FFFFFF",
    borderRadius: "16px",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
};

function AddCardForm({ onSaved, onCancel, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError(null);

    const { error, setupIntent } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (error) {
      setSubmitting(false);
      onError(error.message || "Impossible d'enregistrer cette carte.");
      return;
    }

    try {
      const res = await fetch("/api/account/card/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setupIntentId: setupIntent.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error || "Impossible d'enregistrer cette carte.");
        return;
      }
      onSaved(data.cardLabel);
    } catch {
      onError("Impossible de contacter le serveur, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement onReady={() => setReady(true)} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-full font-bold cursor-pointer min-h-[44px]"
          style={{ color: MOKA.brown, backgroundColor: "white", border: `1px solid ${MOKA.brownLight}` }}
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!ready || submitting}
          className={`flex-1 py-3 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
            ready && !submitting ? "cursor-pointer" : "cursor-not-allowed opacity-60"
          }`}
          style={{ backgroundColor: MOKA.coral }}
        >
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

// PCI compliance is Stripe's job, not ours — a SetupIntent collects and
// validates the card with no charge attached, and only the resulting
// payment method id + a display label ("visa •••• 4242") ever reach Notion.
// Raw card data never touches this app's servers.
export default function SavedCardSection() {
  const [cardLabel, setCardLabel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/card")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCardLabel(data.cardLabel || null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleStartAdd() {
    setError(null);
    try {
      const res = await fetch("/api/account/card/setup-intent", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d'ouvrir le formulaire de carte.");
        return;
      }
      setClientSecret(data.clientSecret);
      setAdding(true);
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/card", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible de supprimer la carte.");
        return;
      }
      setCardLabel(null);
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
    } finally {
      setRemoving(false);
    }
  }

  const stripePromise = getStripeClient();

  return (
    <div className="mt-4">
      <h3 className="text-sm font-black uppercase tracking-wide mb-2" style={{ color: MOKA.brownLight }}>
        Moyens de paiement
      </h3>

      {loading ? null : cardLabel ? (
        <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5" style={{ color: MOKA.brown }} />
            <span className="font-semibold text-sm" style={{ color: MOKA.brown }}>
              {cardLabel}
            </span>
          </div>
          <button
            onClick={handleRemove}
            disabled={removing}
            className={`text-sm font-semibold ${removing ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            style={{ color: MOKA.coral }}
          >
            {removing ? "…" : "Supprimer"}
          </button>
        </div>
      ) : adding && stripePromise && clientSecret ? (
        <div className="bg-white rounded-2xl p-4">
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
            <AddCardForm
              onSaved={(label) => {
                setCardLabel(label);
                setAdding(false);
                setClientSecret(null);
              }}
              onCancel={() => {
                setAdding(false);
                setClientSecret(null);
                setError(null);
              }}
              onError={setError}
            />
          </Elements>
        </div>
      ) : (
        <button
          onClick={handleStartAdd}
          className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 min-h-[44px] text-left font-semibold cursor-pointer"
          style={{ color: MOKA.brown }}
        >
          Ajouter une carte
          <CreditCard className="w-4 h-4" style={{ color: MOKA.brownLight }} />
        </button>
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold mt-2" style={{ color: "#8C2F2F" }}>
          {error}
        </p>
      )}
    </div>
  );
}
