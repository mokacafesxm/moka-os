import { DB, corsHeaders, getPage, updatePage, createPage, resolveName, queryDatabase } from "../../_notion";
import { handleStockUpdate } from "../../../../lib/stock/handle-stock-update";

const notion = { getPage, updatePage, createPage, resolveName, queryDatabase };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Additive stock changes (mode: "add" | "upsert") require an idempotencyKey
// and can never apply the same delta twice — see docs/ARCHITECTURE.md
// "Stock safety patch" and lib/stock/idempotency.js for the key formats.
// `mode: "replace"` (manual physical count / full recount) is unchanged.
export async function POST(request) {
  try {
    const { id, poidsTotal, Unite, mode, name, notionProductId, idempotencyKey } = await request.json();

    const result = await handleStockUpdate({
      id,
      name,
      notionProductId,
      poidsTotal,
      unite: Unite,
      mode,
      idempotencyKey,
      stockDbId: DB.STOCK,
      notion,
    });

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400, headers: corsHeaders });
    }
    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    console.error("[stock/update]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
