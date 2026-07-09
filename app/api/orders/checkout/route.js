import { DB, corsHeaders, getPage, getCheckbox } from "../../_notion";
import { getStripe, isStripeConfigured } from "../../_stripe";
import { computeTotal, isValidSlot, isFreeOrder } from "../_shared";
import { resolveActiveRewardForClient, round2 } from "../../wheel/_shared";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone } from "../../_clients";
import { resolvePrimaryCardForClient } from "../../_cards";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Step 1 of checkout: validate the cart is still orderable and, if a real
// Stripe account is configured, open a PaymentIntent for it. Re-checks
// availability against Notion (not the client's possibly-stale cart) so an
// item that went unavailable after it was added can't be paid for.
export async function POST(request) {
  try {
    const { items, slot } = await request.json();

    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "Le panier est vide" }, { status: 400, headers: corsHeaders });
    }
    if (!isValidSlot(slot)) {
      return Response.json({ error: "Créneau de retrait invalide" }, { status: 400, headers: corsHeaders });
    }

    const uniqueIds = [...new Set(items.map((i) => i.id))];
    const pages = await Promise.all(
      uniqueIds.map(async (id) => {
        try {
          return await getPage(id);
        } catch {
          return null;
        }
      })
    );

    const unavailable = [];
    pages.forEach((page, idx) => {
      const id = uniqueIds[idx];
      const stillExists = page && page.parent?.database_id === DB.WEBSITE_PRODUCTS;
      const disponible = stillExists ? getCheckbox(page.properties, "Disponible") : false;
      if (!disponible) {
        const item = items.find((i) => i.id === id);
        unavailable.push({ id, name: item?.name || "Produit" });
      }
    });

    if (unavailable.length) {
      return Response.json({ unavailable }, { status: 409, headers: corsHeaders });
    }

    const subtotal = computeTotal(items);
    const phone = getPhoneFromRequest(request);
    const client = phone ? await findClientByPhone(phone) : null;
    const rewardResult = client ? await resolveActiveRewardForClient(client, items) : null;
    const rewardApplied = rewardResult?.valid ? rewardResult : null;
    const total = Math.max(0, round2(subtotal - (rewardApplied?.discount || 0)));

    const rewardBlocked = rewardResult && !rewardResult.valid ? rewardResult : null;

    // Reward brought the order to €0 (or below Stripe's minimum): confirm it as
    // free, no PaymentIntent, no saved-card prompt — Stripe would reject a
    // sub-minimum charge. confirm re-derives this from the total independently.
    if (isFreeOrder(total)) {
      return Response.json({ free: true, total, subtotal, rewardApplied, rewardBlocked }, { headers: corsHeaders });
    }

    const primaryCard = client ? await resolvePrimaryCardForClient(client.id) : null;
    const savedCard = primaryCard ? { label: `${primaryCard.brand} •••• ${primaryCard.last4}` } : null;

    if (!isStripeConfigured()) {
      return Response.json({ testMode: true, total, subtotal, rewardApplied, rewardBlocked, savedCard }, { headers: corsHeaders });
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "eur",
      // Cards only (Apple Pay / Google Pay ride on "card" and still show up
      // automatically via the Express Checkout Element) — no Link, Amazon
      // Pay, MB WAY, Bancontact, EPS, none of which fit a Saint-Martin
      // customer base. Deliberately not automatic_payment_methods: that
      // would let the Stripe Dashboard config re-introduce all of those.
      payment_method_types: ["card"],
    });

    return Response.json(
      {
        testMode: false,
        total,
        subtotal,
        rewardApplied,
        rewardBlocked,
        savedCard,
        clientSecret: intent.client_secret,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
