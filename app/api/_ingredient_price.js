// Dernier prix connu et fiable d'un ingrédient — délègue à
// lib/ops/ingredient-cost.js (source unique, injectée avec les primitives
// Notion de ce module). Utilisé par le garde-fou écart de prix à l'écriture
// (_ingredient_matching.js) et par /api/recipe-cost (coût matière) — PR3 et
// PR4 du chantier "coût matière".

import { DB, queryDatabase } from "./_notion";
import { getLastKnownPrice as getLastKnownPriceCore } from "../../lib/ops/ingredient-cost";

export async function getLastKnownPrice(ingredientMasterId) {
  return getLastKnownPriceCore(ingredientMasterId, {
    prixIngredientsDbId: DB.PRIX_INGREDIENTS,
    notion: { queryDatabase },
  });
}
