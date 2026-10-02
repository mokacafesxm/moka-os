export const STATUS_COLOR = {
  Nouvelle: "bg-blue-50 text-blue-700",
  "En préparation": "bg-orange-50 text-orange-700",
  Prête: "bg-green-50 text-green-700",
  Récupérée: "bg-[#f0e8dc] text-[#9a7060]",
};

export function formatDateHeure(iso) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "America/Puerto_Rico",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatEuros(n) {
  return `${(n || 0).toFixed(2).replace(".", ",")}€`;
}

// Mirrors the exact sentinel strings written by confirm/staff-create routes
// (see app/api/orders/confirm/route.js, staff-create/route.js) — Stripe's
// PaymentIntent doesn't retain whether a card payment went through Apple Pay
// specifically, so "Carte en ligne" is as precise as the stored data gets.
export function paymentLabel(reference) {
  if (reference === "OFFERT") return "Offert (récompense)";
  if (reference === "TEST-MODE") return "Test";
  if (reference === "STAFF-SUR-PLACE") return "Sur place (staff)";
  if (/^pi_/.test(reference || "")) return "Carte en ligne";
  return reference || "—";
}
