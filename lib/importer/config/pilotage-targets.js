'use strict';

/**
 * Configuration for the 5 approved pilotage Notion databases (PR4). Each
 * target is identified by a neutral `targetIdEnvVar` (not "database_id")
 * so business logic never depends on Notion's classic-database ID
 * semantics directly — see docs/ARCHITECTURE.md "PR4" for why (deferred
 * migration to the newer Database/Data Source model).
 *
 * `requiredProperties` is the read-only schema contract validated by
 * lib/importer/notion/schema.js before any write — PR4 never creates or
 * renames a Notion property, only reports mismatches (SCHEMA_MISMATCH).
 * Select *options* (e.g. a new payment method value) are data, not
 * schema, and are exempt from this check — Notion accepts new option
 * values on write without any schema change.
 *
 * These 5 databases must be created manually in Notion before use — see
 * README_IMPORTER.md "PR4" for the exact property list and setup checklist.
 * PR4 never creates them (no importer:schema:sync in this PR).
 */

const PILOTAGE_TARGETS = {
  import_runs: {
    label: 'Import Runs',
    targetIdEnvVar: 'NOTION_IMPORT_RUNS_DB_ID',
    requiredProperties: {
      Name: 'title',
      import_run_id: 'rich_text',
      source_type: 'select',
      source_subtype: 'select',
      original_filename: 'rich_text',
      file_hash_sha256: 'rich_text',
      imported_at: 'date',
      period_start: 'date',
      period_end: 'date',
      validation_status: 'select',
      warning_count: 'number',
      error_count: 'number',
      row_count: 'number',
      status: 'select',
      attempt_number: 'number',
      retry_of_import_run_id: 'rich_text',
      failure_reason: 'rich_text',
      initiated_via: 'select',
      initiated_by: 'rich_text',
      parser_version: 'rich_text',
      establishment_key: 'rich_text',
      audit_metadata: 'rich_text',
    },
  },
  daily_operations: {
    label: 'Daily Operations',
    targetIdEnvVar: 'NOTION_DAILY_OPERATIONS_DB_ID',
    requiredProperties: {
      Name: 'title',
      import_key: 'rich_text',
      establishment_key: 'rich_text',
      date: 'date',
      source_type: 'select',
      source_subtype: 'select',
      ticket_count: 'number',
      total_ttc: 'number',
      total_ht: 'number',
      ca_ttc: 'number',
      clients: 'number',
      source_import: 'relation',
    },
  },
  payment_methods: {
    label: 'Payment Methods',
    targetIdEnvVar: 'NOTION_PAYMENT_METHODS_DB_ID',
    requiredProperties: {
      Name: 'title',
      import_key: 'rich_text',
      establishment_key: 'rich_text',
      date: 'date',
      source_type: 'select',
      source_subtype: 'select',
      payment_method: 'select',
      quantity: 'number',
      amount: 'number',
      source_import: 'relation',
    },
  },
  product_sales: {
    label: 'Product Sales',
    targetIdEnvVar: 'NOTION_PRODUCT_SALES_DB_ID',
    requiredProperties: {
      Name: 'title',
      import_key: 'rich_text',
      establishment_key: 'rich_text',
      period_start: 'date',
      period_end: 'date',
      addictill_product_key: 'rich_text',
      product_name_raw: 'rich_text',
      category_name: 'rich_text',
      quantity: 'number',
      revenue_ttc: 'number',
      revenue_ht: 'number',
      complimentary_qty: 'number',
      discounts_raw: 'rich_text',
      discounts_value: 'number',
      unit_price: 'number',
      last_sale_at: 'date',
      mapping_status: 'select',
      moka_product_key: 'rich_text',
      source_import: 'relation',
    },
  },
  sales_categories: {
    label: 'Sales Categories',
    targetIdEnvVar: 'NOTION_SALES_CATEGORIES_DB_ID',
    requiredProperties: {
      Name: 'title',
      import_key: 'rich_text',
      establishment_key: 'rich_text',
      period_start: 'date',
      period_end: 'date',
      category_key: 'rich_text',
      category_name_raw: 'rich_text',
      quantity: 'number',
      revenue_ttc: 'number',
      revenue_ht: 'number',
      complimentary_qty: 'number',
      source_import: 'relation',
    },
  },
};

/**
 * @param {string} targetKey - one of PILOTAGE_TARGETS' keys
 * @returns {string|null} the configured Notion database ID, or null if the env var is unset
 */
function resolveTargetId(targetKey) {
  const target = PILOTAGE_TARGETS[targetKey];
  if (!target) throw new Error(`Unknown pilotage target: ${targetKey}`);
  const value = process.env[target.targetIdEnvVar];
  return value && value.trim() ? value.trim() : null;
}

module.exports = { PILOTAGE_TARGETS, resolveTargetId };
