import { DB, corsHeaders, queryDatabase, getTitle, getText, getSelect, getNumber, getFormula, getRelationIds } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.STOCK, null, null, 200);

    const stock = pages.map((page) => {
      const p = page.properties;
      const ingredientIds = getRelationIds(p, "MOKA_Ingredients_Master");
      return {
        id: page.id,
        name: getTitle(p, "Produit"),
        category: getText(p, "Categorie"),
        categorie: getText(p, "Categorie"),
        statut: getFormula(p, "Statut"),
        portionsRestantes: getFormula(p, "Portions restantes") || getNumber(p, "Portions restantes"),
        quantiteStock: getNumber(p, "Quantite_stock"),
        uniteStock: getSelect(p, "Unite_stock"),
        zone: getText(p, "Emplacement"),
        ingredientId: ingredientIds[0] || null,
      };
    });

    return Response.json(stock, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
