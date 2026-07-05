"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { MOKA } from "../../_lib/theme";
import { useCart } from "../../_lib/CartContext";
import { PICKUP_SLOTS } from "../../_lib/pickupSlots";
import { getDeviceId } from "../../_lib/deviceId";
import PickupStep from "./PickupStep";
import PaymentStep from "./PaymentStep";
import SuccessStep from "./SuccessStep";

const STEP_TITLES = { pickup: "Votre commande", payment: "Paiement" };

export default function CheckoutFlow() {
  const router = useRouter();
  const cart = useCart();

  const [step, setStep] = useState("pickup");
  const [slot, setSlot] = useState("asap");
  const [guest, setGuest] = useState({ prenom: "", telephone: "" });
  const [unavailable, setUnavailable] = useState([]);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [payment, setPayment] = useState({
    testMode: true,
    clientSecret: null,
    total: 0,
    rewardApplied: null,
    rewardBlocked: null,
  });
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => {
    if (step !== "success" && cart.items.length === 0) {
      router.replace("/commander");
    }
    // Only re-check when the cart empties out or the step changes past success.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.items.length, step]);

  function removeUnavailable(id) {
    cart.items.filter((i) => i.id === id).forEach((i) => cart.removeItem(i.id, i.variant));
    setUnavailable((list) => list.filter((i) => i.id !== id));
  }

  async function handleContinue() {
    setSubmitting(true);
    setError(null);
    setUnavailable([]);
    try {
      const res = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cart.items, slot, deviceId: getDeviceId() }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setUnavailable(data.unavailable || []);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue, réessayez.");
        return;
      }

      setPayment({
        testMode: !!data.testMode,
        clientSecret: data.clientSecret || null,
        total: data.total,
        rewardApplied: data.rewardApplied || null,
        rewardBlocked: data.rewardBlocked || null,
      });
      setStep("payment");
    } catch {
      setError("Impossible de contacter le serveur, réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitConfirmation({ paymentIntentId, testMode }) {
    const res = await fetch("/api/orders/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.items, slot, guest, paymentIntentId, testMode, deviceId: getDeviceId() }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "La confirmation de commande a échoué.");
      return;
    }

    setConfirmation(data);
    cart.clearCart();
    setStep("success");
  }

  function handleBack() {
    setError(null);
    setStep("pickup");
  }

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: MOKA.cream }}>
      {step !== "success" && (
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <button
            onClick={step === "payment" ? handleBack : () => router.push("/commander")}
            aria-label="Retour"
            className="w-11 h-11 -ml-2 flex items-center justify-center cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" style={{ color: MOKA.brown }} />
          </button>
          <div>
            <h1 className="text-lg font-black" style={{ color: MOKA.brown }}>
              {STEP_TITLES[step]}
            </h1>
            <p className="text-xs" style={{ color: MOKA.brownLight }}>
              Étape {step === "pickup" ? "1" : "2"} sur 2
            </p>
          </div>
        </div>
      )}

      {step === "pickup" && (
        <PickupStep
          items={cart.items}
          total={cart.subtotal}
          slot={slot}
          onSelectSlot={setSlot}
          guest={guest}
          onGuestChange={setGuest}
          unavailable={unavailable}
          onRemoveUnavailable={removeUnavailable}
          error={error}
          submitting={submitting}
          onContinue={handleContinue}
        />
      )}

      {step === "payment" && (
        <PaymentStep
          testMode={payment.testMode}
          clientSecret={payment.clientSecret}
          total={payment.total}
          rewardApplied={payment.rewardApplied}
          rewardBlocked={payment.rewardBlocked}
          error={error}
          onError={setError}
          onSuccess={(paymentIntentId) => submitConfirmation({ paymentIntentId, testMode: false })}
          onSimulate={() => submitConfirmation({ paymentIntentId: null, testMode: true })}
        />
      )}

      {step === "success" && confirmation && (
        <SuccessStep
          orderCode={confirmation.orderCode}
          slotLabel={confirmation.slotLabel || PICKUP_SLOTS.find((s) => s.id === slot)?.label}
          onDone={() => router.push("/commander")}
        />
      )}
    </div>
  );
}
