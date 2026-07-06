"use client";

import { useState } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
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

// Restricted to just Apple Pay / Google Pay — Link, PayPal, Klarna, Amazon
// Pay ride along by default even when the PaymentIntent itself is limited
// to payment_method_types: ["card"], since Stripe treats them as enhanced
// card experiences rather than separate types. Has to be excluded here too.
const EXPRESS_CHECKOUT_METHODS = { link: "never", amazonPay: "never", paypal: "never", klarna: "never" };
// Same story inside the card form itself: without this, Stripe shows an
// inline "pay faster with Link" promo (email/phone/name fields) even
// though Link is meant to be gone entirely.
const PAYMENT_ELEMENT_WALLETS = { applePay: "never", googlePay: "never", link: "never" };

// Apple Pay / Google Pay, shown alongside (never instead of) the card form
// below. The wallet already supplies name/contact details, so no extra
// billing fields are configured here — that's the whole point of using the
// wallet in the first place.
function ExpressCheckout({ onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [hasMethods, setHasMethods] = useState(false);

  async function handleConfirm() {
    if (!stripe || !elements) return;
    onError(null);

    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (error) {
      onError(error.message || "Le paiement a échoué. Réessaie ou utilise une carte.");
      return;
    }
    onSuccess(paymentIntent.id);
  }

  return (
    <div>
      <ExpressCheckoutElement
        options={{ paymentMethods: EXPRESS_CHECKOUT_METHODS }}
        onReady={(event) => setHasMethods(Boolean(event.availablePaymentMethods && Object.keys(event.availablePaymentMethods).length))}
        onConfirm={handleConfirm}
      />
      {hasMethods && (
        <p className="text-center text-xs my-3" style={{ color: MOKA.brownLight }}>
          ou payer par carte
        </p>
      )}
    </div>
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
      <PaymentElement options={{ wallets: PAYMENT_ELEMENT_WALLETS }} onReady={() => setReady(true)} />
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

function SavedCardOption({ savedCard, submitting, onPaySavedCard, onUseAnother }) {
  return (
    <div className="space-y-2">
      <button
        onClick={onPaySavedCard}
        disabled={submitting}
        className={`w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
          submitting ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
        style={{ backgroundColor: MOKA.green }}
      >
        {submitting ? "Paiement en cours…" : `Payer avec la carte enregistrée (${savedCard.label})`}
      </button>
      <button
        type="button"
        onClick={onUseAnother}
        className="w-full text-center text-xs underline cursor-pointer"
        style={{ color: MOKA.brownLight }}
      >
        Utiliser une autre carte
      </button>
    </div>
  );
}

export default function PaymentStep({
  testMode,
  clientSecret,
  total,
  rewardApplied,
  rewardBlocked,
  savedCard,
  submittingSavedCard,
  onPaySavedCard,
  onSuccess,
  onError,
  error,
  onSimulate,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [useAnotherCard, setUseAnotherCard] = useState(false);

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

  // A saved card fully replaces the express-checkout + card form by
  // default (fastest path for a returning customer) — "Utiliser une autre
  // carte" is the escape hatch back to the normal flow, not a second option
  // shown alongside it.
  const showSavedCard = savedCard && !useAnotherCard;

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <RewardBanner rewardApplied={rewardApplied} rewardBlocked={rewardBlocked} />
      {showSavedCard ? (
        <SavedCardOption
          savedCard={savedCard}
          submitting={submittingSavedCard}
          onPaySavedCard={onPaySavedCard}
          onUseAnother={() => setUseAnotherCard(true)}
        />
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
          <ExpressCheckout onSuccess={onSuccess} onError={onError} />
          <StripeForm total={total} submitting={submitting} setSubmitting={setSubmitting} onSuccess={onSuccess} onError={onError} />
        </Elements>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
          {error}
        </p>
      )}
    </div>
  );
}
