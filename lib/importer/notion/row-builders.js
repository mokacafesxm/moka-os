'use strict';

/**
 * Transforms a parsed AddicTill statement into pilotage row objects
 * (PR4), ready for schema validation + upsert. Bank statements have no
 * corresponding pilotage table in this PR's approved 5-database list —
 * see docs/ARCHITECTURE.md "PR4" "Bank statements and the pilotage
 * schema" — so there is no `buildBankStatementRows`; a bank commit only
 * creates/updates its Import Run record.
 *
 * Money fields are converted from the parsers' internal integer-cents to
 * plain currency units here, at the Notion-write boundary only.
 */

const {
  dailyOperationsKey,
  paymentMethodKey,
  productSalesKey,
  salesCategoryKey,
  normalizeKey,
} = require('./business-keys');

/**
 * @param {number|null} cents
 * @returns {number|null}
 */
function centsToUnit(cents) {
  // Nullable so a null cents figure (scan-z's total_ht/ca_ttc — never
  // manufactured, see parsers/scanz-ocr.js) propagates through as null,
  // never silently coerced to 0 by Math.round(null).
  return cents === null || cents === undefined ? null : Math.round(cents) / 100;
}

/**
 * @param {import('../schemas').AddicTillDailySummary} statement
 * @param {{establishmentKey: string, sourceType: string, sourceSubtype: string}} context
 * @returns {{dailyOperations: import('../schemas').DailyOperationsRow[], paymentMethods: import('../schemas').PaymentMethodRow[]}}
 */
function buildDailySummaryRows(statement, { establishmentKey, sourceType, sourceSubtype }) {
  const dailyOperations = [];
  const paymentMethods = [];

  for (const day of statement.days) {
    dailyOperations.push({
      import_key: dailyOperationsKey({ establishmentKey, date: day.date, sourceType }),
      establishment_key: establishmentKey,
      date: day.date,
      source_type: sourceType,
      source_subtype: sourceSubtype,
      ticket_count: day.ticket_count,
      total_ttc: centsToUnit(day.total_ttc_cents),
      total_ht: centsToUnit(day.total_ht_cents),
      ca_ttc: centsToUnit(day.ca_ttc_cents),
      clients: day.clients_count,
    });

    for (const payment of day.payments) {
      paymentMethods.push({
        import_key: paymentMethodKey({
          establishmentKey,
          date: day.date,
          paymentMethod: payment.method,
          sourceType,
        }),
        establishment_key: establishmentKey,
        date: day.date,
        source_type: sourceType,
        source_subtype: sourceSubtype,
        payment_method: normalizeKey(payment.method),
        quantity: payment.quantity,
        amount: centsToUnit(payment.total_cents),
      });
    }
  }

  return { dailyOperations, paymentMethods };
}

/**
 * @param {import('../schemas').AddicTillProductRanking} statement
 * @param {{establishmentKey: string}} context
 * @returns {{productSales: import('../schemas').ProductSalesRow[], salesCategories: import('../schemas').SalesCategoryRow[]}}
 */
function buildProductRankingRows(statement, { establishmentKey }) {
  const periodStart = statement.period_start;
  const periodEnd = statement.period_end;

  const productSales = statement.products.map((product) => ({
    import_key: productSalesKey({
      establishmentKey,
      periodStart,
      periodEnd,
      addictillProductKey: product.product_name,
    }),
    establishment_key: establishmentKey,
    period_start: periodStart,
    period_end: periodEnd,
    addictill_product_key: normalizeKey(product.product_name),
    product_name_raw: product.product_name,
    category_name: product.category_name,
    quantity: product.quantity,
    revenue_ttc: centsToUnit(product.revenue_ttc_cents),
    revenue_ht: centsToUnit(product.revenue_ht_cents),
    complimentary_qty: product.complimentary_qty,
    discounts_raw: product.discounts_raw,
    discounts_value: product.discounts_value,
    unit_price: product.unit_price_cents !== null ? centsToUnit(product.unit_price_cents) : null,
    last_sale_at: product.last_sale_at,
    mapping_status: product.mapping_status,
    moka_product_key: product.moka_product_key,
  }));

  const salesCategories = statement.category_subtotals.map((subtotal) => ({
    import_key: salesCategoryKey({
      establishmentKey,
      periodStart,
      periodEnd,
      categoryKey: subtotal.category_name,
    }),
    establishment_key: establishmentKey,
    period_start: periodStart,
    period_end: periodEnd,
    category_key: normalizeKey(subtotal.category_name),
    category_name_raw: subtotal.category_name,
    quantity: subtotal.quantity,
    revenue_ttc: centsToUnit(subtotal.revenue_ttc_cents),
    revenue_ht: centsToUnit(subtotal.revenue_ht_cents),
    complimentary_qty: subtotal.complimentary_qty,
  }));

  return { productSales, salesCategories };
}

module.exports = { centsToUnit, buildDailySummaryRows, buildProductRankingRows };
