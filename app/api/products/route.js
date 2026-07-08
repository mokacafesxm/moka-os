import { DB, corsHeaders, queryDatabase, withNotionCache, getTitle, getText, getSelect, getCheckbox, getNumber, getRelationIds } from "../_notion";

async function buildSupplierMap() {
  const pages = await queryDatabase(DB.FOURNISSEURS);
  const map = {};
  for (const p of pages) {
    map[p.id] = getTitle(p.properties, "Fournisseur");
  }
  return map;
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const products = await withNotionCache("products", 60000, async () => {
    const [pages, supplierMap] = await Promise.all([
      queryDatabase(DB.INGREDIENTS, null, null, 300),
      buildSupplierMap(),
    ]);

    return pages.map((page) => {
      const p = page.properties;
      const supplierIds = getRelationIds(p, "Fournisseur par defaut");
      const supplier = supplierIds.length ? (supplierMap[supplierIds[0]] || "") : "";

      return {
        id: page.id,
        name: getTitle(p, "Ingredient"),
        ingredient: getTitle(p, "Ingredient"),
        category: getSelect(p, "Categorie"),
        categorie: getSelect(p, "Categorie"),
        subcategory: getSelect(p, "Sous-categorie") || getSelect(p, "Sous_categorie") || getSelect(p, "Sous-catégorie") || getSelect(p, "sous_categorie") || "",
        sousCategorie: getSelect(p, "Sous-categorie") || getSelect(p, "Sous_categorie") || getSelect(p, "Sous-catégorie") || getSelect(p, "sous_categorie") || "",
        supplier,
        fournisseurDefaut: supplier,
        unit: getSelect(p, "Unite_commande", "Unite_stock"),
        uniteStock: getSelect(p, "Unite_stock"),
        uniteCommande: getSelect(p, "Unite_commande"),
        suggested: getNumber(p, "Quantite_commande_suggeree"),
        quantiteCommandeSuggeree: getNumber(p, "Quantite_commande_suggeree"),
        zone: getSelect(p, "Zone_stockage"),
        zoneStockage: getSelect(p, "Zone_stockage"),
        seuilAlerte: getNumber(p, "Seuil_alerte"),
        seuilCritique: getNumber(p, "Seuil_critique"),
        portionGrammes: getNumber(p, "1 Portion (g)"),
        visibleOrderPad: getCheckbox(p, "Visible_OrderPad"),
        methodeSuivi: getSelect(p, "Methode_suivi"),
        photo: p["photo"]?.files?.[0]?.file?.url || p["photo"]?.files?.[0]?.external?.url || "",
      };
    });
    });

    return Response.json(products, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
