'use strict';

/**
 * Import Runs — the Notion-backed audit trail (PR4 addendum). Two
 * deliberately separate concerns live here:
 *
 *  1. Audit history: every execution attempt (preview or commit, blocked
 *     or not, succeeded or failed) gets its own Import Run record — never
 *     overwritten, never dropped. See `status` in `../schemas.js` for the
 *     full lifecycle (preview/committed/failed/partial_failure/retry).
 *  2. Business deduplication: re-committing the exact same file bytes is
 *     blocked only when ANY Import Run for that file_hash has
 *     `status: 'committed'` — computed by scanning *all* matching records
 *     (`listImportRunsByFileHash`), never just the first one a query
 *     happens to return, precisely because multiple attempts for the same
 *     file are now expected and preserved.
 *
 * This is also the Notion-backed source of truth for "was this exact file
 * ever committed" (as opposed to the local imports/import-registry.json
 * from PR1, which only tracks one machine's processing history) — multiple
 * people/machines can run the importer against the same file, so
 * file-level dedup must be checked against Notion, not just local state.
 */

const { findAllByProperty, createRow, updateRow } = require('./repository');
const { textProp, selectProp, dateProp, numberProp, titleProp, getSelect, getText, getNumber, getDate } = require('./notion-client');
const { ImportRunSchema } = require('../schemas');

/**
 * @param {import('../schemas').ImportRun} run
 * @returns {object} Notion property-value JSON
 */
function buildImportRunProperties(run) {
  return {
    Name: titleProp(`${run.source_subtype} — ${run.original_filename} (#${run.attempt_number})`),
    import_run_id: textProp(run.import_run_id),
    source_type: selectProp(run.source_type),
    source_subtype: selectProp(run.source_subtype),
    original_filename: textProp(run.original_filename),
    file_hash_sha256: textProp(run.file_hash_sha256),
    imported_at: dateProp(run.imported_at),
    period_start: dateProp(run.period_start),
    period_end: dateProp(run.period_end),
    validation_status: selectProp(run.validation_status),
    warning_count: numberProp(run.warning_count),
    error_count: numberProp(run.error_count),
    row_count: numberProp(run.row_count),
    status: selectProp(run.status),
    attempt_number: numberProp(run.attempt_number),
    retry_of_import_run_id: textProp(run.retry_of_import_run_id),
    failure_reason: textProp(run.failure_reason),
    initiated_via: selectProp(run.initiated_via),
    initiated_by: textProp(run.initiated_by),
    parser_version: textProp(run.parser_version),
    establishment_key: textProp(run.establishment_key),
  };
}

/**
 * @param {object} page - a raw Notion page as returned by queryDatabase
 * @returns {{pageId: string, importRunId: string, status: string, importedAt: string|null}}
 */
function toRunSummary(page) {
  return {
    pageId: page.id,
    importRunId: getText(page.properties, 'import_run_id'),
    status: getSelect(page.properties, 'status'),
    importedAt: getDate(page.properties, 'imported_at'),
    attemptNumber: getNumber(page.properties, 'attempt_number'),
  };
}

/**
 * Fetches every Import Run recorded for a given file hash — every prior
 * attempt, not just the first match — sorted oldest to newest.
 * @param {string} fileHash
 * @returns {Promise<{pageId: string, importRunId: string, status: string, importedAt: string|null, attemptNumber: number|null}[]>}
 */
async function listImportRunsByFileHash(fileHash) {
  const pages = await findAllByProperty('import_runs', 'file_hash_sha256', fileHash);
  return pages.map(toRunSummary).sort((a, b) => (a.importedAt ?? '').localeCompare(b.importedAt ?? ''));
}

/**
 * @param {{pageId: string, status: string}[]} runs - result of listImportRunsByFileHash
 * @returns {boolean} true when any prior attempt fully succeeded
 */
function hasCommittedRun(runs) {
  return runs.some((run) => run.status === 'committed');
}

/**
 * @param {import('../schemas').ImportRun} runData
 * @returns {Promise<string>} the created page's id
 */
async function createImportRun(runData) {
  const validated = ImportRunSchema.parse(runData);
  const page = await createRow('import_runs', buildImportRunProperties(validated));
  return page.id;
}

/**
 * @param {string} pageId
 * @param {Partial<import('../schemas').ImportRun>} updates
 */
async function updateImportRunResult(pageId, updates) {
  const properties = {};
  if (updates.validation_status !== undefined) properties.validation_status = selectProp(updates.validation_status);
  if (updates.warning_count !== undefined) properties.warning_count = numberProp(updates.warning_count);
  if (updates.error_count !== undefined) properties.error_count = numberProp(updates.error_count);
  if (updates.row_count !== undefined) properties.row_count = numberProp(updates.row_count);
  if (updates.status !== undefined) properties.status = selectProp(updates.status);
  if (updates.failure_reason !== undefined) properties.failure_reason = textProp(updates.failure_reason);
  // scan-z secondary source (spec v3 §3/§4): the placeholder written at
  // create-time carries a provisional `audit_metadata.reconciliation.action`
  // (e.g. "committing") — this lets the final outcome (committed/failed/
  // partial_failure) be reflected in the same field once known.
  if (updates.audit_metadata !== undefined) properties.audit_metadata = textProp(updates.audit_metadata);
  return updateRow(pageId, properties);
}

module.exports = {
  buildImportRunProperties,
  listImportRunsByFileHash,
  hasCommittedRun,
  createImportRun,
  updateImportRunResult,
};
