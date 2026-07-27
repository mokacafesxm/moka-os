import { DB, corsHeaders, getPage, updatePage, createPage, queryDatabase, resolveName, archivePage } from "../../_notion";
import { createIngredient, updateIngredient, archiveIngredient } from "../../../../lib/ops/ingredients-service";

// Canonical writer for INGREDIENTS — Architecture cleanup Phase 1. This is
// the route actually used by the live Ingredients UI in app/page.js
// (saveProductDbCreate/saveProductDbEdit/deleteProductDb). Property mapping,
// supplier resolution, and Stock-row bootstrap now live in
// lib/ops/ingredients-service.js / lib/stock/ensure-stock-row.js — shared
// with app/api/products/create, app/api/products/update, and the
// resource=products branch of app/api/settings. See docs/ARCHITECTURE.md
// "Architecture cleanup — Phase 1".
const notion = { getPage, updatePage, createPage, queryDatabase, resolveName, archivePage };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(req) {
  try {
    const body = await req.json();
    if (!String(body.ingredient || body.name || "").trim()) {
      return Response.json({ success: false, error: "Nom ingrédient requis" }, { status: 400, headers: corsHeaders });
    }
    const { id } = await createIngredient(body, {
      ingredientsDbId: DB.INGREDIENTS,
      fournisseursDbId: DB.FOURNISSEURS,
      stockDbId: DB.STOCK,
      notion,
    });
    return Response.json({ success: true, id, item: { id, ...body } }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST products] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    await updateIngredient(id, rest, { fournisseursDbId: DB.FOURNISSEURS, notion, mode: "partial" });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH products] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    await archiveIngredient(id, { notion });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[DELETE products] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
