// Dernier prix connu et fiable d'un ingrédient — partagé entre le garde-fou
// écart de prix à l'écriture (_ingredient_matching.js persistPriceLine) et
// le futur calcul de coût matière (lib/ops/ingredient-cost.js, PR4). Jamais
// une ligne "À valider" : un coût calculé sur un matching pas encore
// confirmé polluerait silencieusement une marge derrière.

import { DB, queryDatabase, getNumber, getDate, getSelect } from "./_notion";

const STATUTS_FIABLES = ["Auto-matché", "Validé manuellement"];

export async function getLastKnownPrice(ingredientMasterId) {
  if (!ingredientMasterId) return null;

  const pages = await queryDatabase(DB.PRIX_INGREDIENTS, {
    property: "Ingredient_Master",
    relation: { contains: ingredientMasterId },
  }, [{ property: "Date", direction: "descending" }], 50);

  for (const page of pages) {
    if (!STATUTS_FIABLES.includes(getSelect(page.properties, "Statut_Matching"))) continue;
    const prixUnitaire = getNumber(page.properties, "Prix_Unitaire");
    if (!prixUnitaire) continue;
    return { id: page.id, prixUnitaire, date: getDate(page.properties, "Date") };
  }
  return null;
}
