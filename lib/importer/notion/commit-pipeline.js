'use strict';

/**
 * Shared preflight/commit orchestrator (PR4 + PR4 audit-trail addendum) —
 * the single code path used by both the CLI (`scripts/import.js`) and the
 * web API (`app/api/imports/preflight`, `app/api/imports/commit`), so the
 * two surfaces can never drift on validation or blocking rules. Re-runs the
 * full analysis on every call and never trusts a client-supplied preview —
 * a commit always re-detects, re-extracts, re-classifies, re-parses, and
 * re-validates the actual file bytes handed to it.
 *
 * Blocking rules for the PILOTAGE DATA (per the approved PR4 plan) — these
 * govern only whether daily_operations/payment_methods/product_sales/
 * sales_categories rows get written, never whether an Import Run audit
 * record gets written (see "Audit trail vs. business dedup" below):
 *  - a document with parser-level validation errors is never committed;
 *  - non-blocking parser warnings (e.g. AddicTill's payment/vendor
 *    reconciliation gaps — see pos-addictill.js validateDailySummary) never
 *    block a commit, only surface in the preview/Import Run record;
 *  - an unknown/missing establishment_key always blocks;
 *  - a file whose exact SHA-256 already has a `status: 'committed'` Import
 *    Run is refused as a duplicate — but a prior 'partial_failure',
 *    'failed', or 'retry' run never blocks a retry (idempotent per-row
 *    upsert makes that retry safe, see pilotage-writer.js);
 *  - a pilotage-schema mismatch blocks (checked fresh on every commit, since
 *    Notion has no schema-migration lock other users can't bypass).
 *
 * Audit trail vs. business dedup (PR4 addendum): business deduplication
 * (never write the same pilotage data twice) and audit history (never lose
 * a record that an attempt happened) are different concerns. EVERY
 * execution attempt — a read-only preview, a blocked commit, a failed
 * commit, a partial failure, a full success — gets its own Import Run
 * record (`status`: preview/failed/partial_failure/committed/retry). Only
 * the underlying pilotage rows stay gated by the blocking rules above; the
 * audit record itself is written on a best-effort basis regardless of
 * blocking (and its own failure — e.g. Notion unreachable — never blocks
 * returning a preview/commit result to the caller). See
 * docs/ARCHITECTURE.md "PR4 addendum — audit trail" for the full rationale.
 *
 * For an actual commit attempt, the Import Run Notion row is created up
 * front (so pilotage rows have a real page id to point their
 * `source_import` relation at from the start, never a placeholder), with a
 * pessimistic placeholder status (`retry` if this is attempt N>1 for the
 * same file, else `failed`), then corrected to its true final value once
 * every row has been written. If the process crashes in between, the row
 * is left showing that placeholder — which is both accurate (the commit
 * did not cleanly finish) and safe, since only `status: 'committed'`
 * blocks a retry of the same file; a retry after a crash is always allowed
 * and, thanks to idempotent per-row upsert, always safe to run again.
 */

const fs = require('node:fs');
const { detectFileTypeFromBuffer } = require('../detect');
const { extractContentFromBuffer } = require('../extract');
const { classifyDocument, resolveClassificationStatus } = require('../classify');
const { computeFileHashFromBuffer } = require('../registry');
const { parseBankStatement, PARSER_VERSION: BANK_PARSER_VERSION } = require('../parsers/bank-statement');
const { parsePosAddictill, PARSER_VERSION: ADDICTILL_PARSER_VERSION } = require('../parsers/pos-addictill');
const { loadProductMappings, annotateProductsWithMapping } = require('../parsers/recipe-mapping');
const {
  runScanZOcr,
  validateFinalValues,
  computeCorrectedFields,
  toCents: scanZToCents,
  PARSER_VERSION: SCANZ_PARSER_VERSION,
} = require('../parsers/scanz-ocr');
const { resolveEstablishment } = require('./establishments');
const { buildDailySummaryRows, buildProductRankingRows } = require('./row-builders');
const { writeAllPilotageRows, summarizeResults, checkAuthority, computeRowDiff } = require('./pilotage-writer');
const {
  listImportRunsByFileHash,
  hasCommittedRun,
  createImportRun,
  updateImportRunResult,
} = require('./import-runs');
const { findByProperty } = require('./repository');
const { checkPilotageSchemas } = require('./schema');
const { mintPreflightToken, verifyPreflightToken } = require('./preflight-token');
const { buildAuditMetadataString } = require('./audit-metadata');
const { IMPORTER_VERSION, resolveAuthority } = require('../schemas');

/** @returns {boolean} */
function isScanZEnabled() {
  return process.env.IMPORTS_SCANZ_ENABLED === 'true';
}

// Fallback recorded on every Import Run when no specific document parser
// actually ran (unknown file type, ambiguous/rejected classification,
// unsupported POS source, monthly_performance) — see PARSER_VERSION in
// bank-statement.js / pos-addictill.js for the per-parser versions used
// once a document is actually parsed. Never left blank either way — task
// "verify parser_version is actually written into every Import Run".
const BASE_PARSER_VERSION = `importer-v${IMPORTER_VERSION}`;

/**
 * @param {import('./row-builders').ProductSalesRow[]} products
 * @returns {string[]}
 */
function collectUnmappedProductNames(products) {
  return products.filter((p) => p.mapping_status === 'unmapped').map((p) => p.product_name_raw);
}

/**
 * Parses/classifies a single file with no establishment or Notion
 * dependency at all — pure analysis, safe to call repeatedly while a user
 * is still picking an establishment in the UI.
 *
 * Accepts either `filePath` (CLI: a real file on disk) or `buffer` (web
 * upload: the file's bytes already in memory, never written to disk) —
 * exactly one must be provided. Everything downstream of this point
 * operates on the in-memory buffer either way, so the CLI and the web API
 * can never diverge in how a document is parsed/validated.
 * @param {{filePath?: string, buffer?: Buffer, originalFilename: string}} params
 * @returns {Promise<object>} a PreflightAnalysis (see module docstring)
 */
async function analyzeDocument({ filePath, buffer, originalFilename }) {
  const blockingReasons = [];
  const fileBuffer = buffer ?? fs.readFileSync(filePath);
  const fileHash = computeFileHashFromBuffer(fileBuffer);
  const detection = detectFileTypeFromBuffer(fileBuffer, originalFilename);

  const base = {
    file_hash: fileHash,
    original_filename: originalFilename,
    detection,
  };

  if (detection.file_type === 'unknown') {
    return {
      ...base,
      classification: null,
      classification_status: null,
      source_type: null,
      source_subtype: 'unknown',
      report_kind: null,
      statement: null,
      validation: { valid: false, errors: ['UNKNOWN_FILE_TYPE: type de fichier non reconnu'], warnings: [] },
      period_start: null,
      period_end: null,
      blocking_reasons: ['UNKNOWN_FILE_TYPE'],
      parser_version: BASE_PARSER_VERSION,
    };
  }

  const extraction = await extractContentFromBuffer(fileBuffer, detection.file_type);
  const classification = await classifyDocument(extraction);
  const classificationStatus = resolveClassificationStatus(classification);

  if (classificationStatus !== 'auto') {
    blockingReasons.push(
      classificationStatus === 'rejected' ? 'CLASSIFICATION_REJECTED' : 'CLASSIFICATION_REVIEW_REQUIRED'
    );
    return {
      ...base,
      classification,
      classification_status: classificationStatus,
      source_type: classification.document_type,
      source_subtype: 'unknown',
      report_kind: null,
      statement: null,
      validation: { valid: false, errors: [], warnings: [] },
      period_start: null,
      period_end: null,
      blocking_reasons: blockingReasons,
      parser_version: BASE_PARSER_VERSION,
    };
  }

  const sourceType = classification.document_type;
  let sourceSubtype = 'unknown';
  let reportKind = null;
  let statement = null;
  let validation = { valid: true, errors: [], warnings: [] };
  let periodStart = null;
  let periodEnd = null;
  let parserVersion = BASE_PARSER_VERSION;

  if (sourceType === 'bank_statement') {
    sourceSubtype = 'credit_mutuel';
    const result = parseBankStatement(extraction);
    statement = result.statement;
    validation = result.validation;
    periodStart = statement?.period_start ?? null;
    periodEnd = statement?.period_end ?? null;
    parserVersion = BANK_PARSER_VERSION;
  } else if (sourceType === 'pos_export') {
    if (classification.pos_source_hint !== 'addictill_export') {
      validation = {
        valid: false,
        errors: ['UNSUPPORTED_POS_SOURCE: seules les exports AddicTill sont pris en charge'],
        warnings: [],
      };
    } else {
      const result = parsePosAddictill(extraction);
      reportKind = result.reportType;
      statement = result.statement;
      validation = result.validation;
      parserVersion = ADDICTILL_PARSER_VERSION;

      if (reportKind === 'daily_summary' && statement) {
        const dates = statement.days.map((d) => d.date).sort();
        periodStart = dates[0] ?? null;
        periodEnd = dates[dates.length - 1] ?? null;
        sourceSubtype = 'addictill_daily_summary';
      } else if (reportKind === 'product_ranking' && statement) {
        const mappings = loadProductMappings();
        const { products, unmapped_products } = annotateProductsWithMapping(statement.products, mappings);
        statement = { ...statement, products };
        if (unmapped_products.length > 0) {
          validation = {
            ...validation,
            warnings: [
              ...validation.warnings,
              `${unmapped_products.length} produit(s) sans correspondance MÖKA (non bloquant): ${unmapped_products.join(', ')}`,
            ],
          };
        }
        periodStart = statement.period_start;
        periodEnd = statement.period_end;
        sourceSubtype = 'addictill_product_ranking';
      }
    }
  } else if (sourceType === 'monthly_performance') {
    validation = {
      valid: false,
      errors: ['UNSUPPORTED_DOCUMENT_TYPE: monthly_performance non pris en charge dans cette version'],
      warnings: [],
    };
  }

  if (!validation.valid) blockingReasons.push('VALIDATION_ERRORS');

  return {
    ...base,
    classification,
    classification_status: classificationStatus,
    source_type: sourceType,
    source_subtype: sourceSubtype,
    report_kind: reportKind,
    statement,
    validation,
    period_start: periodStart,
    period_end: periodEnd,
    blocking_reasons: blockingReasons,
    parser_version: parserVersion,
  };
}

/**
 * @param {object} analysis - result of analyzeDocument
 * @param {string} establishmentKey
 * @returns {object|null} row-builders output, or null when the source type has no pilotage rows (bank_statement)
 */
function buildRowsFor(analysis, establishmentKey) {
  if (analysis.source_type === 'pos_export' && analysis.report_kind === 'daily_summary') {
    return buildDailySummaryRows(analysis.statement, {
      establishmentKey,
      sourceType: analysis.source_type,
      sourceSubtype: analysis.source_subtype,
    });
  }
  if (analysis.source_type === 'pos_export' && analysis.report_kind === 'product_ranking') {
    return buildProductRankingRows(analysis.statement, { establishmentKey });
  }
  return null;
}

/**
 * @param {object} analysis
 * @returns {string[]} pilotage target keys a commit of this document would touch, always including 'import_runs'
 */
function requiredTargetsFor(analysis) {
  if (analysis.source_type === 'pos_export' && analysis.report_kind === 'daily_summary') {
    return ['import_runs', 'daily_operations', 'payment_methods'];
  }
  if (analysis.source_type === 'pos_export' && analysis.report_kind === 'product_ranking') {
    return ['import_runs', 'product_sales', 'sales_categories'];
  }
  return ['import_runs'];
}

/**
 * Resolves the full audit-history context for a file hash in one pass:
 * every prior attempt, how many there have been, whether any of them fully
 * succeeded, and the most recent one (for `retry_of_import_run_id`).
 * Never throws — a Notion failure (e.g. CONFIG_MISSING in local dev before
 * the databases exist) degrades to "no history known" rather than blocking
 * the caller, with the failure surfaced in `error` for transparency.
 * @param {string} fileHash
 * @returns {Promise<{existingRuns: object[], attemptNumber: number, hasCommittedRun: boolean, mostRecentRun: object|null, error: string|null}>}
 */
async function resolveAttemptContext(fileHash) {
  try {
    const existingRuns = await listImportRunsByFileHash(fileHash);
    return {
      existingRuns,
      attemptNumber: existingRuns.length + 1,
      hasCommittedRun: hasCommittedRun(existingRuns),
      mostRecentRun: existingRuns.length > 0 ? existingRuns[existingRuns.length - 1] : null,
      error: null,
    };
  } catch (error) {
    return {
      existingRuns: [],
      attemptNumber: 1,
      hasCommittedRun: false,
      mostRecentRun: null,
      error: error.code === 'CONFIG_MISSING' ? 'CONFIG_MISSING' : error.message,
    };
  }
}

/**
 * @param {object} params
 * @param {object} params.preflight
 * @param {'preview'|'committed'|'failed'|'partial_failure'|'retry'} params.status
 * @param {number} params.rowCount
 * @param {string|null} params.failureReason
 * @param {'cli'|'web'} params.initiatedVia
 * @param {string} params.initiatedBy
 * @returns {import('../schemas').ImportRun}
 */
function buildImportRunData({ preflight, status, rowCount, failureReason, initiatedVia, initiatedBy, auditMetadata = '' }) {
  return {
    import_run_id: `${preflight.file_hash}-${Date.now()}`,
    source_type: preflight.source_type,
    source_subtype: preflight.source_subtype,
    original_filename: preflight.original_filename,
    file_hash_sha256: preflight.file_hash,
    imported_at: new Date().toISOString(),
    period_start: preflight.period_start,
    period_end: preflight.period_end,
    validation_status: preflight.validation.valid ? 'valid' : 'invalid',
    warning_count: preflight.validation.warnings.length,
    error_count: preflight.validation.errors.length,
    row_count: rowCount,
    status,
    attempt_number: preflight.attempt_number,
    retry_of_import_run_id: preflight.retry_of_import_run_id,
    failure_reason: failureReason,
    initiated_via: initiatedVia,
    initiated_by: initiatedBy,
    parser_version: preflight.parser_version,
    establishment_key: preflight.establishment ? preflight.establishment.key : '',
    audit_metadata: auditMetadata,
  };
}

/**
 * Writes a best-effort Import Run audit record — never throws. Returns the
 * new page id on success, or null with the failure surfaced separately, so
 * a Notion outage never blocks returning a preview/commit result.
 * @param {object} runData
 * @returns {Promise<{id: string|null, error: string|null}>}
 */
async function writeAuditRecord(runData) {
  try {
    const id = await createImportRun(runData);
    return { id, error: null };
  } catch (error) {
    return { id: null, error: error.code === 'CONFIG_MISSING' ? 'CONFIG_MISSING' : error.message };
  }
}

/**
 * Full read-only preflight: analysis + establishment resolution + duplicate
 * check against the Notion Import Runs audit history. Never writes
 * pilotage data. Writes a best-effort 'preview' Import Run audit record by
 * default (every execution attempt is preserved) — pass `writeAudit: false`
 * when called internally by `runCommit`, which writes its own (more
 * complete) audit record for the same attempt instead.
 * @param {{filePath?: string, buffer?: Buffer, originalFilename: string, establishmentKey: string, initiatedVia?: 'cli'|'web', initiatedBy?: string, writeAudit?: boolean}} params
 * @returns {Promise<object>} a PreflightResult
 */
async function runPreflight({
  filePath,
  buffer,
  originalFilename,
  establishmentKey,
  initiatedVia = 'cli',
  initiatedBy = '',
  writeAudit = true,
}) {
  const analysis = await analyzeDocument({ filePath, buffer, originalFilename });
  const blockingReasons = [...analysis.blocking_reasons];

  const establishment = resolveEstablishment(establishmentKey);
  if (!establishment) {
    blockingReasons.push('UNKNOWN_ESTABLISHMENT');
  }

  // Audit history vs. business dedup — see module docstring. The duplicate
  // check needs the Import Runs Notion target configured and reachable;
  // when it isn't, parsing/validation must still work — only an actual
  // confirmed 'committed' prior run ever blocks as a duplicate.
  const attemptContext = await resolveAttemptContext(analysis.file_hash);
  if (attemptContext.hasCommittedRun) {
    blockingReasons.push('DUPLICATE_FILE_ALREADY_COMMITTED');
  }

  const canBuildRows = establishment && analysis.blocking_reasons.length === 0;
  const rows = canBuildRows ? buildRowsFor(analysis, establishment.key) : null;
  const unmappedProducts =
    rows && analysis.report_kind === 'product_ranking' ? collectUnmappedProductNames(rows.productSales) : [];

  const preflight = {
    ...analysis,
    establishment,
    existing_runs: attemptContext.existingRuns,
    attempt_number: attemptContext.attemptNumber,
    retry_of_import_run_id: attemptContext.mostRecentRun ? attemptContext.mostRecentRun.importRunId : null,
    duplicate_of_committed_run: attemptContext.hasCommittedRun,
    duplicate_check_error: attemptContext.error,
    blocking_reasons: blockingReasons,
    can_commit: blockingReasons.length === 0,
    rows,
    unmapped_products: unmappedProducts,
  };

  if (!writeAudit) {
    return { ...preflight, audit_import_run_id: null, audit_write_error: null };
  }

  const runData = buildImportRunData({
    preflight,
    status: 'preview',
    rowCount: 0,
    failureReason: blockingReasons.length > 0 ? blockingReasons.join('; ') : null,
    initiatedVia,
    initiatedBy,
  });
  const audit = await writeAuditRecord(runData);

  return { ...preflight, audit_import_run_id: audit.id, audit_write_error: audit.error };
}

/**
 * Re-validates everything (via runPreflight, without its own preview audit
 * write) then, only if nothing blocks the pilotage data, checks the live
 * pilotage schemas and writes the pilotage rows. An Import Run audit record
 * is written for EVERY attempt — blocked, failed, partial, or fully
 * successful — even though pilotage rows are only ever written when
 * nothing blocks (see module docstring, "Audit trail vs. business dedup").
 * @param {{filePath?: string, buffer?: Buffer, originalFilename: string, establishmentKey: string, initiatedVia?: 'cli'|'web', initiatedBy?: string}} params
 * @returns {Promise<object>} a CommitResult: the preflight plus committed/commit_result/import_run_id/row_results
 */
async function runCommit({ filePath, buffer, originalFilename, establishmentKey, initiatedVia = 'cli', initiatedBy = '' }) {
  const preflight = await runPreflight({
    filePath,
    buffer,
    originalFilename,
    establishmentKey,
    initiatedVia,
    initiatedBy,
    writeAudit: false,
  });

  const placeholderStatus = preflight.attempt_number > 1 ? 'retry' : 'failed';

  if (!preflight.can_commit) {
    const runData = buildImportRunData({
      preflight,
      status: 'failed',
      rowCount: 0,
      failureReason: preflight.blocking_reasons.join('; '),
      initiatedVia,
      initiatedBy,
    });
    const audit = await writeAuditRecord(runData);
    return {
      ...preflight,
      mode: 'commit',
      committed: false,
      commit_result: null,
      import_run_id: audit.id,
      audit_write_error: audit.error,
      schema_check: null,
    };
  }

  const schemaResults = await checkPilotageSchemas(requiredTargetsFor(preflight));
  const schemaOk = schemaResults.every((r) => r.ok);
  if (!schemaOk) {
    const mismatchSummary = schemaResults
      .filter((r) => !r.ok)
      .map((r) => `${r.label}: ${r.reason}`)
      .join('; ');
    const runData = buildImportRunData({
      preflight,
      status: 'failed',
      rowCount: 0,
      failureReason: `SCHEMA_MISMATCH: ${mismatchSummary}`,
      initiatedVia,
      initiatedBy,
    });
    const audit = await writeAuditRecord(runData);
    return {
      ...preflight,
      mode: 'commit',
      committed: false,
      commit_result: null,
      can_commit: false,
      blocking_reasons: [...preflight.blocking_reasons, 'SCHEMA_MISMATCH'],
      import_run_id: audit.id,
      audit_write_error: audit.error,
      schema_check: schemaResults,
    };
  }

  // Created with a pessimistic placeholder status first so pilotage rows
  // have a real page id for their source_import relation from the start —
  // see module docstring for why this ordering is the crash-safe one.
  const importRunId = await createImportRun(
    buildImportRunData({ preflight, status: placeholderStatus, rowCount: 0, failureReason: null, initiatedVia, initiatedBy })
  );

  let rowResults = [];
  if (preflight.rows) {
    rowResults = await writeAllPilotageRows(preflight.rows, importRunId);
  }

  const summary = summarizeResults(rowResults);
  // blocked_precedence rows (spec v3 §6) count as "did not succeed" here,
  // same as failed — this is a defensive second layer only (the primary
  // precedence check already blocks the whole commit at preflight, before
  // any write is attempted; this only fires if state changed between
  // preflight and commit, e.g. a concurrent AddicTill commit landed first).
  const notSucceeded = summary.failed + summary.blocked_precedence;
  const commitResult =
    notSucceeded === 0 ? 'success' : summary.created + summary.updated + summary.skipped > 0 ? 'partial_failure' : 'failed';
  const finalStatus = commitResult === 'success' ? 'committed' : commitResult;
  const failureReason =
    commitResult === 'success'
      ? null
      : rowResults
          .filter((r) => r.status === 'failed' || r.status === 'blocked_precedence')
          .map((r) => `${r.targetKey}/${r.importKey}: ${r.reason}`)
          .join('; ');

  await updateImportRunResult(importRunId, { status: finalStatus, row_count: rowResults.length, failure_reason: failureReason });

  return {
    ...preflight,
    mode: 'commit',
    committed: true,
    commit_result: commitResult,
    import_run_id: importRunId,
    row_results: rowResults,
    row_summary: summary,
    schema_check: schemaResults,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// scan-z secondary source (spec v3) — deliberately kept as separate
// functions rather than folded into runPreflight/runCommit above. scan-z's
// input (an image, no filePath/buffer-of-a-structured-document), its
// classification (trivial — the caller explicitly chose the scan-z tool,
// there is no ambiguity for classify.js's text-based rules to resolve),
// and its commit flow (a signed token stands in for re-parsing, since
// vision is never re-run) all differ meaningfully from the generic path.
// Keeping them separate guarantees the existing runPreflight/runCommit
// (AddicTill, bank statements) are entirely unaffected by this feature —
// see "preserve backward compatibility" in the approved implementation
// constraints.
// ─────────────────────────────────────────────────────────────────────────

/**
 * @param {import('../schemas').ScanZRawOcrValues} raw
 * @returns {object} the `ocr` section of an audit_metadata payload (see audit-metadata.js)
 */
function buildOcrAuditSection(raw, confidence) {
  return {
    confidence_reported: raw.ocr_confidence,
    confidence_computed: confidence.finalConfidence,
    resume: raw.resume,
    raw_values: {
      date: raw.date,
      total_ttc_cents: raw.total_ttc_cents,
      ticket_count: raw.ticket_count,
      product_line_count: raw.product_lines.length,
    },
    deterministic_checks: raw.checks,
  };
}

/**
 * @param {object|null} precedence - result of checkAuthority, plus existingSourceSubtype, or null when no existing row
 * @param {string} action
 * @returns {object}
 */
function buildReconciliationSection(precedence, action) {
  return {
    conflict_detected: precedence ? precedence.blocked : false,
    existing_source_subtype: precedence ? precedence.existingSourceSubtype : null,
    existing_authority: precedence ? precedence.existingAuthority : null,
    incoming_authority: precedence ? precedence.incomingAuthority : resolveAuthority('scanz_ocr_summary'),
    action,
  };
}

/**
 * Fetches the current Daily Operations row for this business key (if any)
 * and runs the source-authority precedence check + field diff against it
 * — the same authority logic pilotage-writer.js applies at actual write
 * time, run here ahead of time so both preflight and commit can surface
 * "this will conflict"/"this will change these fields" before any write is
 * attempted. Never throws — a Notion failure (e.g. CONFIG_MISSING) degrades
 * to "no precedence information available", never blocks.
 * @param {import('./row-builders').DailyOperationsRow} dailyOperationRow
 * @returns {Promise<{blocked: boolean, existingSourceSubtype: string|null, existingAuthority: number, incomingAuthority: number, diff: object[], error: string|null}>}
 */
async function checkDailyOperationsPrecedence(dailyOperationRow) {
  try {
    const existing = await findByProperty('daily_operations', 'import_key', dailyOperationRow.import_key);
    if (!existing) {
      return {
        blocked: false,
        existingSourceSubtype: null,
        existingAuthority: 0,
        incomingAuthority: resolveAuthority(dailyOperationRow.source_subtype),
        diff: [],
        error: null,
      };
    }
    const authority = checkAuthority('daily_operations', dailyOperationRow, existing.properties);
    const diff = computeRowDiff('daily_operations', dailyOperationRow, existing.properties);
    return { ...authority, diff, error: null };
  } catch (error) {
    return {
      blocked: false,
      existingSourceSubtype: null,
      existingAuthority: 0,
      incomingAuthority: resolveAuthority(dailyOperationRow.source_subtype),
      diff: [],
      error: error.code === 'CONFIG_MISSING' ? 'CONFIG_MISSING' : error.message,
    };
  }
}

/**
 * scan-z read-only preview (spec v3). Runs the vision call exactly once,
 * builds the normalized statement + composite confidence, checks
 * establishment/duplicate/source-authority precedence, mints a signed
 * preflight token binding the raw OCR values, and writes a best-effort
 * 'preview' Import Run audit record — mirroring runPreflight's contract
 * for every other source. Disabled by default; returns a clear
 * `SCANZ_DISABLED` blocking reason unless `IMPORTS_SCANZ_ENABLED=true`.
 * @param {{imageBuffer: Buffer, mimeType: string, originalFilename: string, establishmentKey: string, initiatedVia?: 'cli'|'web', initiatedBy?: string, callClaude?: Function}} params
 * @returns {Promise<object>}
 */
async function runScanZPreflight({
  imageBuffer,
  mimeType,
  originalFilename,
  establishmentKey,
  initiatedVia = 'cli',
  initiatedBy = '',
  callClaude,
}) {
  if (!isScanZEnabled()) {
    return {
      scanz_enabled: false,
      source_type: 'pos_export',
      source_subtype: 'scanz_ocr_summary',
      can_commit: false,
      blocking_reasons: ['SCANZ_DISABLED'],
      validation: { valid: false, errors: [], warnings: [] },
      statement: null,
      rows: null,
      preflight_token: null,
    };
  }

  const fileHash = computeFileHashFromBuffer(imageBuffer);
  const ocrResult = await runScanZOcr({ buffer: imageBuffer, mimeType, callClaude });

  const blockingReasons = [];
  if (!ocrResult.validation.valid) blockingReasons.push('VALIDATION_ERRORS');

  const establishment = resolveEstablishment(establishmentKey);
  if (!establishment) blockingReasons.push('UNKNOWN_ESTABLISHMENT');

  const attemptContext = await resolveAttemptContext(fileHash);
  if (attemptContext.hasCommittedRun) blockingReasons.push('DUPLICATE_FILE_ALREADY_COMMITTED');

  let rows = null;
  let precedence = null;
  if (establishment && ocrResult.validation.valid) {
    rows = buildDailySummaryRows(ocrResult.statement, {
      establishmentKey: establishment.key,
      sourceType: 'pos_export',
      sourceSubtype: 'scanz_ocr_summary',
    });
    if (rows.dailyOperations.length > 0) {
      precedence = await checkDailyOperationsPrecedence(rows.dailyOperations[0]);
      if (precedence.blocked) blockingReasons.push('PRECEDENCE_CONFLICT');
    }
  }

  const canCommit = blockingReasons.length === 0;

  let preflightToken = null;
  let preflightTokenError = null;
  try {
    preflightToken = mintPreflightToken({
      file_hash_sha256: fileHash,
      source_subtype: 'scanz_ocr_summary',
      establishment_key: establishment ? establishment.key : '',
      ocr_raw_values: ocrResult.raw,
    });
  } catch (error) {
    preflightTokenError = error.code === 'CONFIG_MISSING' ? 'CONFIG_MISSING' : error.message;
  }

  const preflight = {
    scanz_enabled: true,
    file_hash: fileHash,
    original_filename: originalFilename,
    source_type: 'pos_export',
    source_subtype: 'scanz_ocr_summary',
    report_kind: 'daily_summary',
    statement: ocrResult.statement,
    validation: ocrResult.validation,
    confidence: ocrResult.confidence,
    raw_ocr: ocrResult.raw,
    establishment,
    period_start: ocrResult.raw.date,
    period_end: ocrResult.raw.date,
    attempt_number: attemptContext.attemptNumber,
    retry_of_import_run_id: attemptContext.mostRecentRun ? attemptContext.mostRecentRun.importRunId : null,
    duplicate_of_committed_run: attemptContext.hasCommittedRun,
    duplicate_check_error: attemptContext.error,
    precedence,
    blocking_reasons: blockingReasons,
    can_commit: canCommit,
    rows,
    preflight_token: preflightToken,
    preflight_token_error: preflightTokenError,
    parser_version: SCANZ_PARSER_VERSION,
  };

  const auditMetadata = buildAuditMetadataString({
    ocr: buildOcrAuditSection(ocrResult.raw, ocrResult.confidence),
    review: null,
    warnings: ocrResult.validation.warnings,
    reconciliation: buildReconciliationSection(precedence, canCommit ? 'preview' : 'preview_blocked'),
  });

  const runData = buildImportRunData({
    preflight,
    status: 'preview',
    rowCount: 0,
    failureReason: blockingReasons.length > 0 ? blockingReasons.join('; ') : null,
    initiatedVia,
    initiatedBy,
    auditMetadata,
  });
  const audit = await writeAuditRecord(runData);

  return { ...preflight, audit_import_run_id: audit.id, audit_write_error: audit.error };
}

/**
 * scan-z commit (spec v3). Verifies the signed preflight token BEFORE
 * trusting any of its contents — an invalid signature never has its
 * payload parsed or used; only independently-trusted inputs (the
 * recomputed file hash, the authenticated caller, the request's own
 * establishmentKey) go into the minimal Import Run recorded for that case.
 * A valid-but-expired token's payload is used to record a clear
 * PREFLIGHT_TOKEN_EXPIRED failure, still with zero pilotage writes. Never
 * re-invokes Claude vision — the token's embedded raw OCR values are
 * combined with the human-reviewed `finalValues` instead.
 * @param {{imageBuffer: Buffer, originalFilename: string, establishmentKey: string, preflightToken: string, finalValues: {date: string|null, total_ttc: number|null, total_ht?: number|null, ca_ttc?: number|null, ticket_count: number|null}, initiatedVia?: 'cli'|'web', initiatedBy?: string}} params
 * @returns {Promise<object>}
 */
async function runScanZCommit({
  imageBuffer,
  originalFilename,
  establishmentKey,
  preflightToken,
  finalValues,
  initiatedVia = 'cli',
  initiatedBy = '',
}) {
  if (!isScanZEnabled()) {
    return {
      scanz_enabled: false,
      committed: false,
      commit_result: null,
      can_commit: false,
      blocking_reasons: ['SCANZ_DISABLED'],
      import_run_id: null,
    };
  }

  const fileHash = computeFileHashFromBuffer(imageBuffer);
  const verification = verifyPreflightToken(preflightToken);

  // ── Signature invalid (or malformed/unconfigured): never trust the
  // payload, not even to inspect it. Only independently-trusted inputs
  // (recomputed hash, authenticated caller, this request's own
  // establishmentKey) go into a minimal audit record. ──────────────────
  if (!verification.ok) {
    console.error(
      `[scan-z] preflight token rejected (${verification.reason}) — file_hash=${fileHash}, initiated_by=${initiatedBy || '(unknown)'}`
    );

    const attemptContext = await resolveAttemptContext(fileHash);
    const minimalRunData = {
      import_run_id: `${fileHash}-${Date.now()}`,
      source_type: 'pos_export',
      source_subtype: 'scanz_ocr_summary',
      original_filename: originalFilename || 'scan-z-photo',
      file_hash_sha256: fileHash,
      imported_at: new Date().toISOString(),
      period_start: null,
      period_end: null,
      validation_status: 'invalid',
      warning_count: 0,
      error_count: 1,
      row_count: 0,
      status: 'failed',
      attempt_number: attemptContext.attemptNumber,
      retry_of_import_run_id: attemptContext.mostRecentRun ? attemptContext.mostRecentRun.importRunId : null,
      failure_reason: `PREFLIGHT_TOKEN_${verification.reason}`,
      initiated_via: initiatedVia,
      initiated_by: initiatedBy,
      parser_version: SCANZ_PARSER_VERSION,
      establishment_key: typeof establishmentKey === 'string' ? establishmentKey : '',
      audit_metadata: buildAuditMetadataString({
        reconciliation: { conflict_detected: false, existing_source_subtype: null, existing_authority: null, incoming_authority: null, action: 'token_rejected' },
      }),
    };

    const audit = await writeAuditRecord(minimalRunData);
    return {
      scanz_enabled: true,
      committed: false,
      commit_result: null,
      can_commit: false,
      blocking_reasons: [`PREFLIGHT_TOKEN_${verification.reason}`],
      import_run_id: audit.id,
      audit_write_error: audit.error,
    };
  }

  const payload = verification.payload;

  // ── Signature valid — now check the bindings before trusting the
  // payload's business meaning (still never touching pilotage data). ───
  const bindingMismatch =
    payload.file_hash_sha256 !== fileHash
      ? 'PREFLIGHT_TOKEN_FILE_MISMATCH'
      : payload.establishment_key !== establishmentKey
        ? 'PREFLIGHT_TOKEN_ESTABLISHMENT_MISMATCH'
        : payload.source_subtype !== 'scanz_ocr_summary'
          ? 'PREFLIGHT_TOKEN_SUBTYPE_MISMATCH'
          : null;

  const attemptContext = await resolveAttemptContext(fileHash);

  if (bindingMismatch || verification.expired) {
    const reason = bindingMismatch || 'PREFLIGHT_TOKEN_EXPIRED';
    const runData = {
      import_run_id: `${fileHash}-${Date.now()}`,
      source_type: 'pos_export',
      source_subtype: 'scanz_ocr_summary',
      original_filename: originalFilename || 'scan-z-photo',
      file_hash_sha256: fileHash,
      imported_at: new Date().toISOString(),
      period_start: payload.ocr_raw_values.date,
      period_end: payload.ocr_raw_values.date,
      validation_status: 'invalid',
      warning_count: 0,
      error_count: 1,
      row_count: 0,
      status: 'failed',
      attempt_number: attemptContext.attemptNumber,
      retry_of_import_run_id: attemptContext.mostRecentRun ? attemptContext.mostRecentRun.importRunId : null,
      failure_reason: reason,
      initiated_via: initiatedVia,
      initiated_by: initiatedBy,
      parser_version: SCANZ_PARSER_VERSION,
      establishment_key: payload.establishment_key,
      audit_metadata: buildAuditMetadataString({
        ocr: buildOcrAuditSection(payload.ocr_raw_values, { finalConfidence: null }),
        reconciliation: { conflict_detected: false, existing_source_subtype: null, existing_authority: null, incoming_authority: null, action: reason },
      }),
    };
    const audit = await writeAuditRecord(runData);
    return {
      scanz_enabled: true,
      committed: false,
      commit_result: null,
      can_commit: false,
      blocking_reasons: [reason],
      import_run_id: audit.id,
      audit_write_error: audit.error,
    };
  }

  // ── Token fully trusted from here on. Re-validate everything server
  // side, exactly as the generic runCommit does — never trust that
  // preflight's own can_commit still holds. ────────────────────────────
  const blockingReasons = [];

  const finalValidation = validateFinalValues(finalValues);
  if (!finalValidation.valid) blockingReasons.push('VALIDATION_ERRORS');

  const establishment = resolveEstablishment(establishmentKey);
  if (!establishment) blockingReasons.push('UNKNOWN_ESTABLISHMENT');

  if (attemptContext.hasCommittedRun) blockingReasons.push('DUPLICATE_FILE_ALREADY_COMMITTED');

  const statement = {
    source_type: 'scanz_ocr_summary',
    raw: payload.ocr_raw_values,
    days: [
      {
        date: finalValidation.dateIso,
        ticket_count: finalValues?.ticket_count ?? null,
        total_ttc_cents: typeof finalValues?.total_ttc === 'number' ? scanZToCents(finalValues.total_ttc) : null,
        total_ht_cents: typeof finalValues?.total_ht === 'number' ? scanZToCents(finalValues.total_ht) : null,
        ca_ttc_cents: typeof finalValues?.ca_ttc === 'number' ? scanZToCents(finalValues.ca_ttc) : null,
        clients_count: null,
        payments: [],
      },
    ],
  };

  const validation = {
    valid: finalValidation.valid,
    errors: finalValidation.errors,
    warnings: [],
  };

  const correctedFields = computeCorrectedFields(payload.ocr_raw_values, finalValues);

  let rows = null;
  let precedence = null;
  if (establishment && finalValidation.valid) {
    rows = buildDailySummaryRows(statement, {
      establishmentKey: establishment.key,
      sourceType: 'pos_export',
      sourceSubtype: 'scanz_ocr_summary',
    });
    if (rows.dailyOperations.length > 0) {
      precedence = await checkDailyOperationsPrecedence(rows.dailyOperations[0]);
      if (precedence.blocked) blockingReasons.push('PRECEDENCE_CONFLICT');
    }
  }

  const preflightLike = {
    file_hash: fileHash,
    original_filename: originalFilename || 'scan-z-photo',
    source_type: 'pos_export',
    source_subtype: 'scanz_ocr_summary',
    period_start: finalValidation.dateIso,
    period_end: finalValidation.dateIso,
    validation,
    establishment,
    attempt_number: attemptContext.attemptNumber,
    retry_of_import_run_id: attemptContext.mostRecentRun ? attemptContext.mostRecentRun.importRunId : null,
    parser_version: SCANZ_PARSER_VERSION,
  };

  const reviewSection = {
    reviewed_at: new Date().toISOString(),
    reviewed_by: initiatedBy,
    final_values: finalValues,
    corrected_fields: correctedFields,
  };

  const canCommit = blockingReasons.length === 0;

  if (!canCommit) {
    const auditMetadata = buildAuditMetadataString({
      ocr: buildOcrAuditSection(payload.ocr_raw_values, { finalConfidence: null }),
      review: reviewSection,
      warnings: validation.warnings,
      reconciliation: buildReconciliationSection(precedence, 'blocked'),
    });
    const runData = buildImportRunData({
      preflight: preflightLike,
      status: 'blocked',
      rowCount: 0,
      failureReason: blockingReasons.join('; '),
      initiatedVia,
      initiatedBy,
      auditMetadata,
    });
    const audit = await writeAuditRecord(runData);
    return {
      committed: false,
      commit_result: null,
      can_commit: false,
      blocking_reasons: blockingReasons,
      precedence,
      corrected_fields: correctedFields,
      import_run_id: audit.id,
      audit_write_error: audit.error,
    };
  }

  const schemaResults = await checkPilotageSchemas(['import_runs', 'daily_operations', 'payment_methods']);
  const schemaOk = schemaResults.every((r) => r.ok);
  if (!schemaOk) {
    const mismatchSummary = schemaResults
      .filter((r) => !r.ok)
      .map((r) => `${r.label}: ${r.reason}`)
      .join('; ');
    const auditMetadata = buildAuditMetadataString({
      ocr: buildOcrAuditSection(payload.ocr_raw_values, { finalConfidence: null }),
      review: reviewSection,
      warnings: validation.warnings,
      reconciliation: buildReconciliationSection(precedence, 'schema_mismatch'),
    });
    const runData = buildImportRunData({
      preflight: preflightLike,
      status: 'failed',
      rowCount: 0,
      failureReason: `SCHEMA_MISMATCH: ${mismatchSummary}`,
      initiatedVia,
      initiatedBy,
      auditMetadata,
    });
    const audit = await writeAuditRecord(runData);
    return {
      committed: false,
      commit_result: null,
      can_commit: false,
      blocking_reasons: [...blockingReasons, 'SCHEMA_MISMATCH'],
      import_run_id: audit.id,
      audit_write_error: audit.error,
      schema_check: schemaResults,
    };
  }

  const placeholderStatus = attemptContext.attemptNumber > 1 ? 'retry' : 'failed';
  const placeholderAuditMetadata = buildAuditMetadataString({
    ocr: buildOcrAuditSection(payload.ocr_raw_values, { finalConfidence: null }),
    review: reviewSection,
    warnings: validation.warnings,
    reconciliation: buildReconciliationSection(precedence, 'committing'),
  });
  const importRunId = await createImportRun(
    buildImportRunData({
      preflight: preflightLike,
      status: placeholderStatus,
      rowCount: 0,
      failureReason: null,
      initiatedVia,
      initiatedBy,
      auditMetadata: placeholderAuditMetadata,
    })
  );

  let rowResults = [];
  if (rows) {
    rowResults = await writeAllPilotageRows(rows, importRunId);
  }

  const summary = summarizeResults(rowResults);
  const notSucceeded = summary.failed + summary.blocked_precedence;
  const commitResult = notSucceeded === 0 ? 'success' : summary.created + summary.updated + summary.skipped > 0 ? 'partial_failure' : 'failed';
  const finalStatus = commitResult === 'success' ? 'committed' : commitResult;
  const failureReason =
    commitResult === 'success'
      ? null
      : rowResults
          .filter((r) => r.status === 'failed' || r.status === 'blocked_precedence')
          .map((r) => `${r.targetKey}/${r.importKey}: ${r.reason}`)
          .join('; ');

  const finalAuditMetadata = buildAuditMetadataString({
    ocr: buildOcrAuditSection(payload.ocr_raw_values, { finalConfidence: null }),
    review: reviewSection,
    warnings: validation.warnings,
    reconciliation: buildReconciliationSection(precedence, commitResult === 'success' ? 'committed' : commitResult),
  });

  await updateImportRunResult(importRunId, {
    status: finalStatus,
    row_count: rowResults.length,
    failure_reason: failureReason,
    audit_metadata: finalAuditMetadata,
  });

  return {
    committed: true,
    commit_result: commitResult,
    can_commit: true,
    blocking_reasons: [],
    import_run_id: importRunId,
    row_results: rowResults,
    row_summary: summary,
    corrected_fields: correctedFields,
    precedence,
    schema_check: schemaResults,
    audit_metadata_preview: finalAuditMetadata,
  };
}

module.exports = {
  analyzeDocument,
  buildRowsFor,
  requiredTargetsFor,
  resolveAttemptContext,
  runPreflight,
  runCommit,
  buildImportRunData,
  isScanZEnabled,
  runScanZPreflight,
  runScanZCommit,
};
