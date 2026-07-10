import { DB, queryDatabase } from "../_notion";
import { resolveActiveRewardForClient, round2 } from "../wheel/_shared";

export const PICKUP_SLOTS = [
  { id: "asap", label: "Dès que possible" },
  { id: "30min", label: "Dans 30 min" },
  { id: "1h", label: "Dans 1h" },
];

export function isValidSlot(slotId) {
  return PICKUP_SLOTS.some((s) => s.id === slotId);
}

// Stripe's minimum charge for EUR is €0.50. A wheel reward can bring an order
// to €0 (or below that floor) — those orders skip payment entirely and are
// confirmed as free rather than sent to Stripe (which rejects sub-minimum
// amounts). Checked server-side in checkout / pay-saved-card / confirm so a
// free order is decided from the recomputed total, never a client claim.
export const STRIPE_MIN_CHARGE_EUR = 0.5;

export function isFreeOrder(total) {
  return total < STRIPE_MIN_CHARGE_EUR;
}

export function slotLabel(slotId) {
  return PICKUP_SLOTS.find((s) => s.id === slotId)?.label || slotId;
}

// Cart items arrive as { id, name, variant, price, qty } — price is per-unit,
// sourced from the live menu at add-to-cart time (see CartContext.js).
export function computeTotal(items) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

// -10% automatically applied on a connected client's very first order ever —
// no code to enter. "First order" = zero prior rows in COMMANDES_CLIENTS for
// this phone, regardless of status (even a still-"Nouvelle" order counts as
// already having ordered once).
const FIRST_ORDER_PERCENT = 0.1;

export async function isFirstOrderClient(phone) {
  if (!phone) return false;
  const pages = await queryDatabase(DB.COMMANDES_CLIENTS, { property: "Téléphone", phone_number: { equals: phone } }, null, 1);
  return pages.length === 0;
}

// Applies at most ONE discount, never both at once:
//   1. The first-order promo, if the client qualifies — always wins over an
//      active wheel reward when both are available (product decision: simpler
//      than comparing amounts, and the reward is left untouched for next time).
//   2. Otherwise, the client's active wheel reward, exactly as before.
// Shared by checkout / pay-saved-card / confirm so the three routes can never
// drift apart on which discount actually applied.
export async function resolveOrderDiscount({ client, phone, items }) {
  const subtotal = computeTotal(items);
  const firstOrder = Boolean(client && phone && (await isFirstOrderClient(phone)));

  if (firstOrder) {
    const discount = round2(subtotal * FIRST_ORDER_PERCENT);
    return {
      subtotal,
      discount,
      total: Math.max(0, round2(subtotal - discount)),
      rewardApplied: null,
      rewardBlocked: null,
      firstOrderApplied: { discount },
    };
  }

  const rewardResult = client ? await resolveActiveRewardForClient(client, items) : null;
  const rewardApplied = rewardResult?.valid ? rewardResult : null;
  const rewardBlocked = rewardResult && !rewardResult.valid ? rewardResult : null;
  const discount = rewardApplied?.discount || 0;

  return {
    subtotal,
    discount,
    total: Math.max(0, round2(subtotal - discount)),
    rewardApplied,
    rewardBlocked,
    firstOrderApplied: null,
  };
}

export function buildArticlesText(items) {
  return items
    .map((i) => {
      const extras = i.extras?.length ? ` + ${i.extras.join(", ")}` : "";
      return `${i.qty}x ${i.name}${i.variant ? ` (${i.variant})` : ""}${extras} — ${(i.price * i.qty).toFixed(2)}€`;
    })
    .join("\n");
}

// Short human-readable order code derived from the Notion page id — stable,
// unique (inherits Notion's own id uniqueness), and easy to call out at the counter.
export function orderCodeFromPageId(pageId) {
  const hex = pageId.replace(/-/g, "").slice(-5).toUpperCase();
  return `CMD-${hex}`;
}

// KDS preparation statuses, in order. The next-status button advances one
// step; "Récupérée" is terminal. Values match the Notion "Statut préparation"
// select options exactly.
export const PREP_STATUSES = ["Nouvelle", "En préparation", "Prête", "Récupérée"];

export function nextPrepStatus(current) {
  const i = PREP_STATUSES.indexOf(current);
  if (i === -1 || i === PREP_STATUSES.length - 1) return null;
  return PREP_STATUSES[i + 1];
}

// Maps a Commandes clients Notion page to the shape the KDS / alerts use.
// `mapOrder` is passed the property extractors to avoid importing server-only
// Notion code into anything client-facing.
export function mapOrderProps(props, extractors) {
  const { getTitle, getText, getNumber, getSelect, getDate, getCheckbox } = extractors;
  return {
    code: getTitle(props, "Commande"),
    client: getText(props, "Client"),
    telephone: getText(props, "Téléphone"),
    articles: getText(props, "Articles"),
    total: getNumber(props, "Total"),
    creneau: getSelect(props, "Créneau"),
    prepStatus: getSelect(props, "Statut préparation"),
    acknowledged: getCheckbox(props, "Accusé réception"),
    acknowledgedBy: getText(props, "Accusé par"),
    createdAt: getDate(props, "Date création"),
    readyAt: getDate(props, "Prête le"),
    pickedUpAt: getDate(props, "Récupérée le"),
  };
}
