'use strict';

// Coût matière — réutilisable par n'importe quelle route (fiche de création
// spéciale, marge produit standard, futur), pas codé en dur pour un seul
// écran. Même pattern d'injection que lib/ops/staff-service.js/
// ingredients-service.js (Architecture cleanup Phase 1) : ce module ne
// connaît rien de Notion directement, il reçoit { notion, ...dbIds } de
// l'appelant.
//
// "Dernier prix connu" = trié par Date décroissante, en ignorant toute
// ligne Statut_Matching="À valider" — un coût calculé sur un matching pas
// encore confirmé (ou un écart de prix pas encore confirmé, voir PR3)
// polluerait silencieusement une marge. Ne peut pas être une formule/rollup
// Notion natif : un rollup ne sait pas exprimer "trie par date, filtre par
// statut, prends la première ligne" — d'où cette fonction serveur.

const STATUTS_FIABLES = ['Auto-matché', 'Validé manuellement'];

function getSelectName(page, propName) {
  return page.properties?.[propName]?.select?.name || '';
}
function getNumberProp(page, propName) {
  const v = page.properties?.[propName]?.number;
  return typeof v === 'number' ? v : null;
}
function getDateProp(page, propName) {
  return page.properties?.[propName]?.date?.start || null;
}

/**
 * @param {string} ingredientId - page id dans Ingredients Master
 * @param {{prixIngredientsDbId: string, notion: {queryDatabase: Function}}} ctx
 * @returns {Promise<{ingredientId, prixUnitaire: number, date: string|null, priceLineId: string} | null>}
 */
async function getLastKnownPrice(ingredientId, { prixIngredientsDbId, notion }) {
  if (!ingredientId) return null;

  const pages = await notion.queryDatabase(
    prixIngredientsDbId,
    { property: 'Ingredient_Master', relation: { contains: ingredientId } },
    [{ property: 'Date', direction: 'descending' }],
    50
  );

  for (const page of pages) {
    if (!STATUTS_FIABLES.includes(getSelectName(page, 'Statut_Matching'))) continue;
    const prixUnitaire = getNumberProp(page, 'Prix_Unitaire');
    if (!prixUnitaire) continue;
    return { ingredientId, prixUnitaire, date: getDateProp(page, 'Date'), priceLineId: page.id };
  }
  return null;
}

/**
 * Coût d'une recette = somme, pour chaque ligne, de
 * (quantité × yieldFactor) × dernier prix unitaire connu de l'ingrédient —
 * même formule que consumption-service.js (rawConsumed) pour rester
 * cohérent avec le seul autre calcul de consommation déjà en place.
 *
 * @param {Array<{ingredientId: string, quantity: number, yieldFactor?: number}>} lines
 * @param {{prixIngredientsDbId: string, notion: {queryDatabase: Function}}} ctx
 * @returns {Promise<{totalCost: number, hasMissingPrices: boolean, lines: Array}>}
 */
async function computeRecipeCost(lines, { prixIngredientsDbId, notion }) {
  let totalCost = 0;
  let hasMissingPrices = false;

  const detail = await Promise.all((lines || []).map(async (line) => {
    const price = await getLastKnownPrice(line.ingredientId, { prixIngredientsDbId, notion });
    const quantiteConsommee = Number(line.quantity || 0) * Number(line.yieldFactor ?? 1);

    if (!price) {
      return { ingredientId: line.ingredientId, quantity: quantiteConsommee, prixUnitaire: null, cost: null, priceDate: null };
    }
    return {
      ingredientId: line.ingredientId,
      quantity: quantiteConsommee,
      prixUnitaire: price.prixUnitaire,
      cost: quantiteConsommee * price.prixUnitaire,
      priceDate: price.date,
    };
  }));

  for (const item of detail) {
    if (item.cost === null) hasMissingPrices = true;
    else totalCost += item.cost;
  }

  return { totalCost, hasMissingPrices, lines: detail };
}

module.exports = { getLastKnownPrice, computeRecipeCost };
