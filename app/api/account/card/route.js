import { corsHeaders } from "../../_notion";
import { getStripe, isStripeConfigured } from "../../_stripe";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone, clearClientCard } from "../../_clients";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) return Response.json({ cardLabel: null }, { headers: corsHeaders });

    const client = await findClientByPhone(phone);
    return Response.json({ cardLabel: client?.cardLabel || null }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) {
      return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });
    }

    const client = await findClientByPhone(phone);
    if (!client?.paymentMethodId) {
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    if (isStripeConfigured()) {
      const stripe = getStripe();
      await stripe.paymentMethods.detach(client.paymentMethodId).catch(() => {});
    }

    await clearClientCard(client.id);
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
