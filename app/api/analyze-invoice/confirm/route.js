import { DB, corsHeaders, getPage, updatePage, createPage, resolveName, queryDatabase } from "../../_notion";
import { confirmInvoiceReceipt } from "../../../../lib/stock/invoice-receipt";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const notion = { getPage, updatePage, createPage, resolveName, queryDatabase };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Invoice-scan stock-confirmation safety (Architecture Ownership Audit,
// section 3). The OCR preview (POST /api/analyze-invoice) is unchanged and
// still writes nothing. This route backs the human "confirm" step only,
// replacing the previous direct/untracked stock increments with an
// idempotency key derived from the server-recomputed invoice hash — a
// duplicate confirmation of the same invoice cannot add stock again.
//
// Invoice scanning and supplier-order receiving are two ALTERNATIVE receipt
// origins for the same physical delivery; this route does not attempt to
// auto-match one to the other. If `supplierOrderId` is supplied (no current
// UI surface sets it yet), the confirmation is routed through the same
// canonical supplier-receiving saga used by /api/supplier-orders/receive,
// so the two origins can never independently credit the same delivery.
export async function POST(request) {
  try {
    const { base64, items, supplierOrderId, isFinal } = await request.json();

    if (!base64) return Response.json({ error: "base64 (image) requis" }, { status: 400, headers: corsHeaders });
    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "items (array) requis" }, { status: 400, headers: corsHeaders });
    }

    const result = await confirmInvoiceReceipt({
      base64,
      items,
      supplierOrderId: supplierOrderId || null,
      isFinal: Boolean(isFinal),
      stockDbId: DB.STOCK,
      notion,
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    console.error("[analyze-invoice/confirm]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
