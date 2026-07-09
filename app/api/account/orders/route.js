import { DB, corsHeaders, queryDatabase, getTitle, getText, getNumber, getSelect, getDate, getCheckbox } from "../../_notion";
import { getPhoneFromRequest } from "../../_session";
import { mapOrderProps } from "../../orders/_shared";

const EXTRACTORS = { getTitle, getText, getNumber, getSelect, getDate, getCheckbox };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Powers the "Mes commandes" section: every past order for this client
// (matched by phone, same identity as the session cookie), newest first.
export async function GET(request) {
  try {
    const phone = getPhoneFromRequest(request);
    if (!phone) return Response.json({ orders: [] }, { headers: corsHeaders });

    const pages = await queryDatabase(DB.COMMANDES_CLIENTS, { property: "Téléphone", phone_number: { equals: phone } });
    const orders = pages
      .map((p) => ({ id: p.id, ...mapOrderProps(p.properties, EXTRACTORS) }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return Response.json({ orders }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
