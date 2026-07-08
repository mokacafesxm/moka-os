export const PICKUP_SLOTS = [
  { id: "asap", label: "Dès que possible" },
  { id: "30min", label: "Dans 30 min" },
  { id: "1h", label: "Dans 1h" },
];

export function isValidSlot(slotId) {
  return PICKUP_SLOTS.some((s) => s.id === slotId);
}

export function slotLabel(slotId) {
  return PICKUP_SLOTS.find((s) => s.id === slotId)?.label || slotId;
}

// Cart items arrive as { id, name, variant, price, qty } — price is per-unit,
// sourced from the live menu at add-to-cart time (see CartContext.js).
export function computeTotal(items) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function buildArticlesText(items) {
  return items
    .map((i) => `${i.qty}x ${i.name}${i.variant ? ` (${i.variant})` : ""} — ${(i.price * i.qty).toFixed(2)}€`)
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
