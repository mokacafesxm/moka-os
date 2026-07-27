'use strict';

/**
 * Deterministic business (import_key) builders for the 4 pilotage tables
 * (PR4) — sha256 of a composite string, never a random UUID, so re-running
 * the same logical row always resolves to the same Notion page (safe
 * upsert / safe retry after a partial failure). See docs/ARCHITECTURE.md
 * "PR4" for the exact key definitions.
 */

const { createHash } = require('node:crypto');

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeKey(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * @param {string[]} parts
 * @returns {string} sha256 hex digest
 */
function hashKey(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/** @param {{establishmentKey: string, date: string, sourceType: string}} params */
function dailyOperationsKey({ establishmentKey, date, sourceType }) {
  return hashKey([normalizeKey(establishmentKey), date, sourceType]);
}

/** @param {{establishmentKey: string, date: string, paymentMethod: string, sourceType: string}} params */
function paymentMethodKey({ establishmentKey, date, paymentMethod, sourceType }) {
  return hashKey([normalizeKey(establishmentKey), date, normalizeKey(paymentMethod), sourceType]);
}

/** @param {{establishmentKey: string, periodStart: string|null, periodEnd: string|null, addictillProductKey: string}} params */
function productSalesKey({ establishmentKey, periodStart, periodEnd, addictillProductKey }) {
  return hashKey([
    normalizeKey(establishmentKey),
    periodStart ?? '',
    periodEnd ?? '',
    normalizeKey(addictillProductKey),
  ]);
}

/** @param {{establishmentKey: string, periodStart: string|null, periodEnd: string|null, categoryKey: string}} params */
function salesCategoryKey({ establishmentKey, periodStart, periodEnd, categoryKey }) {
  return hashKey([normalizeKey(establishmentKey), periodStart ?? '', periodEnd ?? '', normalizeKey(categoryKey)]);
}

module.exports = {
  normalizeKey,
  hashKey,
  dailyOperationsKey,
  paymentMethodKey,
  productSalesKey,
  salesCategoryKey,
};
