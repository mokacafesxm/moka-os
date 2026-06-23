import {
  DB, corsHeaders,
  queryDatabase, createPage,
  getTitle, getSelect, getRelationIds,
  titleProp, selectProp, numberProp,
} from "../../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// GET → compares MOKA_Ingredients_Master vs MOKA_Stock_Produits_Notion,
//        creates a stock entry (qty 0) for every ingredient that has none.
export async function GET() {
  try {
    const [ingredientPages, stockPages] = await Promise.all([
      queryDatabase(DB.INGREDIENTS, null, null, 300),
      queryDatabase(DB.STOCK, null, null, 300),
    ]);

    // Build set of ingredient IDs already linked to a stock entry
    const linkedIngredientIds = new Set();
    for (const page of stockPages) {
      const ids = getRelationIds(page.properties, "MOKA_Ingredients_Master");
      if (ids[0]) linkedIngredientIds.add(ids[0]);
    }

    const created = [];
    const alreadyExist = [];
    const errors = [];

    for (const page of ingredientPages) {
      const name = getTitle(page.properties, "Ingredient");
      if (!name) continue;

      if (linkedIngredientIds.has(page.id)) {
        alreadyExist.push(name);
        continue;
      }

      // Missing — create stock entry with qty 0
      try {
        const unite = getSelect(page.properties, "Unite_stock");
        const properties = {
          "Produit": titleProp(name),
          "Quantite_stock": numberProp(0),
          "MOKA_Ingredients_Master": { relation: [{ id: page.id }] },
        };
        if (unite) properties["Unite_stock"] = selectProp(unite);

        await createPage(DB.STOCK, properties);
        created.push(name);
        console.log("[sync-stock] créé :", name);
      } catch (err) {
        console.error("[sync-stock] erreur pour", name, ":", err.message);
        errors.push({ name, error: err.message });
      }
    }

    return Response.json({
      success: true,
      createdCount: created.length,
      alreadyExistCount: alreadyExist.length,
      errorCount: errors.length,
      created,
      alreadyExist,
      errors,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[sync-stock]", err);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
