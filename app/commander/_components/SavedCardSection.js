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

// This form only ever adds a card — no wallets or Link's inline promo,
// same restriction as the checkout PaymentElement.
const PAYMENT_ELEMENT_WALLETS = { applePay: "never", googlePay: "never", link: "never" };

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
      onSaved(data);
    } catch {
      onError("Impossible de contacter le serveur, réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement options={{ wallets: PAYMENT_ELEMENT_WALLETS }} onReady={() => setReady(true)} />
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

function CardRow({ card, onRemove, removing }) {
  return (
    <div className="bg-white rounded-2xl px-4 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <CreditCard className="w-5 h-5 shrink-0" style={{ color: MOKA.brown }} />
        <span className="font-semibold text-sm truncate" style={{ color: MOKA.brown }}>
          <span className="capitalize">{card.brand}</span> •••• {card.last4}
          <span className="font-normal ml-1.5" style={{ color: MOKA.brownLight }}>
            exp. {card.expiry}
          </span>
        </span>
      </div>
      <button
        onClick={() => onRemove(card.paymentMethodId)}
        disabled={removing}
        className={`text-sm font-semibold shrink-0 ml-2 ${removing ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        style={{ color: MOKA.coral }}
      >
        {removing ? "…" : "Supprimer"}
      </button>
    </div>
  );
}

// PCI compliance is Stripe's job, not ours — a SetupIntent collects and
// validates each card with no charge attached, and only the resulting
// payment method id + display details (brand, last4, expiry) ever reach
// Notion. Raw card data never touches this app's servers. A client can
// hold several cards; the most recently added one is offered first at
// checkout (see /api/orders/checkout's savedCard).
export default function SavedCardSection() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/card")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCards(data.cards || []);
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

  async function handleRemove(paymentMethodId) {
    setRemovingId(paymentMethodId);
    setError(null);
    try {
      const res = await fetch(`/api/account/card?paymentMethodId=${encodeURIComponent(paymentMethodId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible de supprimer la carte.");
        return;
      }
      setCards((list) => list.filter((c) => c.paymentMethodId !== paymentMethodId));
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
    } finally {
      setRemovingId(null);
    }
  }

  const stripePromise = getStripeClient();

  return (
    <div className="mt-4">
      <h3 className="text-sm font-black uppercase tracking-wide mb-2" style={{ color: MOKA.brownLight }}>
        Moyens de paiement
      </h3>

      {!loading && cards.length > 0 && (
        <div className="space-y-2 mb-2">
          {cards.map((card) => (
            <CardRow key={card.paymentMethodId} card={card} onRemove={handleRemove} removing={removingId === card.paymentMethodId} />
          ))}
        </div>
      )}

      {adding && stripePromise && clientSecret ? (
        <div className="bg-white rounded-2xl p-4">
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
            <AddCardForm
              onSaved={(card) => {
                setCards((list) => [card, ...list]);
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
        !loading && (
          <button
            onClick={handleStartAdd}
            className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 min-h-[44px] text-left font-semibold cursor-pointer"
            style={{ color: MOKA.brown }}
          >
            Ajouter une carte
            <CreditCard className="w-4 h-4" style={{ color: MOKA.brownLight }} />
          </button>
        )
      )}

      {error && (
        <p role="alert" className="text-sm font-semibold mt-2" style={{ color: "#8C2F2F" }}>
          {error}
        </p>
      )}
    </div>
  );
}
