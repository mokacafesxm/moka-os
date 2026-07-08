import { DB, corsHeaders, queryDatabase, withNotionCache, getTitle, getText, getNumber, getSelect, getDate, getCheckbox } from "../../_notion";
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
    // Cached ~4s with single-flight: many devices poll this every few seconds,
    // but the server hits Notion at most once per interval per instance. A new
    // order shows within a few seconds — fine for the alert.
    const orders = await withNotionCache("orders-pending", 4000, async () => {
      const pages = await queryDatabase(DB.COMMANDES_CLIENTS, {
        and: [
          { property: "Statut préparation", select: { equals: "Nouvelle" } },
          { property: "Accusé réception", checkbox: { equals: false } },
        ],
      });
      return pages
        .map((p) => ({ id: p.id, ...mapOrderProps(p.properties, EXTRACTORS) }))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    });

    return Response.json({ orders }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
