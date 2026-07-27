'use strict';

/**
 * scan-z OCR parser (secondary source, spec v3) — turns a photographed
 * Z-report into the same normalized shape AddicTill's daily-summary parser
 * produces, via a single Claude vision call. Deliberately narrow:
 *
 *  - never manufactures total_ht_cents/ca_ttc_cents (§2) — a Z receipt
 *    doesn't encode them, so they stay null unless a human enters a real
 *    figure during review;
 *  - never maps to Product Sales/Sales Categories (out of scope);
 *  - OCR confidence is never trusted from the model alone (§7) — combined
 *    with deterministic checks computed here in code;
 *  - the vision call happens exactly once, at preflight — never re-run at
 *    commit (see commit-pipeline.js's runScanZCommit, which reuses the
 *    verified preflight token's embedded raw values instead).
 *
 * See docs/ARCHITECTURE.md "scan-z secondary source" for the full design.
 */

const { parseDate } = require('../validate');

const PARSER_VERSION = 'scanz-v1.0.0';

// Static fallback ceiling for "unusually high" ticket counts, used when no
// establishment history is available to derive a dynamic one (spec v3 §7
// describes an optional dynamic ceiling from trailing Daily Operations
// history — not implemented in this version; see docs/ARCHITECTURE.md
// "scan-z secondary source" "Deviations from v3" for why).
const DEFAULT_TICKET_COUNT_CEILING = 500;

// Vocabulary a genuine Z-report is expected to print somewhere — used only
// as a deterministic sanity check (does the model's own label list
// intersect this), never as a document-type classifier on its own.
const EXPECTED_LABELS = ['TOTAL', 'NOMBRE DE TICKETS', 'NOMBRE TICKETS', 'TICKETS', 'DATE', 'Z', 'CLOTURE'];

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

const RESPONSE_TOLERANCE_CENTS = 100; // 1.00 EUR — tolerance for the two consistency/reconciliation checks

/**
 * Strips markdown code fences a model may wrap its JSON in, then parses it.
 * Mirrors classify.js's parseClaudeJson.
 * @param {string} rawText
 * @returns {*}
 */
function parseClaudeVisionJson(rawText) {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(stripped);
}

/**
 * Default Claude vision caller. Injectable so tests never make a network
 * call — see classify.js's defaultCallClaude for the identical pattern.
 * @param {{imageBase64: string, mimeType: string}} input
 * @param {string} apiKey
 * @returns {Promise<string>} raw text response from Claude
 */
async function defaultCallClaudeVision({ imageBase64, mimeType }, apiKey) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic(apiKey ? { apiKey } : {});

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
          {
            type: 'text',
            text:
              `Tu es un assistant de restaurant. Analyse cette photo d'un Z de caisse (relevé de clôture ` +
              `journalière) et extrais les informations avec précision. Ne jamais inventer une valeur que tu ne ` +
              `peux pas lire — mets null dans ce cas.\n\n` +
              `Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, avec exactement cette structure :\n` +
              `{\n` +
              `  "date": "YYYY-MM-DD ou null si illisible",\n` +
              `  "total_ttc": nombre en euros (le total général affiché) ou null,\n` +
              `  "total_ttc_alt": nombre en euros — relis le total en additionnant indépendamment les sous-totaux ` +
              `visibles (par catégorie/mode) plutôt que de recopier le total général ; null si aucun sous-total n'est visible,\n` +
              `  "nb_transactions": nombre entier de tickets/transactions ou null,\n` +
              `  "produits": [{"nom": "...", "quantite": nombre ou null, "total": nombre en euros ou null}],\n` +
              `  "ocr_confidence": "high" ou "medium" ou "low" — ta confiance globale dans cette lecture,\n` +
              `  "image_quality": "good" ou "poor" — qualité/lisibilité de la photo elle-même,\n` +
              `  "labels_detected": ["libellés exacts que tu vois effectivement imprimés, ex: TOTAL, NOMBRE DE TICKETS"],\n` +
              `  "resume": "résumé en 1-2 phrases de ce Z de caisse"\n` +
              `}`,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock ? textBlock.text : '';
}

/**
 * @param {number} amount - plain currency units (euros)
 * @returns {number} integer cents
 */
function toCents(amount) {
  return Math.round(amount * 100);
}

/**
 * Deterministic checks (spec v3 §7) — computed by the app, never trusted
 * from the model's own say-so alone (except image_quality, which is
 * inherently a model judgment, but constrained to an enforced enum and
 * subject to a hard rule below, not freely trusted text).
 * @param {object} rawJson - parsed Claude vision response
 * @param {{ticketCountCeiling?: number}} [options]
 * @returns {import('../schemas').ScanZOcrChecks}
 */
function computeDeterministicChecks(rawJson, { ticketCountCeiling = DEFAULT_TICKET_COUNT_CEILING } = {}) {
  const dateResult = typeof rawJson.date === 'string' ? parseDate(rawJson.date) : { ok: false };

  const ttcValid = typeof rawJson.total_ttc === 'number' && Number.isFinite(rawJson.total_ttc) && rawJson.total_ttc > 0;

  const ticketCountStructurallyValid =
    typeof rawJson.nb_transactions === 'number' &&
    Number.isInteger(rawJson.nb_transactions) &&
    rawJson.nb_transactions > 0;
  const ticketCountPlausible = ticketCountStructurallyValid && rawJson.nb_transactions <= ticketCountCeiling;

  const labelsDetected = Array.isArray(rawJson.labels_detected) ? rawJson.labels_detected : [];
  const expectedLabelsPresent = labelsDetected.some((label) =>
    EXPECTED_LABELS.some((expected) => String(label).toUpperCase().includes(expected))
  );

  const imageQuality = rawJson.image_quality === 'poor' ? 'poor' : 'good';

  let repeatedValueConsistent = true;
  if (ttcValid && typeof rawJson.total_ttc_alt === 'number' && Number.isFinite(rawJson.total_ttc_alt)) {
    repeatedValueConsistent = Math.abs(toCents(rawJson.total_ttc) - toCents(rawJson.total_ttc_alt)) <= RESPONSE_TOLERANCE_CENTS;
  }

  let lineTotalReconciled = true;
  const productLines = Array.isArray(rawJson.produits) ? rawJson.produits : [];
  const linesWithTotal = productLines.filter((p) => typeof p?.total === 'number' && Number.isFinite(p.total));
  if (ttcValid && linesWithTotal.length > 0) {
    const sumCents = linesWithTotal.reduce((sum, p) => sum + toCents(p.total), 0);
    lineTotalReconciled = Math.abs(sumCents - toCents(rawJson.total_ttc)) <= RESPONSE_TOLERANCE_CENTS;
  }

  return {
    date_valid: dateResult.ok === true,
    ttc_valid: ttcValid,
    ticket_count_plausible: ticketCountPlausible,
    expected_labels_present: expectedLabelsPresent,
    image_quality: imageQuality,
    repeated_value_consistent: repeatedValueConsistent,
    line_total_reconciled: lineTotalReconciled,
  };
}

/**
 * Composite confidence algorithm (spec v3 §7). Hard-block conditions are
 * evaluated by the caller (parseScanZOcr) before this ever runs — this
 * function only computes the non-blocking confidence score and whether the
 * escalated "mandatory acknowledgement" UI state should trigger.
 * @param {{ocrConfidence: 'high'|'medium'|'low', checks: import('../schemas').ScanZOcrChecks, ticketCountStructurallyValid: boolean}} params
 * @returns {{finalConfidence: number, cappedBy: string[], requiresAcknowledgement: boolean, warnings: string[]}}
 */
function computeCompositeConfidence({ ocrConfidence, checks }) {
  const baseByReported = { high: 0.95, medium: 0.8, low: 0.5 };
  const base = baseByReported[ocrConfidence] ?? 0.5;

  const caps = [];
  const warnings = [];
  let ticketCountHighTriggered = false;

  if (!checks.ticket_count_plausible) {
    // Only ever reached for a structurally VALID ticket count that simply
    // exceeds the plausibility ceiling — a structurally invalid one is a
    // hard block, handled entirely separately in parseScanZOcr, never here.
    caps.push(0.7);
    ticketCountHighTriggered = true;
    warnings.push('Nombre de tickets inhabituellement élevé pour cet établissement — à vérifier avant confirmation.');
  }
  if (!checks.expected_labels_present) {
    caps.push(0.75);
    warnings.push("Libellés attendus (TOTAL, NOMBRE DE TICKETS, ...) non détectés sur la photo.");
  }
  if (checks.image_quality === 'poor') {
    caps.push(0.6);
    warnings.push('Qualité de la photo signalée comme faible — vérifier les valeurs avant confirmation.');
  }
  if (!checks.repeated_value_consistent) {
    caps.push(0.65);
    warnings.push('Les deux lectures indépendantes du total ne concordent pas.');
  }
  if (!checks.line_total_reconciled) {
    caps.push(0.8);
    warnings.push('La somme des lignes produit ne correspond pas au total (non bloquant).');
  }

  const finalConfidence = Math.min(base, ...(caps.length > 0 ? caps : [1]));
  const degradedSignalCount = caps.length;
  const requiresAcknowledgement = ticketCountHighTriggered || degradedSignalCount >= 2 || finalConfidence < 0.75;

  return { finalConfidence, cappedBy: caps, requiresAcknowledgement, warnings };
}

/**
 * Pure mapping + validation step — takes an already-parsed Claude vision
 * JSON response (no network access here) and produces the normalized
 * ScanZDailySummary + validation result + confidence info. This is the
 * fully unit-testable core of the parser; `runScanZOcr` is the thin async
 * wrapper that actually calls Claude.
 * @param {object} rawJson
 * @param {{ticketCountCeiling?: number}} [options]
 * @returns {{statement: import('../schemas').ScanZDailySummary|null, validation: import('../schemas').ValidationResult, confidence: {finalConfidence: number, cappedBy: string[], requiresAcknowledgement: boolean}, raw: import('../schemas').ScanZRawOcrValues}}
 */
function parseScanZOcr(rawJson, options = {}) {
  const errors = [];
  const warnings = [];

  const checks = computeDeterministicChecks(rawJson, options);

  const dateResult = typeof rawJson.date === 'string' ? parseDate(rawJson.date) : { ok: false };
  if (!checks.date_valid) {
    errors.push('SCANZ_INVALID_DATE: date illisible ou absente sur la photo — jamais déduite.');
  }
  if (!checks.ttc_valid) {
    errors.push('SCANZ_INVALID_TOTAL: total TTC illisible, absent, ou non positif.');
  }

  const ticketCountStructurallyValid =
    typeof rawJson.nb_transactions === 'number' && Number.isInteger(rawJson.nb_transactions) && rawJson.nb_transactions > 0;
  if (!ticketCountStructurallyValid) {
    errors.push(
      'SCANZ_INVALID_TICKET_COUNT: nombre de tickets manquant, non numérique, non entier, ou <= 0 — jamais déduit.'
    );
  }

  const productLines = (Array.isArray(rawJson.produits) ? rawJson.produits : []).map((p) => ({
    name: typeof p?.nom === 'string' ? p.nom : '',
    quantity: typeof p?.quantite === 'number' ? p.quantite : null,
    total_cents: typeof p?.total === 'number' ? toCents(p.total) : null,
  }));

  const raw = {
    date: checks.date_valid ? dateResult.iso : null,
    total_ttc_cents: checks.ttc_valid ? toCents(rawJson.total_ttc) : null,
    ticket_count: ticketCountStructurallyValid ? rawJson.nb_transactions : null,
    ocr_confidence: ['high', 'medium', 'low'].includes(rawJson.ocr_confidence) ? rawJson.ocr_confidence : 'low',
    labels_detected: Array.isArray(rawJson.labels_detected) ? rawJson.labels_detected.map(String) : [],
    resume: typeof rawJson.resume === 'string' ? rawJson.resume : '',
    product_lines: productLines,
    checks,
  };

  // Hard blocks stop here — no composite confidence, no statement built.
  // Ticket-count structural invalidity is intentionally excluded from the
  // composite-confidence caps entirely (spec v3 §7): it is either a hard
  // block (here) or, when structurally valid but unusually high, a
  // standalone non-blocking cap+acknowledgement trigger inside
  // computeCompositeConfidence — never both.
  if (errors.length > 0) {
    return {
      statement: null,
      validation: { valid: false, errors, warnings },
      confidence: { finalConfidence: 0, cappedBy: [], requiresAcknowledgement: true },
      raw,
    };
  }

  const confidence = computeCompositeConfidence({ ocrConfidence: raw.ocr_confidence, checks });
  warnings.push(...confidence.warnings);

  const statement = {
    source_type: 'scanz_ocr_summary',
    raw,
    days: [
      {
        date: raw.date,
        ticket_count: raw.ticket_count,
        total_ttc_cents: raw.total_ttc_cents,
        // Never manufactured — see module docstring and spec v3 §2.
        total_ht_cents: null,
        ca_ttc_cents: null,
        clients_count: null,
        payments: [],
      },
    ],
  };

  return {
    statement,
    validation: { valid: true, errors: [], warnings },
    confidence,
    raw,
  };
}

/**
 * Re-validates only the hard-block conditions (date/total_ttc/ticket_count)
 * against the human-reviewed FINAL values at commit time — never re-runs
 * vision (see module docstring). Distinct from `parseScanZOcr`'s full
 * validation: no composite confidence, no labels/image-quality/line-total
 * checks here — those were already surfaced during review; the human's
 * confirmation supersedes them. This only guards against a final value
 * that is missing or structurally invalid despite (or because of) manual
 * editing.
 * @param {{date: string|null, total_ttc: number|null, ticket_count: number|null}} finalValues - plain units (euros), not cents
 * @returns {{valid: boolean, errors: string[], dateIso: string|null}}
 */
function validateFinalValues(finalValues) {
  const errors = [];

  const dateResult = typeof finalValues?.date === 'string' ? parseDate(finalValues.date) : { ok: false };
  if (!dateResult.ok) {
    errors.push('SCANZ_INVALID_DATE: date manquante ou invalide dans les valeurs finales.');
  }

  const ttcValid =
    typeof finalValues?.total_ttc === 'number' && Number.isFinite(finalValues.total_ttc) && finalValues.total_ttc > 0;
  if (!ttcValid) {
    errors.push('SCANZ_INVALID_TOTAL: total TTC manquant ou non positif dans les valeurs finales.');
  }

  const ticketValid =
    typeof finalValues?.ticket_count === 'number' &&
    Number.isInteger(finalValues.ticket_count) &&
    finalValues.ticket_count > 0;
  if (!ticketValid) {
    errors.push('SCANZ_INVALID_TICKET_COUNT: nombre de tickets manquant, non entier, ou <= 0 dans les valeurs finales.');
  }

  return { valid: errors.length === 0, errors, dateIso: dateResult.ok ? dateResult.iso : null };
}

/**
 * Diffs the token-bound raw OCR values against the human-reviewed final
 * values — server-computed, never trusted from a client-submitted diff.
 * @param {import('../schemas').ScanZRawOcrValues} raw
 * @param {{date: string|null, total_ttc: number|null, total_ht: number|null, ca_ttc: number|null, ticket_count: number|null}} finalValues
 * @returns {string[]} names of fields whose final value differs from the raw OCR read
 */
function computeCorrectedFields(raw, finalValues) {
  const corrected = [];
  if ((raw.date ?? null) !== (finalValues?.date ?? null)) corrected.push('date');

  const rawTtcUnit = raw.total_ttc_cents !== null && raw.total_ttc_cents !== undefined ? raw.total_ttc_cents / 100 : null;
  if (rawTtcUnit !== (finalValues?.total_ttc ?? null)) corrected.push('total_ttc');

  if ((raw.ticket_count ?? null) !== (finalValues?.ticket_count ?? null)) corrected.push('ticket_count');

  // raw never has total_ht/ca_ttc (always null/absent — never manufactured), so
  // any real manual figure at all counts as a correction.
  if (typeof finalValues?.total_ht === 'number') corrected.push('total_ht');
  if (typeof finalValues?.ca_ttc === 'number') corrected.push('ca_ttc');

  return corrected;
}

/**
 * Runs the actual (single) Claude vision call, then delegates to the pure
 * `parseScanZOcr`. Never called again after preflight — see module
 * docstring and commit-pipeline.js's runScanZCommit.
 * @param {{buffer: Buffer, mimeType: string, apiKey?: string, callClaude?: Function, ticketCountCeiling?: number}} params
 * @returns {Promise<ReturnType<typeof parseScanZOcr>>}
 */
async function runScanZOcr({ buffer, mimeType, apiKey, callClaude, ticketCountCeiling }) {
  const resolvedApiKey = apiKey ?? process.env.ANTHROPIC_API_KEY;
  const caller = callClaude ?? defaultCallClaudeVision;

  const rawText = await caller({ imageBase64: buffer.toString('base64'), mimeType }, resolvedApiKey);
  const rawJson = parseClaudeVisionJson(rawText);
  return parseScanZOcr(rawJson, { ticketCountCeiling });
}

module.exports = {
  PARSER_VERSION,
  DEFAULT_TICKET_COUNT_CEILING,
  EXPECTED_LABELS,
  parseClaudeVisionJson,
  computeDeterministicChecks,
  computeCompositeConfidence,
  parseScanZOcr,
  runScanZOcr,
  validateFinalValues,
  computeCorrectedFields,
  toCents,
};
