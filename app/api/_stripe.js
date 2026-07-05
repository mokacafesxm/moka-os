import Stripe from "stripe";

// Checkout runs in test mode (simulated payment, no real charge) until a real
// Stripe account exists and STRIPE_SECRET_KEY is set — see .env.local.
export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let stripeClient = null;

export function getStripe() {
  if (!isStripeConfigured()) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-01-27.acacia" });
  }
  return stripeClient;
}
