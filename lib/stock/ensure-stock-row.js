'use strict';

// Canonical "ensure a Stock row exists for this Ingredient" primitive —
// Architecture cleanup Phase 1. Before this module existed, this same
// bootstrap logic was implemented three times independently: inline at
// ingredient-creation time (app/api/settings/products), in a page-load-
// triggered backfill sweep (app/api/admin/sync-stock), and as a name-based
// create-fallback inside the additive stock-update path
// (lib/stock/apply-addition.js). Only admin/sync-stock's existence check
// covered every row (via the MOKA_Ingredients_Master relation); the others
// could, in principle, create a second row for an ingredient not yet linked
// by relation but already present by name. This module checks BOTH.
//
// Deliberately separate from lib/stock/apply-addition.js (stock RECEIPT
// logic): this module only ever creates a row at quantity 0 and never
// touches Quantite_stock on an existing row — "ensure it exists" and "add a
// received quantity" are two different operations and must not be conflated
// (per the architecture cleanup's explicit requirement).

const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(key, next.then(() => {}, () => {}));
  return next;
}

function getRelationIds(page, propName) {
  const prop = page?.properties?.[propName];
  return prop?.type === 'relation' && prop.relation?.length ? prop.relation.map((r) => r.id) : [];
}

function getTitleText(page, propName) {
  const prop = page?.properties?.[propName];
  return prop?.type === 'title' && prop.title?.length ? prop.title[0].plain_text || '' : '';
}

/**
 * Finds an existing Stock row for an ingredient, by relation first (fast,
 * unambiguous) and by exact Produit-name match as a fallback (covers legacy
 * rows never linked via relation) — this fallback is what admin/sync-stock's
 * original relation-only check was missing, a latent duplicate-row risk this
 * consolidation also fixes.
 */
async function findExistingStockRow(ingredientId, ingredientName, { stockDbId, notion }) {
  const pages = await notion.queryDatabase(stockDbId, null, null, 300);
  if (ingredientId) {
    const byRelation = pages.find((p) => getRelationIds(p, 'MOKA_Ingredients_Master').includes(ingredientId));
    if (byRelation) return byRelation.id;
  }
  if (ingredientName) {
    const clean = String(ingredientName).trim().toLowerCase();
    const byName = pages.find((p) => getTitleText(p, 'Produit').trim().toLowerCase() === clean);
    if (byName) return byName.id;
  }
  return null;
}

/**
 * @param {object} params
 * @param {string|null} [params.ingredientId] - Ingredients-catalog page id
 * @param {string} params.ingredientName
 * @param {string} [params.uniteStock]
 * @param {string} params.stockDbId
 * @param {{queryDatabase:Function, createPage:Function}} params.notion
 * @returns {Promise<{created:boolean, id:string}>}
 */
async function ensureStockRowForIngredient({ ingredientId, ingredientName, uniteStock, stockDbId, notion }) {
  const name = String(ingredientName || '').trim();
  if (!ingredientId && !name) throw new Error('ensureStockRowForIngredient: ingredientId or ingredientName required');
  if (!stockDbId) throw new Error('ensureStockRowForIngredient: stockDbId required');

  const lockKey = `ingredient:${ingredientId || name.toLowerCase()}`;
  return withLock(lockKey, async () => {
    const existingId = await findExistingStockRow(ingredientId, name, { stockDbId, notion });
    if (existingId) return { created: false, id: existingId };

    const properties = {
      Produit: { title: [{ text: { content: name } }] },
      Quantite_stock: { number: 0 },
    };
    if (uniteStock) properties.Unite_stock = { select: { name: String(uniteStock) } };
    if (ingredientId) properties.MOKA_Ingredients_Master = { relation: [{ id: ingredientId }] };

    const page = await notion.createPage(stockDbId, properties);
    return { created: true, id: page.id };
  });
}

module.exports = { ensureStockRowForIngredient, findExistingStockRow };
