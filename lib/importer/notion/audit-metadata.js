'use strict';

/**
 * Compact, size-bounded `audit_metadata` construction for Import Runs
 * (scan-z secondary source, spec v3 §4). Pure and total: for any input,
 * deterministically produces a JSON string of at most
 * MAX_AUDIT_METADATA_LENGTH characters, in a fixed reduction order, never
 * throwing — an oversized payload must never fail the Import Run write,
 * still less the whole commit.
 *
 * Holds: OCR summary (self-reported + computed confidence, raw values,
 * deterministic-check results), human review (raw-vs-final diff, who,
 * when), non-blocking warnings, and cross-source reconciliation context.
 * Deliberately separate from `failure_reason`, which stays reserved
 * exclusively for actual failures (see docs/ARCHITECTURE.md "scan-z
 * secondary source" §3/§4) — this field carries context for every
 * outcome, including a fully successful commit.
 *
 * Full per-product OCR line items are never retained here at any
 * truncation level — not a size-driven omission, a standing rule: that
 * detail is never written to any pilotage table, so it has no long-term
 * audit value either.
 */

const SCHEMA_VERSION = '1.0';
const MAX_AUDIT_METADATA_LENGTH = 1900;
const MAX_WARNINGS_KEPT = 3;
const MAX_WARNING_LENGTH = 80;

/**
 * @param {string} json
 * @returns {number}
 */
function serialize(obj) {
  return JSON.stringify(obj);
}

/**
 * @param {string[]} warnings
 * @returns {string[]}
 */
function truncateWarnings(warnings) {
  return (warnings ?? []).slice(0, MAX_WARNINGS_KEPT).map((w) => (String(w).length > MAX_WARNING_LENGTH ? `${String(w).slice(0, MAX_WARNING_LENGTH - 3)}...` : String(w)));
}

/**
 * @param {Record<string, boolean>|undefined} checks
 * @returns {{passed: number, total: number}|null}
 */
function summarizeChecks(checks) {
  if (!checks || typeof checks !== 'object') return null;
  const values = Object.values(checks).filter((v) => typeof v === 'boolean');
  return { passed: values.filter(Boolean).length, total: values.length };
}

/**
 * Bounds an arbitrary final_values object to a small fixed budget — used
 * only in the last-resort fallback shape (level 4), where the guarantee
 * that the WHOLE payload fits must not depend on the caller having
 * supplied a reasonably-sized object (defensive-in-depth: normal usage
 * never approaches this, but the guarantee must hold regardless).
 * @param {object|undefined} finalValues
 * @returns {object}
 */
function boundedFinalValues(finalValues) {
  const json = serialize(finalValues ?? {});
  return json.length <= 400 ? (finalValues ?? {}) : { note: 'omitted (too large)' };
}

/**
 * @param {string[]|undefined} correctedFields
 * @returns {string[]}
 */
function boundedCorrectedFields(correctedFields) {
  return (correctedFields ?? []).slice(0, 10).map((f) => String(f).slice(0, 40));
}

/**
 * @typedef {Object} AuditMetadataInput
 * @property {{confidence_reported: string, confidence_computed: number, resume: string, raw_values: object, deterministic_checks: object}|null} [ocr]
 * @property {{reviewed_at: string, reviewed_by: string, final_values: object, corrected_fields: string[]}|null} [review]
 * @property {string[]} [warnings]
 * @property {{conflict_detected: boolean, existing_source_subtype: string|null, existing_authority: number|null, incoming_authority: number, action: string}|null} [reconciliation]
 */

/**
 * @param {AuditMetadataInput} input
 * @returns {{json: string, truncated: boolean, omittedSections: string[]}}
 */
function compactAuditMetadata(input = {}) {
  const fullOcr = input.ocr
    ? {
        confidence_reported: input.ocr.confidence_reported ?? null,
        confidence_computed: input.ocr.confidence_computed ?? null,
        resume: input.ocr.resume ?? '',
        raw_values: input.ocr.raw_values ?? {},
        deterministic_checks: input.ocr.deterministic_checks ?? {},
      }
    : null;

  const level0 = {
    ocr: fullOcr,
    review: input.review ?? null,
    warnings: input.warnings ?? [],
    reconciliation: input.reconciliation ?? null,
  };
  const level1 = { ...level0, ocr: fullOcr ? { ...fullOcr, resume: '' } : null };
  const level2 = { ...level1, warnings: truncateWarnings(input.warnings) };
  const level3 = {
    ...level2,
    ocr: level2.ocr ? { ...level2.ocr, deterministic_checks: summarizeChecks(input.ocr?.deterministic_checks) } : null,
  };

  const levels = [
    { body: level0, omitted: [] },
    { body: level1, omitted: ['ocr.resume'] },
    { body: level2, omitted: ['ocr.resume', 'warnings'] },
    { body: level3, omitted: ['ocr.resume', 'warnings', 'ocr.deterministic_checks'] },
  ];

  for (let i = 0; i < levels.length; i += 1) {
    const truncated = i > 0;
    const candidate = { schema_version: SCHEMA_VERSION, truncated, omitted_sections: levels[i].omitted, ...levels[i].body };
    const json = serialize(candidate);
    if (json.length <= MAX_AUDIT_METADATA_LENGTH) {
      return { json, truncated, omittedSections: levels[i].omitted };
    }
  }

  // Final fallback: a fixed, deliberately tiny shape. Every field is
  // independently bounded (not just "usually small") so the size
  // guarantee never depends on the caller having supplied a reasonably
  // sized `review`/`reconciliation` — defensive-in-depth, since normal
  // usage never gets anywhere near this fallback at all.
  const omittedSections = ['all'];
  const minimal = {
    schema_version: SCHEMA_VERSION,
    truncated: true,
    omitted_sections: omittedSections,
    review: input.review
      ? { final_values: boundedFinalValues(input.review.final_values), corrected_fields: boundedCorrectedFields(input.review.corrected_fields) }
      : null,
    reconciliation: input.reconciliation ? { action: String(input.reconciliation.action ?? '').slice(0, 40) } : null,
  };
  const minimalJson = serialize(minimal);
  if (minimalJson.length <= MAX_AUDIT_METADATA_LENGTH) {
    return { json: minimalJson, truncated: true, omittedSections };
  }

  // Absolute last resort — a fixed-size constant shape, mathematically
  // guaranteed to fit regardless of any input whatsoever.
  return {
    json: serialize({ schema_version: SCHEMA_VERSION, truncated: true, omitted_sections: ['all'] }),
    truncated: true,
    omittedSections: ['all'],
  };
}

/**
 * @param {AuditMetadataInput} input
 * @returns {string} the compact JSON string ready to write to Import Runs' `audit_metadata`
 */
function buildAuditMetadataString(input) {
  return compactAuditMetadata(input).json;
}

module.exports = {
  SCHEMA_VERSION,
  MAX_AUDIT_METADATA_LENGTH,
  compactAuditMetadata,
  buildAuditMetadataString,
};
