"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { MOKA } from "../../_lib/theme";
import { formatPrice } from "../../_lib/variants";
import { getStripeClient } from "../../_lib/stripeClient";

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

function PayButton({ total, submitting, disabled, label }) {
  return (
    <button
      type="submit"
      disabled={disabled || submitting}
      className={`w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
        !disabled && !submitting ? "cursor-pointer" : "cursor-not-allowed opacity-60"
      }`}
      style={{ backgroundColor: MOKA.coral }}
    >
      {submitting ? "Paiement en cours…" : `${label} — ${formatPrice(total)}`}
    </button>
  );
}

function StripeForm({ total, submitting, setSubmitting, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      setSubmitting(false);
      onError(error.message || "Le paiement a échoué. Vérifiez votre carte et réessayez.");
      return;
    }

    onSuccess(paymentIntent.id);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement onReady={() => setReady(true)} />
      <PayButton total={total} submitting={submitting} disabled={!ready} label="Payer" />
    </form>
  );
}

function RewardBanner({ rewardApplied, rewardBlocked }) {
  if (rewardApplied) {
    return (
      <div className="rounded-2xl p-4 text-sm font-semibold" style={{ backgroundColor: `${MOKA.green}1a`, color: MOKA.green }}>
        Récompense appliquée · {rewardApplied.reward} (-{formatPrice(rewardApplied.discount)})
      </div>
    );
  }
  if (rewardBlocked) {
    return (
      <div className="rounded-2xl p-4 text-sm font-semibold" style={{ backgroundColor: "#FDF3E0", color: MOKA.brown }}>
        Récompense disponible ({rewardBlocked.reward}) — {rewardBlocked.error}
      </div>
    );
  }
  return null;
}

export default function PaymentStep({
  testMode,
  clientSecret,
  total,
  rewardApplied,
  rewardBlocked,
  onSuccess,
  onError,
  error,
  onSimulate,
}) {
  const [submitting, setSubmitting] = useState(false);

  if (testMode) {
    return (
      <div className="px-4 pt-4 pb-4 space-y-4">
        <div className="rounded-2xl p-4 text-sm font-semibold" style={{ backgroundColor: "#FDF3E0", color: MOKA.brown }}>
          Mode test — aucun compte de paiement n&apos;est encore configuré. Cette commande sera enregistrée sans paiement réel.
        </div>
        <RewardBanner rewardApplied={rewardApplied} rewardBlocked={rewardBlocked} />
        {error && (
          <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
            {error}
          </p>
        )}
        <button
          onClick={async () => {
            setSubmitting(true);
            onError(null);
            await onSimulate();
            setSubmitting(false);
          }}
          disabled={submitting}
          className={`w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
            !submitting ? "cursor-pointer" : "cursor-not-allowed opacity-60"
          }`}
          style={{ backgroundColor: MOKA.coral }}
        >
          {submitting ? "Envoi…" : `Confirmer la commande (test) — ${formatPrice(total)}`}
        </button>
      </div>
    );
  }

  const stripePromise = getStripeClient();
  if (!stripePromise || !clientSecret) {
    return (
      <div className="px-4 pt-4 pb-4">
        <p className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
          Le paiement n&apos;est pas disponible pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <RewardBanner rewardApplied={rewardApplied} rewardBlocked={rewardBlocked} />
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
        <StripeForm total={total} submitting={submitting} setSubmitting={setSubmitting} onSuccess={onSuccess} onError={onError} />
      </Elements>
      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
          {error}
        </p>
      )}
    </div>
  );
}
