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
