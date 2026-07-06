import { DB, corsHeaders, getPage, getCheckbox } from "../../_notion";
import { getStripe, isStripeConfigured } from "../../_stripe";
import { computeTotal, isValidSlot } from "../_shared";
import { resolveActiveRewardForClient, round2 } from "../../wheel/_shared";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone } from "../../_clients";
import { resolvePrimaryCardForClient } from "../../_cards";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Charges the customer's saved payment method directly — no Elements form,
// no new card entry. Re-checks availability and the reward exactly like
// /api/orders/checkout since this is an alternate first step, not a
// shortcut around those checks.
export async function POST(request) {
  try {
    const { items, slot } = await request.json();
    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "Le panier est vide" }, { status: 400, headers: corsHeaders });
    }
    if (!isValidSlot(slot)) {
      return Response.json({ error: "Créneau de retrait invalide" }, { status: 400, headers: corsHeaders });
    }
    if (!isStripeConfigured()) {
      return Response.json({ error: "Paiement non configuré." }, { status: 503, headers: corsHeaders });
    }

    const phone = getPhoneFromRequest(request);
    const client = phone ? await findClientByPhone(phone) : null;
    const card = client ? await resolvePrimaryCardForClient(client.id) : null;
    if (!client?.stripeCustomerId || !card) {
      return Response.json({ error: "Aucune carte enregistrée." }, { status: 400, headers: corsHeaders });
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
    const rewardResult = await resolveActiveRewardForClient(client, items);
    const rewardApplied = rewardResult?.valid ? rewardResult : null;
    const total = Math.max(0, round2(subtotal - (rewardApplied?.discount || 0)));

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "eur",
      customer: client.stripeCustomerId,
      payment_method: card.paymentMethodId,
      payment_method_types: ["card"],
      off_session: false,
      confirm: true,
    });

    return Response.json(
      {
        status: intent.status,
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret,
        total,
        subtotal,
        rewardApplied,
        rewardBlocked: rewardResult && !rewardResult.valid ? rewardResult : null,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
