'use strict';

/**
 * Import run logging: one structured JSON log per CLI invocation, written
 * to imports/logs/YYYY-MM-DD/<import_run_id>.json, per AGENTS.md
 * "JOURNAL D'IMPORT". In PR1 there are no file moves or Notion writes yet,
 * so rows_created/rows_updated/rows_skipped stay at 0 — they become
 * meaningful starting PR4.
 */

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const { IMPORTER_VERSION } = require('./schemas');

/**
 * @typedef {Object} RunFileEntry
 * @property {string} source_file
 * @property {string} file_hash
 * @property {'pdf'|'xlsx'|'csv'|'unknown'} detected_file_type
 * @property {'bank_statement'|'pos_export'|'monthly_performance'|'unknown'} detected_document_type
 * @property {number} classification_confidence
 * @property {'rules'|'claude'} classified_by
 * @property {'auto'|'review_required'|'rejected'|'duplicate'} status
 * @property {string|null} pos_source_hint
 * @property {string[]} warnings
 * @property {string[]} errors
 */

/**
 * Creates a new import run logger. Call `recordFile` once per processed
 * file, then `finalize()` to get the full log object to persist.
 * @param {{mode: 'dry-run'|'commit'}} params
 */
function createRunLogger({ mode }) {
  const runId = randomUUID();
  const startedAt = new Date();
  /** @type {RunFileEntry[]} */
  const files = [];
  const warnings = [];
  const errors = [];

  return {
    runId,
    mode,

    /** @param {RunFileEntry} entry */
    recordFile(entry) {
      files.push(entry);
    },

    /** @param {string} message */
    addWarning(message) {
      warnings.push(message);
    },

    /** @param {string} message */
    addError(message) {
      errors.push(message);
    },

    finalize() {
      const finishedAt = new Date();
      const summary = { auto: 0, review_required: 0, rejected: 0, duplicate: 0 };
      for (const file of files) {
        if (Object.prototype.hasOwnProperty.call(summary, file.status)) {
          summary[file.status] += 1;
        }
      }

      return {
        schema_version: '1.0',
        import_run_id: runId,
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        mode,
        files_detected: files.length,
        files,
        summary,
        rows_created: 0,
        rows_updated: 0,
        rows_skipped: 0,
        warnings,
        errors,
        importer_version: IMPORTER_VERSION,
      };
    },
  };
}

/**
 * Persists a finalized run log to imports/logs/YYYY-MM-DD/<import_run_id>.json.
 * @param {ReturnType<ReturnType<typeof createRunLogger>['finalize']>} runLog
 * @param {{logsDir?: string}} [options]
 * @returns {string} the written file's path
 */
function writeRunLog(runLog, options = {}) {
  const logsDir = options.logsDir ?? path.join(process.cwd(), 'imports', 'logs');
  const dateFolder = runLog.started_at.slice(0, 10);
  const dir = path.join(logsDir, dateFolder);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${runLog.import_run_id}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(runLog, null, 2)}\n`, 'utf8');
  return filePath;
}

module.exports = { createRunLogger, writeRunLog };
