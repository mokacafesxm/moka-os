import { corsHeaders } from "../../_notion";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone, setClientPrenom } from "../../_clients";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Final step for a brand-new account (see /api/auth/verify-code's
// isNewClient): the customer is already signed in at this point, this just
// fills in the one piece of profile info the sign-in flow deliberately
// doesn't ask for upfront.
export async function POST(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) {
      return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });
    }

    const { prenom } = await request.json();
    if (!prenom?.trim()) {
      return Response.json({ error: "Prénom requis" }, { status: 400, headers: corsHeaders });
    }

    const client = await findClientByPhone(phone);
    if (!client) {
      return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });
    }

    await setClientPrenom(client.id, prenom.trim());
    return Response.json({ prenom: prenom.trim() }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
