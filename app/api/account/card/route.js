import { corsHeaders } from "../../_notion";
import { getStripe, isStripeConfigured } from "../../_stripe";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone } from "../../_clients";
import { listClientCards, removeClientCard } from "../../_cards";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) return Response.json({ cards: [] }, { headers: corsHeaders });

    const client = await findClientByPhone(phone);
    const cards = client ? await listClientCards(client.id) : [];
    return Response.json({ cards }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// DELETE /api/account/card?paymentMethodId=pm_xxx — one card at a time,
// identified explicitly rather than assuming "the" card (a client can have
// several).
export async function DELETE(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) {
      return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });
    }

    const paymentMethodId = new URL(request.url).searchParams.get("paymentMethodId");
    if (!paymentMethodId) {
      return Response.json({ error: "paymentMethodId requis" }, { status: 400, headers: corsHeaders });
    }

    const client = await findClientByPhone(phone);
    if (!client) {
      return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });
    }

    if (isStripeConfigured()) {
      const stripe = getStripe();
      await stripe.paymentMethods.detach(paymentMethodId).catch(() => {});
    }

    await removeClientCard(paymentMethodId);
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
