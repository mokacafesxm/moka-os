'use strict';

/**
 * AddicTill POS export parser (PR3) — two report sub-types, detected by
 * signature (same registry-of-adapters shape as classify.js's POS
 * distinction and bank-statement.js's BANK_PROFILES):
 *
 *  - `daily_summary` ("Synthèse quotidienne"): one row per day over a
 *    period, plus a totals row. Header spans two rows: row 1 has sparse
 *    section labels ("Modes de ventes", "Encaissements", "Taxes",
 *    "Vendeurs") that only appear once per merged group; row 2 already
 *    carries the FULLY QUALIFIED column name per cell (e.g. "A EMPORTER /
 *    Total TTC"). Confirmed against 2 real exports: the column ORDER
 *    inside "Encaissements" differs between them (ESPECES before CARTE
 *    BANCAIRE in one, the reverse in the other) — every column is
 *    therefore mapped by header text, never by position. The set of
 *    payment methods / tax rates / vendors is itself dynamic (depends on
 *    which staff worked, which tax rates applied that period) — parsed by
 *    grouping columns under their row-1 section rather than a fixed list.
 *
 *  - `product_ranking` ("Palmarès produits"): two sheets, "Produits" (flat,
 *    one row per product, used as the primary source) and "Rubriques"
 *    (grouped by category with per-category + grand-total subtotal rows,
 *    used only to cross-check the totals recomputed from "Produits").
 *    Confirmed against a real export: the file never encodes its own
 *    reporting period (only a per-product "Dernière vente" timestamp,
 *    spanning several months) — the period is therefore never inferred,
 *    only accepted as an explicit override or left 'unknown'.
 *
 * Validation thresholds below (which cross-checks are hard errors vs.
 * warnings) were verified empirically against the 2 real daily-summary
 * exports before being encoded — see docs/ARCHITECTURE.md "PR3".
 */

const {
  ValidationResultSchema,
  AddicTillDailySummarySchema,
  AddicTillProductRankingSchema,
  CURRENCIES,
} = require('../schemas');
const { loadProductMappings, annotateProductsWithMapping } = require('./recipe-mapping');

const DEFAULT_CURRENCY = CURRENCIES.includes(process.env.ADDICTILL_DEFAULT_CURRENCY)
  ? process.env.ADDICTILL_DEFAULT_CURRENCY
  : 'EUR';

// Bumped independently of IMPORTER_VERSION (lib/importer/schemas.js) and of
// bank-statement.js's own PARSER_VERSION — recorded on every Import Run
// (PR4 audit-trail addendum) so a future change to this parser (either
// report sub-type) stays traceable to exactly which documents it touched.
const PARSER_VERSION = 'addictill-v1.0.0';

/**
 * @param {*} cell
 * @returns {string}
 */
function headerText(cell) {
  return cell === null || cell === undefined ? '' : String(cell).trim();
}

/**
 * @param {*} raw
 * @returns {number} 0 for blank/non-numeric — additive KPI columns on a
 * POS daily summary are unambiguously zero when blank (e.g. no "TROP
 * PERÇU" correction that day), unlike a genuinely-unknown value.
 */
function toCents(raw) {
  return typeof raw === 'number' ? Math.round(raw * 100) : 0;
}

/** @param {*} raw @returns {number|null} */
function toCentsOrNull(raw) {
  return typeof raw === 'number' ? Math.round(raw * 100) : null;
}

/** @param {*} raw @returns {number} */
function toInt(raw) {
  return typeof raw === 'number' ? Math.round(raw) : 0;
}

/** @param {*} raw @returns {number|null} */
function toIntOrNull(raw) {
  return typeof raw === 'number' ? Math.round(raw) : null;
}

/** @param {*} raw @returns {number|null} */
function toFloatOrNull(raw) {
  return typeof raw === 'number' ? raw : null;
}

/**
 * @param {*} raw
 * @returns {string|null} ISO YYYY-MM-DD, or null if unparseable
 */
function parseDateCell(raw) {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
    if (match) return match[1];
  }
  return null;
}

/**
 * @param {*} raw
 * @returns {string|null} ISO datetime, or null if unparseable
 */
function parseDateTimeCell(raw) {
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(raw.trim());
    if (match) {
      const [, y, mo, d, h, mi, s] = match;
      return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
    }
    const dateOnly = parseDateCell(raw);
    if (dateOnly) return `${dateOnly}T00:00:00.000Z`;
  }
  return null;
}

/**
 * Detects which AddicTill report this extraction is, from sheet
 * names/content — never guessed silently: returns null if neither
 * signature matches.
 * @param {import('../schemas').ExtractionResult} extraction
 * @returns {'daily_summary'|'product_ranking'|null}
 */
function detectAddicTillReportType(extraction) {
  if (!extraction.sheets || extraction.sheets.length === 0) return null;

  const hasProduitsSheet = extraction.sheets.some((s) => s.name === 'Produits');
  const hasRubriquesSheet = extraction.sheets.some((s) => s.name === 'Rubriques');
  if (hasProduitsSheet && hasRubriquesSheet) return 'product_ranking';

  const firstSheet = extraction.sheets[0];
  const firstCell = firstSheet.rows[0]?.[0];
  if (headerText(firstCell).toLowerCase().includes('synthese quotidienne')) return 'daily_summary';

  return null;
}

/**
 * Forward-fills row 1's sparse section labels (merged cells only carry
 * text in their first column) across the columns they visually span.
 * Iterates over `length` (row 2's column count), NOT row 1's own array
 * length — ExcelJS trims a row's array to its last non-empty cell, and
 * row 1's last section label ("Vendeurs") rarely sits in row 2's last
 * column, so row 1 is reliably *shorter* than row 2. Stopping at row 1's
 * length would leave the last section's trailing columns as `undefined`
 * instead of forward-filled, which then get misread as top-level columns
 * and silently overwrite real top-level fields (confirmed: this exact bug
 * zeroed out `ticket_count`/`total_ttc_cents` on every row before the fix).
 * @param {*[]} row1
 * @param {number} length
 * @returns {(string|null)[]}
 */
function forwardFillSections(row1, length) {
  const sections = [];
  let current = null;
  for (let i = 0; i < length; i += 1) {
    const text = headerText(row1[i]);
    if (text) current = text;
    sections.push(current);
  }
  return sections;
}

/**
 * Builds a column descriptor per index from the two header rows. Row 2's
 * cell text is already fully qualified ("GROUP / SUBLABEL") for grouped
 * columns — row 1 is only needed to know which *section*
 * (Modes de ventes/Encaissements/Taxes/Vendeurs) a group belongs to, since
 * "A EMPORTER / Total TTC" and "MOKA GUILLAUME / Total TTC" share the same
 * sub-label shape and are only distinguishable by section.
 * @param {*[]} row1
 * @param {*[]} row2
 * @returns {Array<{index: number, section: string|null, group: string|null, subLabel: string}>}
 */
function parseHeaderColumns(row1, row2) {
  const sections = forwardFillSections(row1, row2.length);
  return row2.map((cell, index) => {
    const fullLabel = headerText(cell);
    const section = sections[index];
    const separatorIndex = fullLabel.indexOf(' / ');
    if (separatorIndex === -1) {
      return { index, section: null, group: null, subLabel: fullLabel };
    }
    return {
      index,
      section,
      group: fullLabel.slice(0, separatorIndex),
      subLabel: fullLabel.slice(separatorIndex + 3),
    };
  });
}

/**
 * Parses one data row of the daily summary into its totals shape (shared
 * between a day row and the printed total row).
 * @param {*[]} row
 * @param {ReturnType<typeof parseHeaderColumns>} columns
 * @returns {{date: string|null, hasAnyData: boolean, totals: import('../schemas').AddicTillDayTotals}}
 */
function parseDailyRow(row, columns) {
  let date = null;
  let ticket_count = 0;
  let avg_ticket_ttc_cents = null;
  let avg_ticket_ht_cents = null;
  let total_ttc_cents = 0;
  let total_ht_cents = 0;
  let ca_ttc_cents = 0;
  let clients_count = null;
  let hasAnyData = false;

  const modeMap = new Map();
  const paymentMap = new Map();
  const taxMap = new Map();
  const vendorMap = new Map();

  for (const col of columns) {
    const raw = row[col.index];
    if (raw !== undefined && raw !== null && raw !== '') hasAnyData = true;

    if (!col.section) {
      switch (col.subLabel) {
        case 'Date':
          date = parseDateCell(raw);
          break;
        case 'Nombre de tickets':
          ticket_count = toInt(raw);
          break;
        case 'Moyenne tickets TTC':
          avg_ticket_ttc_cents = toCentsOrNull(raw);
          break;
        case 'Moyenne tickets HT':
          avg_ticket_ht_cents = toCentsOrNull(raw);
          break;
        case 'Total TTC':
          total_ttc_cents = toCents(raw);
          break;
        case 'Total HT':
          total_ht_cents = toCents(raw);
          break;
        case 'CA TTC':
          ca_ttc_cents = toCents(raw);
          break;
        case 'Clients':
          clients_count = toIntOrNull(raw);
          break;
        default:
        // Unrecognized top-level column: never invented a mapping for it,
        // simply not represented in the normalized output.
      }
      continue;
    }

    if (col.section === 'Modes de ventes') {
      const entry = modeMap.get(col.group) ?? { mode: col.group, total_ttc_cents: 0, ticket_count: 0 };
      if (col.subLabel === 'Total TTC') entry.total_ttc_cents = toCents(raw);
      if (col.subLabel === 'Nombre de tickets') entry.ticket_count = toInt(raw);
      modeMap.set(col.group, entry);
    } else if (col.section === 'Encaissements') {
      const entry = paymentMap.get(col.group) ?? { method: col.group, quantity: 0, total_cents: 0 };
      if (col.subLabel === 'Quantité') entry.quantity = toInt(raw);
      if (col.subLabel === 'Total') entry.total_cents = toCents(raw);
      paymentMap.set(col.group, entry);
    } else if (col.section === 'Taxes') {
      const entry =
        taxMap.get(col.group) ?? { label: col.group, total_ttc_cents: 0, total_ht_cents: 0, tax_cents: 0 };
      if (col.subLabel === 'Total TTC') entry.total_ttc_cents = toCents(raw);
      if (col.subLabel === 'Total HT') entry.total_ht_cents = toCents(raw);
      if (col.subLabel === 'Taxe') entry.tax_cents = toCents(raw);
      taxMap.set(col.group, entry);
    } else if (col.section === 'Vendeurs') {
      const entry = vendorMap.get(col.group) ?? { name: col.group, total_ttc_cents: 0, ticket_count: 0 };
      if (col.subLabel === 'Total TTC') entry.total_ttc_cents = toCents(raw);
      if (col.subLabel === 'Nombre de tickets') entry.ticket_count = toInt(raw);
      vendorMap.set(col.group, entry);
    }
  }

  return {
    date,
    hasAnyData,
    totals: {
      ticket_count,
      avg_ticket_ttc_cents,
      avg_ticket_ht_cents,
      total_ttc_cents,
      total_ht_cents,
      ca_ttc_cents,
      clients_count,
      sales_by_mode: Array.from(modeMap.values()),
      payments: Array.from(paymentMap.values()),
      taxes: Array.from(taxMap.values()),
      vendors: Array.from(vendorMap.values()),
    },
  };
}

/**
 * @param {import('../schemas').ExtractionResult} extraction
 * @returns {{statement: import('../schemas').AddicTillDailySummary, validation: import('../schemas').ValidationResult}}
 */
function parseDailySummary(extraction) {
  const sheet = extraction.sheets[0];
  const row1 = sheet.rows[0] ?? [];
  const row2 = sheet.rows[1] ?? [];
  const columns = parseHeaderColumns(row1, row2);

  const days = [];
  let printedTotal = null;
  const warnings = [];

  sheet.rows.slice(2).forEach((row, offset) => {
    const sourceRow = offset + 3;
    const parsed = parseDailyRow(row, columns);
    if (parsed.date === null) {
      if (!parsed.hasAnyData) return; // genuinely blank row, not a total row
      if (printedTotal) {
        warnings.push(
          `Plusieurs lignes de total détectées, seule la dernière (ligne ${sourceRow}) est retenue.`
        );
      }
      printedTotal = parsed.totals;
      return;
    }
    days.push({ ...parsed.totals, date: parsed.date, source_row: sourceRow });
  });

  const periodStart = days.length > 0 ? days[0].date : null;
  const periodEnd = days.length > 0 ? days[days.length - 1].date : null;

  const statement = AddicTillDailySummarySchema.parse({
    source_type: 'addictill_daily_summary',
    period_start: periodStart,
    period_end: periodEnd,
    currency: DEFAULT_CURRENCY,
    days,
    printed_total: printedTotal,
  });

  const validation = ValidationResultSchema.parse(validateDailySummary(statement, warnings));
  return { statement, validation };
}

/**
 * Sums a dynamic array field (sales_by_mode/payments/taxes/vendors) across
 * all `days`, grouped by its key, so the aggregate can be compared against
 * `printed_total`'s own array even when different days have different
 * modes/vendors present.
 * @param {import('../schemas').AddicTillDayRow[]} days
 * @param {'sales_by_mode'|'payments'|'taxes'|'vendors'} field
 * @param {string} keyProp
 * @param {string} valueProp
 * @returns {Map<string, number>}
 */
function sumGroupedField(days, field, keyProp, valueProp) {
  const totals = new Map();
  for (const day of days) {
    for (const entry of day[field]) {
      const key = entry[keyProp];
      totals.set(key, (totals.get(key) ?? 0) + entry[valueProp]);
    }
  }
  return totals;
}

/**
 * Compares a recomputed grouped-field map against the printed total's own
 * array for the same field, returning mismatch descriptions.
 */
function compareGroupedTotals(recomputed, printedEntries, keyProp, valueProp, label) {
  const errors = [];
  const printedMap = new Map(printedEntries.map((e) => [e[keyProp], e[valueProp]]));
  const allKeys = new Set([...recomputed.keys(), ...printedMap.keys()]);
  for (const key of allKeys) {
    const recomputedValue = recomputed.get(key) ?? 0;
    const printedValue = printedMap.get(key) ?? 0;
    if (recomputedValue !== printedValue) {
      errors.push(
        `TOTAL_MISMATCH: ${label} "${key}" recalculé (${recomputedValue}) ≠ ligne de total affichée (${printedValue})`
      );
    }
  }
  return errors;
}

/**
 * @param {import('../schemas').AddicTillDailySummary} statement
 * @param {string[]} parseWarnings
 * @returns {import('../schemas').ValidationResult}
 */
function validateDailySummary(statement, parseWarnings = []) {
  const errors = [];
  const warnings = [...parseWarnings];

  if (!statement.printed_total) {
    errors.push('VALIDATION_ERROR: ligne de total introuvable dans la synthèse quotidienne');
  }

  for (const day of statement.days) {
    const modesSum = day.sales_by_mode.reduce((sum, m) => sum + m.total_ttc_cents, 0);
    if (modesSum !== day.total_ttc_cents) {
      errors.push(
        `TOTAL_MISMATCH: ${day.date} — somme des modes de vente (${modesSum}) ≠ Total TTC (${day.total_ttc_cents})`
      );
    }

    const taxSum = day.taxes.reduce((sum, t) => sum + t.tax_cents, 0);
    if (day.total_ht_cents + taxSum !== day.total_ttc_cents) {
      errors.push(
        `TOTAL_MISMATCH: ${day.date} — Total HT + taxes (${day.total_ht_cents + taxSum}) ≠ Total TTC (${day.total_ttc_cents})`
      );
    }

    // Payments and vendor sums are informational only: verified against 2
    // real exports, neither reliably sums to Total TTC (payments in ~50%
    // of rows in one file, vendors in ~20% — likely TROP PERÇU/CB MANUEL
    // reconciliation semantics or partial vendor attribution not captured
    // by this export). Never treated as a hard error — see
    // docs/ARCHITECTURE.md "PR3".
    const paymentsSum = day.payments.reduce((sum, p) => sum + p.total_cents, 0);
    if (paymentsSum !== day.total_ttc_cents) {
      warnings.push(
        `${day.date} — somme des encaissements (${paymentsSum}) ≠ Total TTC (${day.total_ttc_cents}), écart non bloquant (voir docs/ARCHITECTURE.md "PR3")`
      );
    }
    const vendorsSum = day.vendors.reduce((sum, v) => sum + v.total_ttc_cents, 0);
    if (day.vendors.length > 0 && vendorsSum !== day.total_ttc_cents) {
      warnings.push(
        `${day.date} — somme des vendeurs (${vendorsSum}) ≠ Total TTC (${day.total_ttc_cents}), écart non bloquant (voir docs/ARCHITECTURE.md "PR3")`
      );
    }
  }

  if (statement.printed_total) {
    const additiveFields = [
      ['ticket_count', (d) => d.ticket_count],
      ['total_ttc_cents', (d) => d.total_ttc_cents],
      ['total_ht_cents', (d) => d.total_ht_cents],
      ['ca_ttc_cents', (d) => d.ca_ttc_cents],
    ];
    for (const [label, getValue] of additiveFields) {
      const recomputed = statement.days.reduce((sum, d) => sum + getValue(d), 0);
      const printed = getValue(statement.printed_total);
      if (recomputed !== printed) {
        errors.push(`TOTAL_MISMATCH: somme des jours pour "${label}" (${recomputed}) ≠ ligne de total (${printed})`);
      }
    }

    errors.push(
      ...compareGroupedTotals(
        sumGroupedField(statement.days, 'sales_by_mode', 'mode', 'total_ttc_cents'),
        statement.printed_total.sales_by_mode,
        'mode',
        'total_ttc_cents',
        'mode de vente'
      )
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Parses category-subtotal and grand-total rows from the "Rubriques"
 * sheet, used only for cross-validation against "Produits".
 * @param {{rows: *[][]}} sheet
 */
function parseRubriquesSubtotals(sheet) {
  const header = (sheet.rows[0] ?? []).map(headerText);
  const idx = (name) => header.indexOf(name);
  const quantiteIdx = idx('Quantité');
  const caTtcIdx = idx('CA TTC');
  const caHtIdx = idx('CA HT');
  const offertsIdx = idx('Offerts');

  const categorySubtotals = [];
  let grandTotal = null;

  for (const row of sheet.rows.slice(1)) {
    const firstCell = headerText(row[0]);
    if (!firstCell || !firstCell.startsWith('Total')) continue;
    const totals = {
      quantity: toInt(row[quantiteIdx]),
      revenue_ttc_cents: toCents(row[caTtcIdx]),
      revenue_ht_cents: toCents(row[caHtIdx]),
      complimentary_qty: toInt(row[offertsIdx]),
    };
    if (firstCell === 'Total général') {
      grandTotal = totals;
    } else if (firstCell.startsWith('Total ')) {
      categorySubtotals.push({ category_name: firstCell.slice('Total '.length), ...totals });
    }
  }

  return { categorySubtotals, grandTotal };
}

/**
 * @param {import('../schemas').ExtractionResult} extraction
 * @param {{periodStart?: string, periodEnd?: string}} [options]
 * @returns {{statement: import('../schemas').AddicTillProductRanking, validation: import('../schemas').ValidationResult}}
 */
function parseProductRanking(extraction, options = {}) {
  const produitsSheet = extraction.sheets.find((s) => s.name === 'Produits');
  const rubriquesSheet = extraction.sheets.find((s) => s.name === 'Rubriques');
  const warnings = [];

  const header = (produitsSheet.rows[0] ?? []).map(headerText);
  const idx = (name) => header.indexOf(name);
  const nameIdx = idx('Produit');
  const quantiteIdx = idx('Quantité');
  const quantiteDecIdx = idx('Quantité décimale');
  const caTtcIdx = idx('CA TTC');
  const caHtIdx = idx('CA HT');
  const offertsIdx = idx('Offerts');
  const remisesIdx = idx('Remises');
  const puIdx = idx('PU');
  const codesBarreIdx = idx('Codes barre');
  const derniereVenteIdx = idx('Dernière vente');
  const rubriqueIdx = idx('Rubrique');

  const products = [];
  let grandTotal = null;

  produitsSheet.rows.slice(1).forEach((row, offset) => {
    const sourceRow = offset + 2;
    const name = headerText(row[nameIdx]);
    if (!name) return;

    if (name === 'Total général') {
      grandTotal = {
        quantity: toInt(row[quantiteIdx]),
        revenue_ttc_cents: toCents(row[caTtcIdx]),
        revenue_ht_cents: toCents(row[caHtIdx]),
        complimentary_qty: toInt(row[offertsIdx]),
      };
      return;
    }

    const discountsRaw = row[remisesIdx];
    products.push({
      product_name: name,
      category_name: rubriqueIdx >= 0 && row[rubriqueIdx] ? headerText(row[rubriqueIdx]) : null,
      quantity: toInt(row[quantiteIdx]),
      quantity_decimal: toFloatOrNull(row[quantiteDecIdx]),
      revenue_ttc_cents: toCents(row[caTtcIdx]),
      revenue_ht_cents: toCents(row[caHtIdx]),
      complimentary_qty: toInt(row[offertsIdx]),
      discounts_raw: discountsRaw === undefined || discountsRaw === null ? null : String(discountsRaw),
      discounts_value: typeof discountsRaw === 'number' ? discountsRaw : null,
      unit_price_cents: toCentsOrNull(row[puIdx]),
      barcode: row[codesBarreIdx] ? headerText(row[codesBarreIdx]) : null,
      last_sale_at: parseDateTimeCell(row[derniereVenteIdx]),
      source_sheet: 'Produits',
      source_row: sourceRow,
      mapping_status: 'unmapped', // annotated by recipe-mapping.js, see parsePosAddictill
      moka_product_key: null, // idem
    });
  });

  const rubriques = rubriquesSheet
    ? parseRubriquesSubtotals(rubriquesSheet)
    : { categorySubtotals: [], grandTotal: null };

  let periodStart = null;
  let periodEnd = null;
  let periodStatus = 'unknown';
  if (options.periodStart && options.periodEnd) {
    periodStart = options.periodStart;
    periodEnd = options.periodEnd;
    periodStatus = 'explicit';
  } else {
    warnings.push(
      'Période non fournie (--period-start/--period-end) — jamais déduite de "Dernière vente", stockée comme inconnue.'
    );
  }

  const mappings = loadProductMappings(options.mappingPath);
  const { products: mappedProducts, unmapped_products: unmappedProducts } = annotateProductsWithMapping(
    products,
    mappings
  );
  if (unmappedProducts.length > 0) {
    warnings.push(
      `${unmappedProducts.length} produit(s) AddicTill sans correspondance dans le mapping local — ` +
        `jamais deviné, voir lib/importer/config/product-mapping.json.`
    );
  }

  const statement = AddicTillProductRankingSchema.parse({
    source_type: 'addictill_product_ranking',
    period_start: periodStart,
    period_end: periodEnd,
    period_status: periodStatus,
    products: mappedProducts,
    category_subtotals: rubriques.categorySubtotals,
    grand_total: grandTotal,
    unmapped_products: unmappedProducts,
  });

  const validation = ValidationResultSchema.parse(
    validateProductRanking(statement, rubriques.grandTotal, warnings)
  );
  return { statement, validation };
}

/**
 * @param {import('../schemas').AddicTillProductRanking} statement
 * @param {import('../schemas').AddicTillGrandTotal|null} rubriquesGrandTotal
 * @param {string[]} parseWarnings
 * @returns {import('../schemas').ValidationResult}
 */
function validateProductRanking(statement, rubriquesGrandTotal, parseWarnings = []) {
  const errors = [];
  const warnings = [...parseWarnings];

  if (!statement.grand_total) {
    errors.push('VALIDATION_ERROR: ligne "Total général" introuvable dans la feuille Produits');
  } else {
    const recomputed = statement.products.reduce(
      (acc, p) => ({
        quantity: acc.quantity + p.quantity,
        revenue_ttc_cents: acc.revenue_ttc_cents + p.revenue_ttc_cents,
        revenue_ht_cents: acc.revenue_ht_cents + p.revenue_ht_cents,
        complimentary_qty: acc.complimentary_qty + p.complimentary_qty,
      }),
      { quantity: 0, revenue_ttc_cents: 0, revenue_ht_cents: 0, complimentary_qty: 0 }
    );
    for (const key of Object.keys(recomputed)) {
      if (recomputed[key] !== statement.grand_total[key]) {
        errors.push(
          `TOTAL_MISMATCH: somme des produits pour "${key}" (${recomputed[key]}) ≠ Total général (${statement.grand_total[key]})`
        );
      }
    }
  }

  if (rubriquesGrandTotal && statement.grand_total) {
    for (const key of Object.keys(rubriquesGrandTotal)) {
      if (rubriquesGrandTotal[key] !== statement.grand_total[key]) {
        errors.push(
          `TOTAL_MISMATCH: Total général feuille Rubriques (${key}=${rubriquesGrandTotal[key]}) ≠ feuille Produits (${key}=${statement.grand_total[key]})`
        );
      }
    }
  }

  if (statement.category_subtotals.length > 0) {
    const byCategory = new Map();
    for (const product of statement.products) {
      const key = product.category_name ?? '(sans catégorie)';
      const acc = byCategory.get(key) ?? { quantity: 0, revenue_ttc_cents: 0, revenue_ht_cents: 0, complimentary_qty: 0 };
      acc.quantity += product.quantity;
      acc.revenue_ttc_cents += product.revenue_ttc_cents;
      acc.revenue_ht_cents += product.revenue_ht_cents;
      acc.complimentary_qty += product.complimentary_qty;
      byCategory.set(key, acc);
    }
    for (const subtotal of statement.category_subtotals) {
      const recomputed = byCategory.get(subtotal.category_name);
      if (!recomputed) {
        warnings.push(
          `Catégorie "${subtotal.category_name}" présente dans Rubriques mais aucun produit correspondant trouvé dans Produits.`
        );
        continue;
      }
      for (const key of ['quantity', 'revenue_ttc_cents', 'revenue_ht_cents', 'complimentary_qty']) {
        if (recomputed[key] !== subtotal[key]) {
          errors.push(
            `TOTAL_MISMATCH: catégorie "${subtotal.category_name}" — "${key}" recalculé (${recomputed[key]}) ≠ sous-total affiché (${subtotal[key]})`
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * @param {import('../schemas').ExtractionResult} extraction
 * @param {{periodStart?: string, periodEnd?: string}} [options]
 * @returns {{reportType: 'daily_summary'|'product_ranking'|null, statement: Object|null, validation: import('../schemas').ValidationResult}}
 */
function parsePosAddictill(extraction, options = {}) {
  const reportType = detectAddicTillReportType(extraction);
  if (reportType === 'daily_summary') {
    const result = parseDailySummary(extraction);
    return { reportType, ...result };
  }
  if (reportType === 'product_ranking') {
    const result = parseProductRanking(extraction, options);
    return { reportType, ...result };
  }
  return {
    reportType: null,
    statement: null,
    validation: ValidationResultSchema.parse({
      valid: false,
      errors: ['UNSUPPORTED_ADDICTILL_REPORT: ni "Synthèse quotidienne" ni "Palmarès produits" reconnu dans ce fichier'],
      warnings: [],
    }),
  };
}

module.exports = {
  PARSER_VERSION,
  detectAddicTillReportType,
  parseHeaderColumns,
  parseDailySummary,
  parseProductRanking,
  parsePosAddictill,
  validateDailySummary,
  validateProductRanking,
};
