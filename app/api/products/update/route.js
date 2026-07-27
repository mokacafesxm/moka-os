import { DB, corsHeaders, getPage, updatePage, createPage, queryDatabase, resolveName, archivePage } from "../../_notion";
import { updateIngredient } from "../../../../lib/ops/ingredients-service";

// Not called by the current UI (app/page.js uses /api/settings/products) —
// kept working rather than silently removed, now delegating to the same
// canonical INGREDIENTS writer, in "full" mode to match this route's
// original behavior exactly: every field is overwritten, and an unresolved
// default supplier explicitly clears the relation (see
// docs/ARCHITECTURE.md "Architecture cleanup — Phase 1").
const notion = { getPage, updatePage, createPage, queryDatabase, resolveName, archivePage };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) {
      return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    }
    await updateIngredient(id, data, { fournisseursDbId: DB.FOURNISSEURS, notion, mode: "full" });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
