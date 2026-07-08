import { DB, corsHeaders, queryDatabase, getTitle, getText, getNumber, getSelect, getDate, getCheckbox } from "../../_notion";
import { mapOrderProps } from "../_shared";

const EXTRACTORS = { getTitle, getText, getNumber, getSelect, getDate, getCheckbox };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Lightweight endpoint polled app-wide every few seconds by every connected
// device: the new orders that no one has acknowledged yet. As soon as one
// device acknowledges (POST /api/orders/ack), this list shrinks and the
// others' alert popup + sound stop on their next tick.
export async function GET() {
  try {
    const pages = await queryDatabase(DB.COMMANDES_CLIENTS, {
      and: [
        { property: "Statut préparation", select: { equals: "Nouvelle" } },
        { property: "Accusé réception", checkbox: { equals: false } },
      ],
    });

    const orders = pages
      .map((p) => ({ id: p.id, ...mapOrderProps(p.properties, EXTRACTORS) }))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return Response.json({ orders }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
