'use strict';

// Core logic behind POST /api/stock/update, extracted so it can be unit
// tested against an injected fake Notion client (no live calls) and so the
// idempotency requirement lives in one place rather than duplicated across
// call sites. `mode: "replace"` (manual physical-count / full recount)
// keeps its pre-existing overwrite behavior verbatim and is NOT
// idempotency-guarded — this is an intentional, explicit human action, not
// a repeatable delta (Architecture Ownership Audit, section 1: "preserve
// existing replace/manual-count behavior for now").

const { applyIdempotentStockAddition } = require('./apply-addition');

const ADDITIVE_MODES = new Set(['add', 'upsert']);

/**
 * @param {object} params
 * @param {string|null} [params.id]
 * @param {string} [params.name]
 * @param {string|null} [params.notionProductId]
 * @param {number} params.poidsTotal
 * @param {string} [params.unite]
 * @param {string} [params.mode] - "add" | "upsert" (additive, idempotency-guarded) or anything else (replace/overwrite, unguarded).
 * @param {string} [params.idempotencyKey] - required when mode is additive.
 * @param {string} params.stockDbId - DB.STOCK
 * @param {{getPage:Function, updatePage:Function, createPage:Function, resolveName:Function}} params.notion
 */
async function handleStockUpdate({ id, name, notionProductId, poidsTotal, unite, mode, idempotencyKey, stockDbId, notion }) {
  const isAdditive = ADDITIVE_MODES.has(mode);

  if (isAdditive) {
    const outcome = await applyIdempotentStockAddition({
      id: id || null,
      name,
      notionProductId,
      quantity: poidsTotal,
      unite,
      idempotencyKey,
      stockDbId,
      notion,
    });
    if (outcome.status === 'rejected') {
      return { success: false, error: outcome.reason, status: 'rejected' };
    }
    return {
      success: true,
      newQuantity: outcome.newQuantity,
      action: outcome.status === 'already_applied' ? 'noop' : 'update',
      status: outcome.status,
      id: outcome.id,
    };
  }

  // Unguarded replace/manual-count path — unchanged from the pre-patch behavior.
  const quantity = Number(poidsTotal) || 0;
  let targetId = id || null;
  if (!targetId && name) {
    targetId = await notion.resolveName(stockDbId, 'Produit', String(name).trim());
  }

  if (targetId) {
    const properties = { Quantite_stock: { number: quantity } };
    if (unite) properties.Unite_stock = { select: { name: String(unite) } };
    await notion.updatePage(targetId, properties);
    return { success: true, newQuantity: quantity, action: 'update', status: 'applied', id: targetId };
  }

  if (!name) return { success: false, error: 'id or name required', status: 'rejected' };

  const properties = {
    Produit: { title: [{ text: { content: String(name).trim() } }] },
    Quantite_stock: { number: quantity },
  };
  if (unite) properties.Unite_stock = { select: { name: String(unite) } };
  if (notionProductId) properties.MOKA_Ingredients_Master = { relation: [{ id: notionProductId }] };

  const page = await notion.createPage(stockDbId, properties);
  return { success: true, newQuantity: quantity, action: 'create', status: 'applied', id: page.id };
}

module.exports = { handleStockUpdate, ADDITIVE_MODES };
