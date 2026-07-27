'use strict';

// Consolidated supplier-receiving operation (Architecture Ownership Audit,
// section 2/J). Replaces the client independently firing an unrelated
// `PATCH` (order status) and `POST` (stock update): this module is the one
// place that derives the idempotency key per line, applies each stock
// addition, and decides whether the order can be marked fully received.
//
// Notion has no multi-database transaction, so this is a recoverable saga,
// not an atomic operation: each line's stock addition is independently
// idempotent (via applyIdempotentStockAddition's own ledger), and the order
// is only ever marked "Reçu" once every line in the FINAL call succeeded. A
// retry — with any subset of previously-successful lines resent — cannot
// reapply them, because each carries the same deterministic key every time.

const { applyIdempotentStockAddition } = require('./apply-addition');
const { parseLedger, mergeLedgerByKey, serializeLedger } = require('./idempotency');

const ORDER_LEDGER_PROPERTY = 'Receiving_Ledger';
const RECEIVED_STATUS = 'Reçu';

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** Stable per-line identity, used even before a Stock row exists for it. */
function lineIdentity(line) {
  return line.stockId || `name:${normalizeName(line.name)}`;
}

function getOrderLedgerRaw(page) {
  const prop = page?.properties?.[ORDER_LEDGER_PROPERTY];
  if (prop?.type === 'rich_text' && prop.rich_text?.length) return prop.rich_text[0].plain_text || '';
  return '';
}

function ledgerProp(json) {
  return { rich_text: [{ text: { content: json } }] };
}

/**
 * @param {object} params
 * @param {string} params.orderId - Supplier Order (BESOINS) page id.
 * @param {Array<{stockId?:string, name:string, quantity:number, unite?:string, notionProductId?:string}>} params.lines
 * @param {boolean} [params.isFinal] - true on the last confirmed step of the receiving flow;
 *   the order is only ever advanced to "Reçu" on a call where this is true AND every line succeeded.
 * @param {string} params.stockDbId - DB.STOCK
 * @param {{getPage:Function, updatePage:Function, createPage:Function, resolveName:Function}} params.notion
 * @returns {Promise<{success:true, orderId:string, fullyReceived:boolean, lines:Array<object>}>}
 */
async function runSupplierReceivingSaga({ orderId, lines, isFinal, stockDbId, notion }) {
  if (!orderId) return { success: false, error: 'MISSING_ORDER_ID' };
  if (!Array.isArray(lines) || lines.length === 0) return { success: false, error: 'NO_LINES' };

  const results = [];
  for (const line of lines) {
    const idempotencyKey = `supplier-receipt:${orderId}:${lineIdentity(line)}`;
    const outcome = await applyIdempotentStockAddition({
      id: line.stockId || null,
      name: line.name,
      notionProductId: line.notionProductId || null,
      quantity: line.quantity,
      unite: line.unite,
      idempotencyKey,
      stockDbId,
      notion,
    });
    results.push({
      stockId: line.stockId || null,
      name: line.name,
      idempotencyKey,
      ...outcome,
    });
  }

  const allLinesOk = results.every((r) => r.status === 'applied' || r.status === 'already_applied');

  const orderPage = await notion.getPage(orderId);
  const existingLedger = parseLedger(getOrderLedgerRaw(orderPage));
  const mergedLedger = mergeLedgerByKey(
    existingLedger,
    results.map((r) => ({
      key: r.idempotencyKey,
      status: r.status,
      appliedAt: new Date().toISOString(),
    }))
  );

  const fullyReceived = Boolean(isFinal) && allLinesOk;
  const orderProperties = {
    [ORDER_LEDGER_PROPERTY]: ledgerProp(serializeLedger(mergedLedger)),
  };
  if (fullyReceived) {
    orderProperties['Statut'] = { select: { name: RECEIVED_STATUS } };
  }
  await notion.updatePage(orderId, orderProperties);

  return {
    success: true,
    orderId,
    fullyReceived,
    lines: results,
  };
}

module.exports = { runSupplierReceivingSaga, ORDER_LEDGER_PROPERTY, RECEIVED_STATUS };
