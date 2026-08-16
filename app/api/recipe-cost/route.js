import { DB, corsHeaders, queryDatabase, getPage, updatePage, createPage, archivePage } from "../_notion";
import { getRecipeLinesDbId } from "../../../lib/recipes/config";
import { listRecipeLines } from "../../../lib/recipes/recipes-service";
import { computeRecipeCost } from "../../../lib/ops/ingredient-cost";

const notion = { getPage, updatePage, createPage, queryDatabase, archivePage };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Coût matière d'un produit du menu — voir lib/ops/ingredient-cost.js pour
// la formule (dernier prix fiable connu par ingrédient × quantité ×
// yieldFactor, jamais une ligne PRIX_INGREDIENTS "À valider"). S'appuie sur
// Recipe Lines (sold_product -> ingredient, quantity), la seule base de
// recettes de ce repo qui relie déjà un ingrédient par relation plutôt que
// par texte libre (RECETTES_BATCH ne le fait pas — voir _notion.js).
//
// Réutilisable au-delà de cette route : lib/ops/ingredient-cost.js n'est pas
// couplé à Recipe Lines, n'importe quel futur écran (fiche spéciale) peut
// lui passer sa propre liste [{ingredientId, quantity}] sans repasser par
// Notion à sa façon.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const soldProductId = searchParams.get("soldProductId");
    if (!soldProductId) {
      return Response.json({ error: "soldProductId requis" }, { status: 400, headers: corsHeaders });
    }

    const recipeLinesDbId = getRecipeLinesDbId();
    const allLines = await listRecipeLines({ recipeLinesDbId, notion, soldProductId });
    const activeLines = allLines.filter((l) => l.active);

    const result = await computeRecipeCost(
      activeLines.map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantity, yieldFactor: l.yieldFactor })),
      { prixIngredientsDbId: DB.PRIX_INGREDIENTS, notion: { queryDatabase } }
    );

    return Response.json({ soldProductId, lineCount: activeLines.length, ...result }, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    console.error("[recipe-cost]", err.message);
    return Response.json({ error: err.message }, { status, headers: corsHeaders });
  }
}
