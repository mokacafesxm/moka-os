import { loadStripe } from "@stripe/stripe-js";

let stripePromise = null;

// Resolves to null when no publishable key is configured yet — the checkout
// flow falls back to its test-mode (simulated payment) path in that case.
export function getStripeClient() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return null;
  if (!stripePromise) stripePromise = loadStripe(key);
  return stripePromise;
}
