'use strict';

// Invoice-scan stock-confirmation safety (Architecture Ownership Audit,
// section 3). The OCR preview route (app/api/analyze-invoice) is unchanged
// and still writes nothing. This module backs the CONFIRM step only: it
// replaces the previous direct, untracked `POST /api/stock/update` calls
// with idempotent additions keyed by the server-recomputed invoice hash.
//
// Invoice scanning and supplier-order receiving are currently two
// ALTERNATIVE receipt origins for the same physical delivery — this PR does
// not attempt to auto-match one to the other (explicitly out of scope). If
// a caller already knows which supplier order an invoice belongs to (no UI
// surface does yet), passing `supplierOrderId` routes the confirmation
// through the canonical supplier-receiving saga instead, so the two origins
// can never independently credit the same delivery under different keys.

const { computeInvoiceHash } = require('./idempotency');
const { applyIdempotentStockAddition } = require('./apply-addition');
const { runSupplierReceivingSaga } = require('./supplier-receiving');

/**
 * @param {object} params
 * @param {string} params.base64 - the exact image bytes that were scanned; hashed server-side.
 * @param {Array<{stockId?:string, name:string, quantity:number, unite?:string, notionProductId?:string}>} params.items
 * @param {string} [params.supplierOrderId] - if the invoice is linked to a known supplier order.
 * @param {boolean} [params.isFinal] - forwarded to the saga when `supplierOrderId` is set.
 * @param {string} params.stockDbId - DB.STOCK
 * @param {{getPage:Function, updatePage:Function, createPage:Function, resolveName:Function}} params.notion
 */
async function confirmInvoiceReceipt({ base64, items, supplierOrderId, isFinal, stockDbId, notion }) {
  if (!base64) return { success: false, error: 'MISSING_IMAGE' };
  if (!Array.isArray(items) || items.length === 0) return { success: false, error: 'NO_ITEMS' };

  const invoiceHash = computeInvoiceHash(base64);

  if (supplierOrderId) {
    const saga = await runSupplierReceivingSaga({
      orderId: supplierOrderId,
      lines: items,
      isFinal,
      stockDbId,
      notion,
    });
    return { ...saga, invoiceHash, origin: 'supplier_order_linked' };
  }

  const results = [];
  for (const item of items) {
    const identity = item.stockId || `name:${String(item.name || '').trim().toLowerCase()}`;
    const idempotencyKey = `invoice-receipt:${invoiceHash}:${identity}`;
    const outcome = await applyIdempotentStockAddition({
      id: item.stockId || null,
      name: item.name,
      notionProductId: item.notionProductId || null,
      quantity: item.quantity,
      unite: item.unite,
      idempotencyKey,
      stockDbId,
      notion,
    });
    results.push({ stockId: item.stockId || null, name: item.name, idempotencyKey, ...outcome });
  }

  return { success: true, invoiceHash, origin: 'invoice_only', lines: results };
}

module.exports = { confirmInvoiceReceipt };
