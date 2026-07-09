"use client";

import { MOKA } from "../../_lib/theme";
import { PICKUP_SLOTS } from "../../_lib/pickupSlots";
import { useCustomer } from "../../_lib/CustomerContext";
import PhoneAuthFlow from "../../_components/PhoneAuthFlow";
import OrderSummary from "./OrderSummary";

function SlotPill({ slot, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(slot.id)}
      aria-pressed={selected}
      className="flex-1 px-3 py-3 rounded-3xl border text-sm font-semibold cursor-pointer transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#587F25]"
      style={
        selected
          ? { backgroundColor: MOKA.coral, borderColor: MOKA.coral, color: "white" }
          : { backgroundColor: "white", borderColor: MOKA.brownLight, color: MOKA.brown }
      }
    >
      {slot.label}
    </button>
  );
}

export default function PickupStep({
  items,
  total,
  slot,
  onSelectSlot,
  unavailable,
  onRemoveUnavailable,
  error,
  submitting,
  onContinue,
}) {
  const { customer } = useCustomer();
  // Coordinates are the connected account's, not a free-text form — so
  // continuing to payment requires being signed in (and the cart intact).
  const canContinue = customer.connected && Boolean(slot) && !unavailable.length;

  return (
    <div className="px-4 pt-4 pb-4 space-y-5">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: MOKA.brownLight }}>
          Créneau de retrait
        </h2>
        <div className="flex gap-2">
          {PICKUP_SLOTS.map((s) => (
            <SlotPill key={s.id} slot={s} selected={slot === s.id} onSelect={onSelectSlot} />
          ))}
        </div>
      </div>

      {unavailable.length > 0 && (
        <div role="alert" className="rounded-2xl p-4 text-sm" style={{ backgroundColor: "#FBEAEA", color: "#8C2F2F" }}>
          <p className="font-bold mb-2">Ces produits ne sont plus disponibles :</p>
          <ul className="space-y-1.5">
            {unavailable.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2">
                <span>{item.name}</span>
                <button
                  onClick={() => onRemoveUnavailable(item.id)}
                  className="underline font-semibold cursor-pointer p-2 -m-2 min-h-[44px]"
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: MOKA.brownLight }}>
          Vos coordonnées
        </h2>
        {customer.connected ? (
          // Already known from the account — shown read-only, never re-asked.
          <div className="rounded-2xl bg-white px-4 py-3.5 space-y-0.5" style={{ border: `1px solid ${MOKA.brownLight}` }}>
            <p className="text-sm font-bold" style={{ color: MOKA.brown }}>
              {customer.prenom}
            </p>
            <p className="text-sm" style={{ color: MOKA.brownLight }}>
              {customer.telephone}
            </p>
          </div>
        ) : (
          // Not the free-text form anymore — the same phone → SMS code flow as
          // the Compte tab. On success the customer is connected and the
          // read-only card + "Continuer" appear in place of this block.
          <div className="rounded-2xl bg-white px-4 py-4 space-y-3" style={{ border: `1px solid ${MOKA.brownLight}` }}>
            <p className="text-sm" style={{ color: MOKA.brownLight }}>
              Connectez-vous pour finaliser votre commande — on vous préviendra dès qu&apos;elle est prête.
            </p>
            <PhoneAuthFlow idPrefix="checkout" sendLabel="Se connecter pour commander" />
          </div>
        )}
        {customer.connected && (
          <p className="text-xs mt-2" style={{ color: MOKA.brownLight }}>
            Pour vous appeler quand votre commande est prête.
          </p>
        )}
      </div>

      <OrderSummary items={items} total={total} />

      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
          {error}
        </p>
      )}

      {customer.connected && (
        <button
          onClick={onContinue}
          disabled={!canContinue || submitting}
          className={`w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
            canContinue && !submitting ? "cursor-pointer" : "cursor-not-allowed opacity-60"
          }`}
          style={{ backgroundColor: MOKA.coral }}
        >
          {submitting ? "Vérification…" : "Continuer vers le paiement"}
        </button>
      )}
    </div>
  );
}
