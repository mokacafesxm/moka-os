import { corsHeaders, getPage, updatePage, createPage, queryDatabase, archivePage } from "../../_notion";
import { getSoldProductsDbId, getRecipeLinesDbId } from "../../../../lib/recipes/config";
import { listRecipeLines, createRecipeLine, updateRecipeLine, archiveRecipeLine } from "../../../../lib/recipes/recipes-service";

// Recipe Lines — Recipe Catalogue foundation, target architecture domain
// B/G. Validation (missing product/ingredient, non-positive quantity,
// duplicate active product+ingredient, incompatible units, inactive
// ingredient) happens inside lib/recipes/recipes-service.js /
// lib/recipes/validation.js — this route never duplicates that logic, only
// surfaces its result. See docs/ARCHITECTURE.md "Recipe Catalogue
// foundation" for why the database id is not yet configured.
const notion = { getPage, updatePage, createPage, queryDatabase, archivePage };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const soldProductId = searchParams.get("soldProductId") || undefined;
    const recipeLinesDbId = getRecipeLinesDbId();
    const list = await listRecipeLines({ recipeLinesDbId, notion, soldProductId });
    return Response.json(list, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    return Response.json({ error: err.message }, { status, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    const soldProductsDbId = getSoldProductsDbId();
    const recipeLinesDbId = getRecipeLinesDbId();
    const result = await createRecipeLine(data, { soldProductsDbId, recipeLinesDbId, notion });
    if (!result.success) {
      return Response.json(result, { status: 400, headers: corsHeaders });
    }
    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    return Response.json({ success: false, error: err.message }, { status, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return Response.json({ success: false, error: "id required" }, { status: 400, headers: corsHeaders });
    const soldProductsDbId = getSoldProductsDbId();
    const recipeLinesDbId = getRecipeLinesDbId();
    const result = await updateRecipeLine(id, data, { soldProductsDbId, recipeLinesDbId, notion });
    if (!result.success) {
      return Response.json(result, { status: 400, headers: corsHeaders });
    }
    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 400, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    await archiveRecipeLine(id, { notion });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 400, headers: corsHeaders });
  }
}
