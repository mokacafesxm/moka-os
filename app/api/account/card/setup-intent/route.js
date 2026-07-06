import { corsHeaders } from "../../../_notion";
import { getStripe, isStripeConfigured } from "../../../_stripe";
import { getPhoneFromRequest } from "../../../_session";
import { findClientByPhone, setClientStripeCustomerId } from "../../../_clients";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Step 1 of "add a card": a SetupIntent collects and validates a card with
// no charge attached — the Stripe Customer it's tied to is what lets the
// resulting payment method be reused at checkout later.
export async function POST(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) {
      return Response.json({ error: "Connecte-toi pour ajouter une carte." }, { status: 401, headers: corsHeaders });
    }
    if (!isStripeConfigured()) {
      return Response.json({ error: "Paiement non configuré pour le moment." }, { status: 503, headers: corsHeaders });
    }

    const client = await findClientByPhone(phone);
    if (!client) {
      return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });
    }

    const stripe = getStripe();
    let customerId = client.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ phone, name: client.prenom || undefined });
      customerId = customer.id;
      await setClientStripeCustomerId(client.id, customerId);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true },
    });

    return Response.json({ clientSecret: setupIntent.client_secret }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
