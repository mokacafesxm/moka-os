import { DB, corsHeaders, createPage, queryDatabase, getTitle, getSelect, getRelationIds } from "../../_notion";
import { ensureStockRowForIngredient } from "../../../../lib/stock/ensure-stock-row";

// Backfills missing Stock rows for any Ingredient lacking one — Architecture
// cleanup Phase 1. Delegates per-ingredient to the same canonical
// ensureStockRowForIngredient used at ingredient-creation time
// (app/api/settings/products) and by the additive stock-update path
// (lib/stock/apply-addition.js), instead of its own independent
// relation-only existence check — which could miss a legacy row never
// linked via relation but already present by name, a latent duplicate-row
// risk this consolidation fixes. Also now uses the shared DB.INGREDIENTS/
// DB.STOCK config instead of its own hardcoded copies of the same ids.
//
// This route still auto-fires on every admin page load (app/page.js) — that
// trigger is a UI/business-behavior concern, unchanged and out of scope for
// this code-consolidation pass. What changes here is purely that the
// operation it triggers is now provably idempotent and duplicate-row-safe,
// including against a concurrent ingredient-creation bootstrap for the same
// ingredient (both go through the same in-process lock).
const notion = { createPage, queryDatabase };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const [ingredientPages, stockPages] = await Promise.all([
      queryDatabase(DB.INGREDIENTS, null, null, 300),
      queryDatabase(DB.STOCK, null, null, 300),
    ]);

    const linkedIngredientIds = new Set();
    for (const page of stockPages) {
      const rel = getRelationIds(page.properties, "MOKA_Ingredients_Master");
      if (rel[0]) linkedIngredientIds.add(rel[0]);
    }

    const missing = ingredientPages.filter((p) => !linkedIngredientIds.has(p.id));

    const created = [];
    const errors = [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((page) => {
        const name = getTitle(page.properties, "Ingredient");
        const uniteStock = getSelect(page.properties, "Unite_stock");
        return ensureStockRowForIngredient({
          ingredientId: page.id,
          ingredientName: name,
          uniteStock,
          stockDbId: DB.STOCK,
          notion,
        }).then((result) => ({ name, ...result }));
      }));
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.created) created.push(r.value.name);
        else if (r.status === "rejected") errors.push(r.reason?.message || "erreur inconnue");
      }
      if (i + BATCH_SIZE < missing.length) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    return Response.json({
      success: true,
      createdCount: created.length,
      alreadyExistCount: ingredientPages.length - missing.length,
      errorCount: errors.length,
      created,
      errors,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[sync-stock]", err);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
