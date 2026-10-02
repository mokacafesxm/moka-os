import { getTitle, getText, getNumber, getSelect, getDate, getCheckbox } from "../_notion";
import { mapOrderProps } from "../orders/_shared";

const EXTRACTORS = { getTitle, getText, getNumber, getSelect, getDate, getCheckbox };

// Admin history needs two fields the KDS/account views never read (payment
// status, Stripe reference) — extends mapOrderProps rather than changing it,
// so the board/account-orders shape used elsewhere is untouched.
export function mapAdminOrderProps(props) {
  return {
    ...mapOrderProps(props, EXTRACTORS),
    paymentStatus: getSelect(props, "Statut paiement"),
    stripePaymentIntent: getText(props, "Stripe Payment Intent"),
  };
}

// "Articles" has no structured line-item store (see buildArticlesText in
// orders/_shared.js) — it's one formatted line per item:
//   "{qty}x {name} ({variant}) + {extras} — {price}€"
// with variant/extras both optional. Re-parsed here (never written back)
// for the order detail view and the top-5-products stat — the only two
// places that need more than the raw string.
export function parseArticlesText(articlesText) {
  if (!articlesText) return [];
  return articlesText
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\d+)x\s+(.+?)(?:\s+\(([^)]+)\))?(?:\s+\+\s+(.+?))?\s+—\s+([\d.,]+)€$/);
      if (!m) return { qty: 1, name: line, variant: null, extras: [], price: 0 };
      const [, qty, name, variant, extras, price] = m;
      return {
        qty: Number(qty),
        name,
        variant: variant || null,
        extras: extras ? extras.split(", ") : [],
        price: Number(price.replace(",", ".")),
      };
    });
}

// A direct dashboard link only makes sense for a real PaymentIntent — the
// field also holds the sentinel strings "OFFERT" (reward-zeroed order) and
// "TEST-MODE" (Stripe unconfigured), see orders/confirm/route.js.
export function stripePaymentUrl(reference) {
  return /^pi_/.test(reference || "") ? `https://dashboard.stripe.com/payments/${reference}` : null;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

const PR_OFFSET_H = 4; // America/Puerto_Rico, fixed UTC-4, no DST — same as orders/board.

// Calendar-day/week/month boundaries for the admin stats header (CA jour/
// semaine/mois) — deliberately midnight-based, NOT the wheel's 5am "spin
// day" reset (different business meaning: a financial day, not a reward
// cycle), so not reused from wheel/_shared.js's currentWeekStart/
// currentPeriodStart despite the similar shape.
export function startOfTodayPR(now = new Date()) {
  const prNow = new Date(now.getTime() - PR_OFFSET_H * 3600 * 1000);
  prNow.setUTCHours(0, 0, 0, 0);
  return new Date(prNow.getTime() + PR_OFFSET_H * 3600 * 1000).toISOString();
}

export function startOfWeekPR(now = new Date()) {
  const prNow = new Date(now.getTime() - PR_OFFSET_H * 3600 * 1000);
  const dayOfWeek = prNow.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  prNow.setUTCDate(prNow.getUTCDate() - daysSinceMonday);
  prNow.setUTCHours(0, 0, 0, 0);
  return new Date(prNow.getTime() + PR_OFFSET_H * 3600 * 1000).toISOString();
}

export function startOfMonthPR(now = new Date()) {
  const prNow = new Date(now.getTime() - PR_OFFSET_H * 3600 * 1000);
  prNow.setUTCDate(1);
  prNow.setUTCHours(0, 0, 0, 0);
  return new Date(prNow.getTime() + PR_OFFSET_H * 3600 * 1000).toISOString();
}
