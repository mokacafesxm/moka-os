import { corsHeaders } from "../../../_notion";
import { getStripe, isStripeConfigured } from "../../../_stripe";
import { getPhoneFromRequest } from "../../../_session";
import { findClientByPhone, setClientCard } from "../../../_clients";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Step 2: once the customer confirms the SetupIntent client-side, look up
// the resulting payment method (Stripe already attached it to the customer
// as part of confirming a customer-scoped SetupIntent) and store only its
// id + a display label — never any raw card data, that's Stripe's job.
export async function POST(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) {
      return Response.json({ error: "Connecte-toi pour ajouter une carte." }, { status: 401, headers: corsHeaders });
    }
    if (!isStripeConfigured()) {
      return Response.json({ error: "Paiement non configuré pour le moment." }, { status: 503, headers: corsHeaders });
    }

    const { setupIntentId } = await request.json();
    if (!setupIntentId) {
      return Response.json({ error: "setupIntentId requis" }, { status: 400, headers: corsHeaders });
    }

    const client = await findClientByPhone(phone);
    if (!client) {
      return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });
    }

    const stripe = getStripe();
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    if (setupIntent.status !== "succeeded" || !setupIntent.payment_method) {
      return Response.json({ error: "La carte n'a pas été confirmée." }, { status: 400, headers: corsHeaders });
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(setupIntent.payment_method);
    const cardLabel = paymentMethod.card ? `${paymentMethod.card.brand} •••• ${paymentMethod.card.last4}` : "Carte enregistrée";

    if (client.stripeCustomerId) {
      await stripe.customers.update(client.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethod.id },
      });
    }

    await setClientCard(client.id, { paymentMethodId: paymentMethod.id, cardLabel });
    return Response.json({ cardLabel }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
