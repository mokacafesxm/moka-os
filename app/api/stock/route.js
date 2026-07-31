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
    const categoryMap = {};
    ingredientPages.forEach(p => {
      const zone = getSelect(p.properties, "Zone_stockage") || getText(p.properties, "Zone_stockage") || "";
      const subcat = getSelect(p.properties, "Sous-categorie") || getSelect(p.properties, "Sous_categorie") || "";
      const cat = getSelect(p.properties, "Categorie") || "";
      if (zone) zoneMap[p.id] = zone;
      if (subcat) subcatMap[p.id] = subcat;
      if (cat) categoryMap[p.id] = cat;
    });

    return stockPages.map(page => {
      const p = page.properties;
      const ingredientIds = getRelationIds(p, "MOKA_Ingredients_Master");
      const ingredientId = ingredientIds[0] || null;
      // La Categorie propre au Stock (rich_text) est vide sur la quasi-
      // totalité des lignes (audit Prompt 5, 2026-07-30) — la vraie source
      // est le select Categorie de l'ingrédient lié, exactement comme
      // /api/products. On garde le texte du Stock en repli pour les
      // quelques lignes historiques sans relation ingrédient.
      const category = (ingredientId && categoryMap[ingredientId]) || getText(p, "Categorie") || "";

      return {
        id: page.id,
        name: getTitle(p, "Produit") || "",
        category,
        categorie: category,
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
