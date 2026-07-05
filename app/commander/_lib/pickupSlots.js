// Mirrors PICKUP_SLOTS in app/api/orders/_shared.js — kept as a small, separate
// client-side copy rather than importing across the API boundary.
export const PICKUP_SLOTS = [
  { id: "asap", label: "Dès que possible" },
  { id: "30min", label: "Dans 30 min" },
  { id: "1h", label: "Dans 1h" },
];
