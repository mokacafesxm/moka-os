import { DB, corsHeaders, queryDatabase, getTitle, getText, getSelect, getCheckbox, getNumber, getRelationIds, getPage } from "../_notion";

async function buildSupplierMap() {
  const pages = await queryDatabase(DB.FOURNISSEURS);
  const map = {};
  for (const p of pages) {
    map[p.id] = getTitle(p.properties, "Nom", "nom", "Name", "name");
  }
  return map;
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const [pages, supplierMap] = await Promise.all([
      queryDatabase(DB.INGREDIENTS, {
        property: "Visible OrderPad",
        checkbox: { equals: true },
      }),
      buildSupplierMap(),
    ]);

    const products = pages.map((page) => {
      const p = page.properties;
      const supplierIds = getRelationIds(p, "Fournisseur par défaut", "Fournisseur", "fournisseur");
      const supplier = supplierIds.length ? (supplierMap[supplierIds[0]] || "") : getText(p, "Fournisseur par défaut", "fournisseurDefaut");

      return {
        id: page.id,
        name: getTitle(p, "Ingredient", "Nom", "nom", "Name", "name"),
        ingredient: getTitle(p, "Ingredient", "Nom", "nom", "Name", "name"),
        category: getSelect(p, "Catégorie", "Categorie", "categorie", "Category"),
        categorie: getSelect(p, "Catégorie", "Categorie", "categorie", "Category"),
        subcategory: getSelect(p, "Sous-catégorie", "Sous catégorie", "SousCategorie", "sousCategorie"),
        sousCategorie: getSelect(p, "Sous-catégorie", "Sous catégorie", "SousCategorie", "sousCategorie"),
        supplier,
        fournisseurDefaut: supplier,
        unit: getSelect(p, "Unité commande", "Unite commande", "uniteCommande", "Unité stock"),
        uniteStock: getSelect(p, "Unité stock", "Unite stock", "uniteStock"),
        uniteCommande: getSelect(p, "Unité commande", "Unite commande", "uniteCommande"),
        suggested: getNumber(p, "Quantité commandée suggérée", "quantiteCommandeSuggeree", "Quantite commandee"),
        quantiteCommandeSuggeree: getNumber(p, "Quantité commandée suggérée", "quantiteCommandeSuggeree"),
        zone: getSelect(p, "Zone de stockage", "Zone", "zone", "zoneStockage"),
        zoneStockage: getSelect(p, "Zone de stockage", "Zone", "zone", "zoneStockage"),
        seuilAlerte: getNumber(p, "Seuil alerte", "seuilAlerte"),
        seuilCritique: getNumber(p, "Seuil critique", "seuilCritique"),
        portionGrammes: getNumber(p, "Portion (g)", "Portion", "portionGrammes"),
        visibleOrderPad: getCheckbox(p, "Visible OrderPad", "visibleOrderPad"),
        photo: p["Photo"]?.files?.[0]?.file?.url || p["Photo"]?.files?.[0]?.external?.url || "",
      };
    });

    return Response.json(products, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
