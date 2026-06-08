import { DB, corsHeaders, queryDatabase, getTitle, getSelect, getNumber, getRelationIds } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.STOCK, null, null, 200);

    const stock = pages.map((page) => {
      const p = page.properties;
      const ingredientIds = getRelationIds(p, "Ingredient", "Produit", "produit");
      return {
        id: page.id,
        name: getTitle(p, "Produit", "produit", "Ingredient", "Nom", "nom", "Name"),
        category: getSelect(p, "Catégorie", "Categorie", "categorie", "Category"),
        categorie: getSelect(p, "Catégorie", "Categorie", "categorie", "Category"),
        statut: getSelect(p, "Statut", "statut", "Status", "status"),
        portionsRestantes: getNumber(p, "Portions restantes", "portionsRestantes", "Portions"),
        quantiteStock: getNumber(p, "Quantite_stock", "Quantité stock", "quantiteStock", "Quantite stock"),
        uniteStock: getSelect(p, "Unite_stock", "Unité stock", "uniteStock", "Unite stock"),
        zone: getSelect(p, "Zone", "zone", "Zone de stockage"),
        ingredientId: ingredientIds[0] || null,
      };
    });

    return Response.json(stock, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
