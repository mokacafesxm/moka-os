'use strict';

// Single idempotent primitive for every additive Current Stock mutation
// (supplier receiving, invoice-scan confirmation, manual quick receipt).
// Consolidates what was previously three independent inline implementations
// of "add a delta to Quantite_stock" (Architecture Ownership Audit, finding
// H-1/Critical). `replace`/manual-count behavior is untouched and does not
// go through this module at all.
//
// Row bootstrap ("what if there's no Stock row for this ingredient yet") is
// deliberately NOT implemented here — it delegates to
// lib/stock/ensure-stock-row.js, the one shared "ensure a Stock row exists"
// primitive (Architecture cleanup Phase 1). This module's only job is
// applying an idempotent quantity delta to a row that is known to exist.

const {
  validateIdempotencyKey,
  hashLedgerKey,
  parseKeyFingerprints,
  serializeKeyFingerprints,
} = require('./idempotency');
const { ensureStockRowForIngredient } = require('./ensure-stock-row');

const LEDGER_PROPERTY = 'Applied_Receipts_Ledger';

// In-process serialization per stock target. This closes the race window
// for two requests landing on the SAME warm serverless instance (the common
// case for a double-tap or a fast client-side retry). It is NOT a substitute
// for the idempotency key and does not protect against two cold-started
// instances reading the ledger at the exact same instant — Notion's classic
// API has no compare-and-swap/transactions, so that residual window cannot
// be fully closed without external locking infrastructure. Documented in
// docs/ARCHITECTURE.md "Stock safety patch".
const locks = new Map();
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    key,
    next.then(
      () => {},
      () => {}
    )
  );
  return next;
}

function getLedgerRaw(page) {
  const prop = page?.properties?.[LEDGER_PROPERTY];
  if (prop?.type === 'rich_text' && prop.rich_text?.length) return prop.rich_text[0].plain_text || '';
  return '';
}

function getQuantity(page) {
  const prop = page?.properties?.['Quantite_stock'];
  if (prop?.type === 'number' && typeof prop.number === 'number') return prop.number;
  return 0;
}

function ledgerProp(json) {
  return { rich_text: [{ text: { content: json } }] };
}

/**
 * @param {object} params
 * @param {string|null} params.id - existing Stock page id, if known.
 * @param {string} [params.name] - product name, used to resolve/create when `id` is absent.
 * @param {string|null} [params.notionProductId] - Ingredients-catalog page id to link on create.
 * @param {number} params.quantity - amount to add (must be > 0).
 * @param {string} [params.unite]
 * @param {string} params.idempotencyKey - required; see lib/stock/idempotency.js formats.
 * @param {string} params.stockDbId - Stock database id (DB.STOCK from app/api/_notion.js).
 * @param {{getPage:Function, updatePage:Function, createPage:Function, queryDatabase:Function}} params.notion
 *   Injected Notion client — the real app/api/_notion.js functions in production routes,
 *   an in-memory fake in tests. This module never imports Notion or fetch directly.
 *   `queryDatabase` is required only for the ensureStockRowForIngredient bootstrap path.
 * @returns {Promise<{status:'applied'|'already_applied'|'rejected', newQuantity?:number, id?:string, reason?:string}>}
 */
async function applyIdempotentStockAddition({
  id,
  name,
  notionProductId,
  quantity,
  unite,
  idempotencyKey,
  stockDbId,
  notion,
}) {
  const keyCheck = validateIdempotencyKey(idempotencyKey);
  if (!keyCheck.valid) return { status: 'rejected', reason: `INVALID_IDEMPOTENCY_KEY:${keyCheck.reason}` };

  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
    return { status: 'rejected', reason: 'INVALID_QUANTITY' };
  }

  const trimmedName = String(name || '').trim();
  if (!id && !trimmedName) return { status: 'rejected', reason: 'MISSING_TARGET' };
  if (!stockDbId) return { status: 'rejected', reason: 'MISSING_STOCK_DB_ID' };

  // Row bootstrap happens BEFORE the per-target lock below, guarded by its
  // own lock inside ensureStockRowForIngredient (keyed by ingredient, not by
  // Stock-row id — the row doesn't exist yet). Two concurrent callers for a
  // brand-new ingredient both resolve to the SAME newly-created row id.
  let targetId = id || null;
  if (!targetId) {
    const ensured = await ensureStockRowForIngredient({
      ingredientId: notionProductId || null,
      ingredientName: trimmedName,
      uniteStock: unite,
      stockDbId,
      notion,
    });
    targetId = ensured.id;
  }

  const fingerprint = hashLedgerKey(idempotencyKey);

  return withLock(targetId, async () => {
    const page = await notion.getPage(targetId);
    const fingerprints = parseKeyFingerprints(getLedgerRaw(page));
    const current = getQuantity(page);

    if (fingerprints.includes(fingerprint)) {
      // Already applied. We deliberately do NOT try to recall the exact
      // historical resultingQuantity (that would need a full entry per
      // receipt, which is what caused the truncation bug this fix
      // addresses) — reporting the current live quantity is honest and
      // sufficient: the caller's real question is "did this get applied",
      // not "what was the running total three receipts ago".
      return { status: 'already_applied', newQuantity: current, id: targetId };
    }

    const newQuantity = current + numericQuantity;
    const newFingerprints = [...fingerprints, fingerprint];

    const properties = {
      Quantite_stock: { number: newQuantity },
      [LEDGER_PROPERTY]: ledgerProp(serializeKeyFingerprints(newFingerprints)),
    };
    if (unite) properties.Unite_stock = { select: { name: String(unite) } };

    await notion.updatePage(targetId, properties);
    return { status: 'applied', newQuantity, id: targetId };
  });
}

module.exports = { applyIdempotentStockAddition, LEDGER_PROPERTY };
