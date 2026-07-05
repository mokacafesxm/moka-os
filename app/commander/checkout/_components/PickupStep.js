"use client";

import { MOKA } from "../../_lib/theme";
import { PICKUP_SLOTS } from "../../_lib/pickupSlots";
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

const inputClass =
  "w-full rounded-full border bg-white px-5 py-3.5 text-sm outline-none min-h-[44px] focus:ring-2 focus:ring-offset-2 focus:ring-[#587F25]";
const inputStyle = { borderColor: MOKA.brownLight, color: MOKA.brown };

export default function PickupStep({
  items,
  total,
  slot,
  onSelectSlot,
  guest,
  onGuestChange,
  unavailable,
  onRemoveUnavailable,
  error,
  submitting,
  onContinue,
}) {
  const canContinue = Boolean(slot) && guest.prenom.trim() && guest.telephone.trim() && !unavailable.length;

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
        <div className="space-y-2.5">
          <div>
            <label htmlFor="checkout-prenom" className="sr-only">
              Prénom
            </label>
            <input
              id="checkout-prenom"
              required
              placeholder="Prénom"
              value={guest.prenom}
              onChange={(e) => onGuestChange({ ...guest, prenom: e.target.value })}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="checkout-telephone" className="sr-only">
              Téléphone
            </label>
            <input
              id="checkout-telephone"
              required
              type="tel"
              placeholder="Téléphone"
              value={guest.telephone}
              onChange={(e) => onGuestChange({ ...guest, telephone: e.target.value })}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: MOKA.brownLight }}>
          Pour vous appeler quand votre commande est prête.
        </p>
      </div>

      <OrderSummary items={items} total={total} />

      {error && (
        <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
          {error}
        </p>
      )}

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
    </div>
  );
}
