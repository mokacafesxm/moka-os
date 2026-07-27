'use strict';

/**
 * Document classification: deterministic keyword/signature rules first,
 * Claude Haiku only as a fallback when several document types remain
 * plausible after the rules pass. See docs/ARCHITECTURE.md "Classification"
 * section for the full decision table.
 *
 * Hard requirements this module enforces (per AGENTS.md):
 *  - a document unambiguously recognized by rules is never sent to Claude;
 *  - a missing ANTHROPIC_API_KEY never blocks rule-recognized documents;
 *  - an ambiguous document with no usable Claude response never gets an
 *    invented classification — it falls back to the (low-confidence)
 *    deterministic result, which the threshold table then routes to
 *    review_required or rejected.
 */

const {
  DOCUMENT_TYPES,
  ClassificationResultSchema,
  ClaudeClassificationResponseSchema,
} = require('./schemas');

const AUTO_THRESHOLD = Number(process.env.CLASSIFICATION_AUTO_THRESHOLD ?? 0.9);
const REVIEW_THRESHOLD = Number(process.env.CLASSIFICATION_REVIEW_THRESHOLD ?? 0.75);

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const CLAUDE_TEXT_CHAR_LIMIT = 4000;

/**
 * Deterministic rule table. Each rule contributes its weight to its
 * document_type's score when its pattern matches the searchable text.
 * Scores are summed then capped at 1.0. Weights are hand-picked so that a
 * single weak keyword never crosses AUTO_THRESHOLD alone — reaching 0.90
 * requires several independent signals to agree.
 *
 * `posSource`, when present, additionally identifies which POS system a
 * pos_export match came from (AddicTill vs L'Addition) — see AGENTS.md
 * "SYSTÈMES DE CAISSE" section. This is a hard brand-name match, not an
 * LLM guess, precisely because we must not assume format compatibility
 * between the two without proof.
 */
const RULES = {
  bank_statement: [
    { signal: 'releve_compte_keyword', weight: 0.5, pattern: /relev[ée]\s+de\s+compte/i },
    { signal: 'solde_initial_keyword', weight: 0.4, pattern: /solde\s+initial/i },
    { signal: 'solde_final_keyword', weight: 0.4, pattern: /solde\s+final/i },
    { signal: 'iban_keyword', weight: 0.3, pattern: /\biban\b/i },
    { signal: 'bic_keyword', weight: 0.2, pattern: /\bbic\b/i },
    { signal: 'virement_keyword', weight: 0.15, pattern: /virement/i },
  ],
  pos_export: [
    { signal: 'addictill_brand', weight: 0.6, pattern: /addictill/i, posSource: 'addictill_export' },
    { signal: 'laddition_brand', weight: 0.6, pattern: /l'?addition/i, posSource: 'laddition_export' },
    { signal: 'ticket_moyen_keyword', weight: 0.3, pattern: /ticket\s+moyen/i },
    { signal: 'nombre_tickets_keyword', weight: 0.2, pattern: /nombre\s+de\s+tickets/i },
    { signal: 'mode_paiement_keyword', weight: 0.15, pattern: /mode\s+de\s+paiement/i },
    // Real AddicTill "Synthèse quotidienne"/"Palmarès produits" exports
    // never contain the literal word "addictill" — these are the actual
    // recurring header phrases confirmed against real files (PR3). Each
    // is specific enough (exact multi-word French business phrase) to be
    // a reliable signal without over-fitting to one file.
    { signal: 'synthese_quotidienne_keyword', weight: 0.4, pattern: /synthese\s+quotidienne/i, posSource: 'addictill_export' },
    { signal: 'encaissements_keyword', weight: 0.3, pattern: /\bencaissements\b/i, posSource: 'addictill_export' },
    { signal: 'modes_de_ventes_keyword', weight: 0.3, pattern: /modes\s+de\s+ventes/i, posSource: 'addictill_export' },
    { signal: 'codes_barre_keyword', weight: 0.4, pattern: /codes?\s+barres?/i, posSource: 'addictill_export' },
    { signal: 'derniere_vente_keyword', weight: 0.3, pattern: /derni[èe]re\s+vente/i, posSource: 'addictill_export' },
    { signal: 'quantite_decimale_keyword', weight: 0.3, pattern: /quantit[ée]\s+d[ée]cimale/i, posSource: 'addictill_export' },
  ],
  monthly_performance: [
    { signal: 'performance_mensuelle_keyword', weight: 0.6, pattern: /performance\s+mensuelle/i },
    { signal: 'rapport_mensuel_keyword', weight: 0.5, pattern: /rapport\s+mensuel/i },
    { signal: 'ca_mensuel_keyword', weight: 0.4, pattern: /chiffre\s+d'?affaires\s+mensuel/i },
    { signal: 'bilan_mensuel_keyword', weight: 0.4, pattern: /bilan\s+mensuel/i },
  ],
};

/**
 * Flattens an ExtractionResult into a single searchable string, regardless
 * of its original file type.
 * @param {import('./schemas').ExtractionResult} extraction
 * @returns {string}
 */
function extractionToSearchableText(extraction) {
  if (extraction.text) return extraction.text;
  if (extraction.sheets) {
    return extraction.sheets
      .map((sheet) => `${sheet.name} ${sheet.rows.map((row) => row.join(' ')).join(' ')}`)
      .join(' ');
  }
  if (extraction.table) {
    return `${extraction.table.header.join(' ')} ${extraction.table.rows
      .map((row) => row.join(' '))
      .join(' ')}`;
  }
  return '';
}

/**
 * Applies the deterministic rule table to a searchable text.
 * @param {string} searchableText
 * @returns {{
 *   scores: Record<string, number>,
 *   signals: Record<string, string[]>,
 *   posSourceMatches: Record<string, string>,
 * }}
 */
function applyDeterministicRules(searchableText) {
  const scores = {};
  const signals = {};
  const posSourceMatches = {};

  for (const docType of DOCUMENT_TYPES) {
    if (docType === 'unknown') continue;
    const ruleList = RULES[docType] || [];
    let score = 0;
    const matched = [];
    for (const rule of ruleList) {
      if (rule.pattern.test(searchableText)) {
        score += rule.weight;
        matched.push(rule.signal);
        if (rule.posSource) {
          posSourceMatches[docType] = rule.posSource;
        }
      }
    }
    scores[docType] = Math.min(score, 1);
    signals[docType] = matched;
  }

  return { scores, signals, posSourceMatches };
}

/**
 * Strips markdown code fences a model may wrap its JSON in, then parses it.
 * @param {string} rawText
 * @returns {*} parsed JSON value
 * @throws if the text is not valid JSON once fences are stripped
 */
function parseClaudeJson(rawText) {
  const stripped = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(stripped);
}

/**
 * Default Claude caller, using the same SDK/model as app/api/reports/chat.
 * Injectable so tests can simulate arbitrary (including invalid) responses
 * without a network call or API key.
 * @param {{searchableText: string, candidates: string[]}} input
 * @param {string} apiKey
 * @returns {Promise<string>} raw text response from Claude
 */
async function defaultCallClaude({ searchableText, candidates }, apiKey) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic(apiKey ? { apiKey } : {});
  const truncated = searchableText.slice(0, CLAUDE_TEXT_CHAR_LIMIT);

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content:
          `Classify this document excerpt into exactly one of: ${DOCUMENT_TYPES.join(', ')}.\n` +
          `Local deterministic rules found these plausible candidates: ${candidates.join(', ')}.\n` +
          `Respond with JSON only, matching this shape:\n` +
          `{"document_type": "...", "confidence": 0.0, "reasoning_summary": "...", "detected_signals": ["..."]}\n\n` +
          `Document excerpt:\n${truncated}`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  return textBlock ? textBlock.text : '';
}

/**
 * Classifies a single document from its extraction result.
 * @param {import('./schemas').ExtractionResult} extraction
 * @param {Object} [options]
 * @param {string} [options.apiKey] - defaults to process.env.ANTHROPIC_API_KEY
 * @param {Function} [options.callClaude] - override for tests; see defaultCallClaude
 * @returns {Promise<import('./schemas').ClassificationResult>}
 */
async function classifyDocument(extraction, options = {}) {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  const callClaude = options.callClaude ?? defaultCallClaude;

  const searchableText = extractionToSearchableText(extraction);
  const { scores, signals, posSourceMatches } = applyDeterministicRules(searchableText);

  const ranked = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  const posSourceHintFor = (docType) =>
    docType === 'pos_export' ? posSourceMatches[docType] ?? 'unknown' : null;

  // No signal matched anything: never invent a classification.
  if (ranked.length === 0) {
    return ClassificationResultSchema.parse({
      document_type: 'unknown',
      confidence: 0,
      reasoning_summary: 'Aucun signal déterministe détecté dans le document.',
      detected_signals: [],
      pos_source_hint: null,
      classified_by: 'rules',
    });
  }

  const [bestType, bestScore] = ranked[0];

  // Unambiguous: a single type crossed the auto threshold on rules alone.
  if (bestScore >= AUTO_THRESHOLD) {
    return ClassificationResultSchema.parse({
      document_type: bestType,
      confidence: bestScore,
      reasoning_summary: `Reconnu sans ambiguïté par les règles locales (score ${bestScore.toFixed(2)}).`,
      detected_signals: signals[bestType],
      pos_source_hint: posSourceHintFor(bestType),
      classified_by: 'rules',
    });
  }

  // Ambiguous only if 2+ types remain plausible; a single weak signal is
  // not ambiguity per AGENTS.md rule (d) — it stays a low-confidence rules
  // result and lets the threshold table send it to review/rejected.
  const isAmbiguous = ranked.length >= 2;

  if (!isAmbiguous) {
    return ClassificationResultSchema.parse({
      document_type: bestType,
      confidence: bestScore,
      reasoning_summary: `Seul signal détecté, confiance insuffisante pour un traitement automatique (score ${bestScore.toFixed(2)}).`,
      detected_signals: signals[bestType],
      pos_source_hint: posSourceHintFor(bestType),
      classified_by: 'rules',
    });
  }

  const fallbackResult = () =>
    ClassificationResultSchema.parse({
      document_type: bestType,
      confidence: bestScore,
      reasoning_summary: `Plusieurs types plausibles (${ranked.map(([t]) => t).join(', ')}), Claude indisponible ou réponse invalide — repli sur la meilleure règle locale (score ${bestScore.toFixed(2)}).`,
      detected_signals: signals[bestType],
      pos_source_hint: posSourceHintFor(bestType),
      classified_by: 'rules',
    });

  if (!apiKey) {
    return fallbackResult();
  }

  let rawResponse;
  try {
    rawResponse = await callClaude(
      { searchableText, candidates: ranked.map(([t]) => t) },
      apiKey
    );
  } catch {
    return fallbackResult();
  }

  let parsedJson;
  try {
    parsedJson = parseClaudeJson(rawResponse);
  } catch {
    return fallbackResult();
  }

  const validation = ClaudeClassificationResponseSchema.safeParse(parsedJson);
  if (!validation.success) {
    return fallbackResult();
  }

  const claudeResult = validation.data;
  const combinedSignals = Array.from(
    new Set([...(signals[claudeResult.document_type] || []), ...claudeResult.detected_signals])
  );

  return ClassificationResultSchema.parse({
    document_type: claudeResult.document_type,
    confidence: claudeResult.confidence,
    reasoning_summary: claudeResult.reasoning_summary,
    detected_signals: combinedSignals,
    pos_source_hint: posSourceHintFor(claudeResult.document_type),
    classified_by: 'claude',
  });
}

/**
 * Maps a classification to the pipeline action per AGENTS.md's confidence
 * thresholds. This is intentionally separate from classifyDocument so the
 * thresholds stay a pure, testable function of (document_type, confidence).
 * @param {import('./schemas').ClassificationResult} classification
 * @returns {'auto'|'review_required'|'rejected'}
 */
function resolveClassificationStatus(classification) {
  if (classification.document_type === 'unknown') {
    return 'rejected';
  }
  if (classification.confidence >= AUTO_THRESHOLD) {
    return 'auto';
  }
  if (classification.confidence >= REVIEW_THRESHOLD) {
    return 'review_required';
  }
  return 'rejected';
}

module.exports = {
  AUTO_THRESHOLD,
  REVIEW_THRESHOLD,
  RULES,
  extractionToSearchableText,
  applyDeterministicRules,
  parseClaudeJson,
  classifyDocument,
  resolveClassificationStatus,
};
