import { DB, corsHeaders, queryDatabase, getTitle, getText, getNumber, getSelect, getDate, getCheckbox } from "../../_notion";
import { mapOrderProps } from "../_shared";

const EXTRACTORS = { getTitle, getText, getNumber, getSelect, getDate, getCheckbox };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Start of today in Puerto Rico (UTC-4, no DST) as a real UTC ISO string —
// same-day pickup only, so the board only ever needs today's orders.
function startOfTodayPR() {
  const PR_OFFSET_H = 4;
  const prNow = new Date(Date.now() - PR_OFFSET_H * 3600 * 1000);
  prNow.setUTCHours(0, 0, 0, 0);
  return new Date(prNow.getTime() + PR_OFFSET_H * 3600 * 1000).toISOString();
}

// Full KDS board: today's orders, mapped and sorted oldest-first. The client
// groups them into the four status columns.
export async function GET() {
  try {
    const pages = await queryDatabase(DB.COMMANDES_CLIENTS, {
      property: "Date création",
      date: { on_or_after: startOfTodayPR() },
    });

    const orders = pages
      .map((p) => ({ id: p.id, ...mapOrderProps(p.properties, EXTRACTORS) }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return Response.json({ orders }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
