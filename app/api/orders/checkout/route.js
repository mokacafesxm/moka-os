import { DB, corsHeaders, getPage, getCheckbox } from "../../_notion";
import { getStripe, isStripeConfigured } from "../../_stripe";
import { computeTotal, isValidSlot } from "../_shared";
import { resolveActiveReward, round2 } from "../../wheel/_shared";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Step 1 of checkout: validate the cart is still orderable and, if a real
// Stripe account is configured, open a PaymentIntent for it. Re-checks
// availability against Notion (not the client's possibly-stale cart) so an
// item that went unavailable after it was added can't be paid for.
export async function POST(request) {
  try {
    const { items, slot, deviceId } = await request.json();

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
    const rewardResult = await resolveActiveReward(deviceId, items);
    const rewardApplied = rewardResult?.valid ? rewardResult : null;
    const total = Math.max(0, round2(subtotal - (rewardApplied?.discount || 0)));

    if (!isStripeConfigured()) {
      return Response.json({ testMode: true, total, subtotal, rewardApplied, rewardBlocked: rewardResult && !rewardResult.valid ? rewardResult : null }, { headers: corsHeaders });
    }

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "eur",
      automatic_payment_methods: { enabled: true },
    });

    return Response.json(
      {
        testMode: false,
        total,
        subtotal,
        rewardApplied,
        rewardBlocked: rewardResult && !rewardResult.valid ? rewardResult : null,
        clientSecret: intent.client_secret,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
