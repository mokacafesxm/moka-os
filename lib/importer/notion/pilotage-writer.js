'use strict';

/**
 * Idempotent upsert engine for the 4 data pilotage tables (PR4). Each row
 * is looked up by its deterministic `import_key` (never a random UUID) —
 * found + identical data + already pointing at this Import Run → skipped
 * (no wasted API call); found + different → updated; not found → created.
 * A row's own write failure is caught and reported, never thrown — the
 * batch continues with the remaining rows (see docs/ARCHITECTURE.md "PR4"
 * "Partial-failure behavior").
 *
 * scan-z secondary source (spec v3 §6): Daily Operations/Payment Methods
 * rows additionally carry `source_subtype`, checked against
 * SOURCE_SUBTYPE_AUTHORITY before any create/update — an incoming write
 * proceeds only when `resolveAuthority(incoming) >= resolveAuthority(existing)`.
 * A downgrade attempt (e.g. scan-z trying to replace an AddicTill row)
 * never writes anything and is reported as `status: 'blocked_precedence'`
 * — there is no override, from any surface. Product Sales/Sales Categories
 * have no `source_subtype` and no precedence concept at all (scan-z never
 * writes to them).
 */

const { findByProperty, createRow, updateRow } = require('./repository');
const {
  titleProp,
  textProp,
  selectProp,
  numberProp,
  dateProp,
  relationProp,
  getText,
  getSelect,
  getNumber,
  getDate,
  getRelationIds,
} = require('./notion-client');
const { resolveAuthority } = require('../schemas');

const BUILDERS = { text: textProp, number: numberProp, select: selectProp, date: dateProp };
const GETTERS = { text: getText, number: getNumber, select: getSelect, date: getDate };

/** Targets where source-authority precedence applies — see module docstring. */
const PRECEDENCE_AWARE_TARGETS = new Set(['daily_operations', 'payment_methods']);

/** Declarative field lists, shared between write-property building and read-back comparison. */
const FIELD_DESCRIPTORS = {
  daily_operations: [
    { key: 'import_key', prop: 'import_key', kind: 'text' },
    { key: 'establishment_key', prop: 'establishment_key', kind: 'text' },
    { key: 'date', prop: 'date', kind: 'date' },
    { key: 'source_type', prop: 'source_type', kind: 'select' },
    { key: 'source_subtype', prop: 'source_subtype', kind: 'select' },
    { key: 'ticket_count', prop: 'ticket_count', kind: 'number' },
    { key: 'total_ttc', prop: 'total_ttc', kind: 'number' },
    { key: 'total_ht', prop: 'total_ht', kind: 'number' },
    { key: 'ca_ttc', prop: 'ca_ttc', kind: 'number' },
    { key: 'clients', prop: 'clients', kind: 'number' },
  ],
  payment_methods: [
    { key: 'import_key', prop: 'import_key', kind: 'text' },
    { key: 'establishment_key', prop: 'establishment_key', kind: 'text' },
    { key: 'date', prop: 'date', kind: 'date' },
    { key: 'source_type', prop: 'source_type', kind: 'select' },
    { key: 'source_subtype', prop: 'source_subtype', kind: 'select' },
    { key: 'payment_method', prop: 'payment_method', kind: 'select' },
    { key: 'quantity', prop: 'quantity', kind: 'number' },
    { key: 'amount', prop: 'amount', kind: 'number' },
  ],
  product_sales: [
    { key: 'import_key', prop: 'import_key', kind: 'text' },
    { key: 'establishment_key', prop: 'establishment_key', kind: 'text' },
    { key: 'period_start', prop: 'period_start', kind: 'date' },
    { key: 'period_end', prop: 'period_end', kind: 'date' },
    { key: 'addictill_product_key', prop: 'addictill_product_key', kind: 'text' },
    { key: 'product_name_raw', prop: 'product_name_raw', kind: 'text' },
    { key: 'category_name', prop: 'category_name', kind: 'text' },
    { key: 'quantity', prop: 'quantity', kind: 'number' },
    { key: 'revenue_ttc', prop: 'revenue_ttc', kind: 'number' },
    { key: 'revenue_ht', prop: 'revenue_ht', kind: 'number' },
    { key: 'complimentary_qty', prop: 'complimentary_qty', kind: 'number' },
    { key: 'discounts_raw', prop: 'discounts_raw', kind: 'text' },
    { key: 'discounts_value', prop: 'discounts_value', kind: 'number' },
    { key: 'unit_price', prop: 'unit_price', kind: 'number' },
    { key: 'last_sale_at', prop: 'last_sale_at', kind: 'date' },
    { key: 'mapping_status', prop: 'mapping_status', kind: 'select' },
    { key: 'moka_product_key', prop: 'moka_product_key', kind: 'text' },
  ],
  sales_categories: [
    { key: 'import_key', prop: 'import_key', kind: 'text' },
    { key: 'establishment_key', prop: 'establishment_key', kind: 'text' },
    { key: 'period_start', prop: 'period_start', kind: 'date' },
    { key: 'period_end', prop: 'period_end', kind: 'date' },
    { key: 'category_key', prop: 'category_key', kind: 'text' },
    { key: 'category_name_raw', prop: 'category_name_raw', kind: 'text' },
    { key: 'quantity', prop: 'quantity', kind: 'number' },
    { key: 'revenue_ttc', prop: 'revenue_ttc', kind: 'number' },
    { key: 'revenue_ht', prop: 'revenue_ht', kind: 'number' },
    { key: 'complimentary_qty', prop: 'complimentary_qty', kind: 'number' },
  ],
};

/**
 * @param {string} targetKey
 * @param {object} row
 * @returns {string}
 */
function buildTitle(targetKey, row) {
  switch (targetKey) {
    case 'daily_operations':
      return `${row.date} · ${row.establishment_key} · ${row.source_type}`;
    case 'payment_methods':
      return `${row.date} · ${row.payment_method} · ${row.establishment_key}`;
    case 'product_sales':
      return `${row.product_name_raw} · ${row.period_start ?? '?'} → ${row.period_end ?? '?'}`;
    case 'sales_categories':
      return `${row.category_name_raw} · ${row.period_start ?? '?'} → ${row.period_end ?? '?'}`;
    default:
      return row.import_key;
  }
}

/**
 * @param {string} targetKey
 * @param {object} row
 * @param {string} importRunPageId
 * @returns {object} Notion property-value JSON, including the Name title and source_import relation
 */
function buildProperties(targetKey, row, importRunPageId) {
  const properties = { Name: titleProp(buildTitle(targetKey, row)) };
  for (const descriptor of FIELD_DESCRIPTORS[targetKey]) {
    properties[descriptor.prop] = BUILDERS[descriptor.kind](row[descriptor.key]);
  }
  properties.source_import = relationProp(importRunPageId);
  return properties;
}

/**
 * @param {'text'|'number'|'select'|'date'} kind
 * @param {*} value
 * @returns {*} normalized for equality comparison
 */
function normalizeForCompare(kind, value) {
  const v = value === undefined ? null : value;
  if (kind === 'text' || kind === 'select') return v === null ? '' : String(v);
  if (kind === 'number') return v === null ? null : Number(v);
  return v; // date: ISO strings compare directly, null stays null
}

/**
 * @param {string} targetKey
 * @param {object} row
 * @param {object} notionProperties - an existing page's `.properties`
 * @returns {{field: string, oldValue: *, newValue: *}[]} every field that differs — empty when the row is already identical. Used both to decide skip-vs-update and to surface a "this will change these fields" diff before a write (spec v3 §6 — "no silent overwrite").
 */
function computeRowDiff(targetKey, row, notionProperties) {
  const diff = [];
  for (const descriptor of FIELD_DESCRIPTORS[targetKey]) {
    const expected = normalizeForCompare(descriptor.kind, row[descriptor.key]);
    const actual = normalizeForCompare(descriptor.kind, GETTERS[descriptor.kind](notionProperties, descriptor.prop));
    if (expected !== actual) {
      diff.push({ field: descriptor.key, oldValue: actual, newValue: expected });
    }
  }
  return diff;
}

/**
 * @param {string} targetKey
 * @param {object} row
 * @param {object} notionProperties - an existing page's `.properties`
 * @returns {boolean} true when every data field already matches (excludes source_import, checked separately)
 */
function rowDataMatches(targetKey, row, notionProperties) {
  return computeRowDiff(targetKey, row, notionProperties).length === 0;
}

/**
 * Source-authority precedence check (spec v3 §6) — only meaningful for
 * Daily Operations/Payment Methods, which carry `source_subtype`. Product
 * Sales/Sales Categories have no precedence concept and always report
 * `blocked: false`.
 * @param {string} targetKey
 * @param {object} row
 * @param {object} existingProperties - an existing page's `.properties`
 * @returns {{blocked: boolean, existingSourceSubtype: string|null, existingAuthority: number, incomingAuthority: number}}
 */
function checkAuthority(targetKey, row, existingProperties) {
  if (!PRECEDENCE_AWARE_TARGETS.has(targetKey)) {
    return { blocked: false, existingSourceSubtype: null, existingAuthority: 0, incomingAuthority: 0 };
  }
  const existingSourceSubtype = getSelect(existingProperties, 'source_subtype') || null;
  const existingAuthority = existingSourceSubtype ? resolveAuthority(existingSourceSubtype) : 0;
  const incomingAuthority = resolveAuthority(row.source_subtype);
  return {
    blocked: incomingAuthority < existingAuthority,
    existingSourceSubtype,
    existingAuthority,
    incomingAuthority,
  };
}

/**
 * Upserts a single pilotage row. Never throws — a failure is caught and
 * reported as `{status: 'failed', reason}` so the caller can continue
 * processing the remaining rows. A source-authority downgrade (e.g.
 * scan-z vs. an existing AddicTill row) is reported as
 * `{status: 'blocked_precedence', reason}` — no write is attempted, and
 * there is no override.
 * @param {{targetKey: string, row: object, importRunPageId: string}} params
 * @returns {Promise<import('../schemas').CommitRowResult>}
 */
async function upsertPilotageRow({ targetKey, row, importRunPageId }) {
  try {
    const existing = await findByProperty(targetKey, 'import_key', row.import_key);

    if (!existing) {
      const properties = buildProperties(targetKey, row, importRunPageId);
      await createRow(targetKey, properties);
      return { targetKey, importKey: row.import_key, status: 'created', reason: null };
    }

    const authority = checkAuthority(targetKey, row, existing.properties);
    if (authority.blocked) {
      return {
        targetKey,
        importKey: row.import_key,
        status: 'blocked_precedence',
        reason:
          `existing '${authority.existingSourceSubtype}' row has higher authority ` +
          `(${authority.existingAuthority} > ${authority.incomingAuthority}) — no override exists`,
      };
    }

    const dataMatches = rowDataMatches(targetKey, row, existing.properties);
    const currentSourceImport = getRelationIds(existing.properties, 'source_import');
    const sourceImportMatches = currentSourceImport.length === 1 && currentSourceImport[0] === importRunPageId;

    if (dataMatches && sourceImportMatches) {
      return { targetKey, importKey: row.import_key, status: 'skipped', reason: null };
    }

    const properties = buildProperties(targetKey, row, importRunPageId);
    await updateRow(existing.id, properties);
    return { targetKey, importKey: row.import_key, status: 'updated', reason: null };
  } catch (error) {
    return { targetKey, importKey: row.import_key, status: 'failed', reason: error.message };
  }
}

/**
 * @param {string} targetKey
 * @param {object[]} rows
 * @param {string} importRunPageId
 * @returns {Promise<import('../schemas').CommitRowResult[]>}
 */
async function writeRows(targetKey, rows, importRunPageId) {
  const results = [];
  for (const row of rows) {
    // Sequential on purpose: the shared Notion throttle serializes every
    // request regardless, so concurrent callers would only queue behind
    // the same gate — see docs/ARCHITECTURE.md "PR4" "Bounded concurrency".
    results.push(await upsertPilotageRow({ targetKey, row, importRunPageId }));
  }
  return results;
}

/**
 * @param {{dailyOperations?: object[], paymentMethods?: object[], productSales?: object[], salesCategories?: object[]}} rowsByTarget
 * @param {string} importRunPageId
 * @returns {Promise<import('../schemas').CommitRowResult[]>}
 */
async function writeAllPilotageRows(
  { dailyOperations = [], paymentMethods = [], productSales = [], salesCategories = [] },
  importRunPageId
) {
  const results = [];
  results.push(...(await writeRows('daily_operations', dailyOperations, importRunPageId)));
  results.push(...(await writeRows('payment_methods', paymentMethods, importRunPageId)));
  results.push(...(await writeRows('product_sales', productSales, importRunPageId)));
  results.push(...(await writeRows('sales_categories', salesCategories, importRunPageId)));
  return results;
}

/**
 * @param {import('../schemas').CommitRowResult[]} results
 * @returns {{created: number, updated: number, skipped: number, failed: number, blocked_precedence: number}}
 */
function summarizeResults(results) {
  const summary = { created: 0, updated: 0, skipped: 0, failed: 0, blocked_precedence: 0 };
  for (const result of results) summary[result.status] += 1;
  return summary;
}

module.exports = {
  FIELD_DESCRIPTORS,
  PRECEDENCE_AWARE_TARGETS,
  buildTitle,
  buildProperties,
  computeRowDiff,
  rowDataMatches,
  checkAuthority,
  upsertPilotageRow,
  writeRows,
  writeAllPilotageRows,
  summarizeResults,
};
