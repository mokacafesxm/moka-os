import { corsHeaders } from "../../_notion";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone, listClientRewards } from "../../_clients";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Powers the "Mes promos" section: the one active reward (if any) plus the
// full past history (used / expired), both derived from this client's wheel
// spins in Notion.
export async function GET(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) return Response.json({ active: null, history: [] }, { headers: corsHeaders });

    const client = await findClientByPhone(phone);
    if (!client) return Response.json({ active: null, history: [] }, { headers: corsHeaders });

    const rewards = await listClientRewards(client.id);
    const active = rewards.find((r) => r.status === "active") || null;
    const history = rewards.filter((r) => r !== active);

    return Response.json({ active, history }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
