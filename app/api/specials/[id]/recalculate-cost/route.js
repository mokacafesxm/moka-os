import { DB, corsHeaders, queryDatabase, updatePage, numberProp } from "../../../_notion";
import { normalizeLigne } from "../../lignes/route";
import { computeRecipeCost } from "../../../../../lib/ops/ingredient-cost";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Recalcule Cout_Matiere_Estime depuis les lignes ingrédients actives —
// voir lib/ops/ingredient-cost.js (même fonction que /api/recipe-cost,
// jamais une formule Notion : "dernier prix connu, jamais une ligne à
// valider" ne s'exprime pas en rollup natif). Ecrit le résultat sur la
// fiche ; Marge_Estimee (formule Notion Prix_Cible - Cout_Matiere_Estime)
// se met à jour automatiquement côté Notion.
export async function POST(_req, { params }) {
  try {
    const { id } = await params;

    const lignesPages = await queryDatabase(DB.BOISSON_SPECIALE_LIGNES, {
      property: "Boisson_Speciale",
      relation: { contains: id },
    });
    const lignesActives = lignesPages.map(normalizeLigne).filter((l) => l.actif && l.ingredientId);

    const result = await computeRecipeCost(
      lignesActives.map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantite })),
      { prixIngredientsDbId: DB.PRIX_INGREDIENTS, notion: { queryDatabase } }
    );

    const totalCost = Math.round(result.totalCost * 100) / 100;
    await updatePage(id, { Cout_Matiere_Estime: numberProp(totalCost) });

    return Response.json({ success: true, coutMatiereEstime: totalCost, ...result }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST specials/[id]/recalculate-cost]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
