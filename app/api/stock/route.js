import { DB, corsHeaders, queryDatabase, withNotionCache, getTitle, getText, getSelect, getNumber, getFormula, getRelationIds } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const stock = await withNotionCache("stock", 30000, async () => {
    const [stockPages, ingredientPages] = await Promise.all([
      queryDatabase(DB.STOCK),
      queryDatabase(DB.INGREDIENTS),
    ]);

    const zoneMap = {};
    const subcatMap = {};
    ingredientPages.forEach(p => {
      const zone = getSelect(p.properties, "Zone_stockage") || getText(p.properties, "Zone_stockage") || "";
      const subcat = getSelect(p.properties, "Sous-categorie") || getSelect(p.properties, "Sous_categorie") || "";
      if (zone) zoneMap[p.id] = zone;
      if (subcat) subcatMap[p.id] = subcat;
    });

    return stockPages.map(page => {
      const p = page.properties;
      const ingredientIds = getRelationIds(p, "MOKA_Ingredients_Master");
      const ingredientId = ingredientIds[0] || null;

      return {
        id: page.id,
        name: getTitle(p, "Produit") || "",
        category: getText(p, "Categorie") || "",
        categorie: getText(p, "Categorie") || "",
        statut: getFormula(p, "Statut") || getSelect(p, "Statut") || "⚪ À configurer",
        portionsRestantes: getNumber(p, "Portions restantes") || 0,
        quantiteStock: getNumber(p, "Quantite_stock") || 0,
        uniteStock: getSelect(p, "Unite_stock") || "",
        zone: zoneMap[ingredientId] || "",
        sousCategorie: subcatMap[ingredientId] || "",
        subcategory: subcatMap[ingredientId] || "",
        ingredientId,
      };
    });
    });

    return Response.json(stock, { headers: corsHeaders });
  } catch (err) {
    console.error("stock error:", err);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
