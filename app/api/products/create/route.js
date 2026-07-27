import { DB, corsHeaders, getPage, updatePage, createPage, queryDatabase, resolveName, archivePage } from "../../_notion";
import { createIngredient } from "../../../../lib/ops/ingredients-service";

// Not called by the current UI (app/page.js uses /api/settings/products) —
// kept working rather than silently removed, now delegating to the same
// canonical INGREDIENTS writer, in "full" mode to match this route's
// original field set exactly (see docs/ARCHITECTURE.md "Architecture
// cleanup — Phase 1"). Unlike /api/settings/products, this route never
// bootstrapped a Stock row — preserved as-is.
const notion = { getPage, updatePage, createPage, queryDatabase, resolveName, archivePage };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id } = await createIngredient(body, {
      ingredientsDbId: DB.INGREDIENTS,
      fournisseursDbId: DB.FOURNISSEURS,
      notion,
      mode: "full",
      bootstrapStockRow: false,
    });
    return Response.json({ success: true, id }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
