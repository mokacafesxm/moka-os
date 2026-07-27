import { DB, corsHeaders, getPage, updatePage, createPage, resolveName, queryDatabase } from "../../_notion";
import { runSupplierReceivingSaga } from "../../../../lib/stock/supplier-receiving";

const notion = { getPage, updatePage, createPage, resolveName, queryDatabase };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Consolidated supplier-receiving operation (Architecture Ownership Audit,
// section 2/J). Replaces the client independently firing an unrelated
// `PATCH /api/supplier-orders` (status) and `POST /api/stock/update`
// (quantity) for the same delivery. Call once per confirmed receiving step
// with the lines confirmed so far; pass `isFinal: true` on the last step —
// the order is only marked "Reçu" when that call succeeds for every line.
// Safe to retry: each line's stock addition is independently idempotent, so
// resending previously-successful lines cannot reapply them.
export async function POST(request) {
  try {
    const { orderId, lines, isFinal } = await request.json();

    if (!orderId) return Response.json({ error: "orderId requis" }, { status: 400, headers: corsHeaders });
    if (!Array.isArray(lines) || !lines.length) {
      return Response.json({ error: "lines (array) requis" }, { status: 400, headers: corsHeaders });
    }

    const result = await runSupplierReceivingSaga({
      orderId,
      lines,
      isFinal: Boolean(isFinal),
      stockDbId: DB.STOCK,
      notion,
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    console.error("[supplier-orders/receive]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
