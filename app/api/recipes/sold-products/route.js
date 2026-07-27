import { corsHeaders, getPage, updatePage, createPage, queryDatabase, archivePage } from "../../_notion";
import { getSoldProductsDbId } from "../../../../lib/recipes/config";
import { listSoldProducts, createSoldProduct, updateSoldProduct, archiveSoldProduct } from "../../../../lib/recipes/sold-products-service";

// Sold Product Catalogue — Recipe Catalogue foundation, target architecture
// domain A/G. The database id is not yet configured (see
// docs/ARCHITECTURE.md "Recipe Catalogue foundation") — every handler below
// fails with a clear CONFIG_MISSING error until NOTION_SOLD_PRODUCTS_DB_ID
// is set, never silently pointing at the wrong database.
const notion = { getPage, updatePage, createPage, queryDatabase, archivePage };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const soldProductsDbId = getSoldProductsDbId();
    const list = await listSoldProducts({ soldProductsDbId, notion });
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
    const { id } = await createSoldProduct(data, { soldProductsDbId, notion });
    return Response.json({ success: true, id }, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 400;
    return Response.json({ success: false, error: err.message }, { status, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    await updateSoldProduct(id, data, { notion });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 400, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    await archiveSoldProduct(id, { notion });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 400, headers: corsHeaders });
  }
}
