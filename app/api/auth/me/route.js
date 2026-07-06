import { corsHeaders } from "../../_notion";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone } from "../../_clients";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Restores the signed-in state on app load from the session cookie —
// CustomerContext calls this once on mount instead of trusting local state.
export async function GET(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) return Response.json({ connected: false }, { headers: corsHeaders });

    const client = await findClientByPhone(phone);
    if (!client) return Response.json({ connected: false }, { headers: corsHeaders });

    return Response.json({ connected: true, prenom: client.prenom, telephone: client.telephone }, { headers: corsHeaders });
  } catch {
    return Response.json({ connected: false }, { headers: corsHeaders });
  }
}
