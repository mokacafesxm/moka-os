'use strict';

// Mapping-confidence classification — Recipe Data Population phase. Pure,
// deterministic, no Notion access. Used to decide which proposed mappings
// (recipe -> sold product, sold product -> Website Product, AddicTill sale
// -> sold product) are safe to write automatically (exact/high) versus
// which must be held for manual review (medium/low/unmapped) — never a
// silent guess.

const { normalizeName } = require('./normalization');

const CONFIDENCE_LEVELS = ['exact', 'high', 'medium', 'low', 'unmapped'];
const AUTO_WRITABLE_CONFIDENCE = new Set(['exact', 'high']);

/**
 * Classifies how confidently `sourceName` matches `candidateName` by name
 * alone. Only ever used where no direct relation/id already establishes the
 * link — a direct Notion relation is always 'exact' by construction (see
 * classifyRelationMapping), never run through this name-based heuristic.
 * @returns {{confidence: 'exact'|'high'|'medium'|'low'|'unmapped', reason: string}}
 */
function classifyNameMatch(sourceName, candidateName) {
  if (!candidateName) return { confidence: 'unmapped', reason: 'NO_CANDIDATE' };
  const a = normalizeName(sourceName);
  const b = normalizeName(candidateName);
  if (!a || !b) return { confidence: 'unmapped', reason: 'EMPTY_NAME' };
  if (a === b) return { confidence: 'exact', reason: 'NORMALIZED_NAMES_IDENTICAL' };

  if (a.includes(b) || b.includes(a)) {
    return { confidence: 'high', reason: 'ONE_NAME_IS_A_CLEAN_SUBSTRING_OF_THE_OTHER' };
  }

  const aWords = new Set(a.split(' ').filter(Boolean));
  const bWords = new Set(b.split(' ').filter(Boolean));
  const shared = [...aWords].filter((w) => bWords.has(w));
  const overlapRatio = shared.length / Math.max(aWords.size, bWords.size, 1);

  if (overlapRatio >= 0.5) return { confidence: 'medium', reason: 'PARTIAL_WORD_OVERLAP' };
  if (overlapRatio > 0) return { confidence: 'low', reason: 'MINIMAL_WORD_OVERLAP' };
  return { confidence: 'unmapped', reason: 'NO_WORD_OVERLAP' };
}

/** A direct, pre-existing Notion relation is always 'exact' — never a name-matching heuristic. */
function classifyRelationMapping(hasDirectRelation) {
  return hasDirectRelation
    ? { confidence: 'exact', reason: 'DIRECT_NOTION_RELATION' }
    : { confidence: 'unmapped', reason: 'NO_DIRECT_RELATION' };
}

/**
 * Finds the best candidate match for `sourceName` among `candidates`
 * (array of {id, name}). Flags ambiguity when two or more candidates tie at
 * the best confidence level — an ambiguous "best" match is never silently
 * picked; it's reported instead.
 * @returns {{candidate: object|null, confidence: string, reason: string, ambiguityNotes: string|null}}
 */
function findBestNameMatch(sourceName, candidates) {
  if (!candidates || candidates.length === 0) {
    return { candidate: null, confidence: 'unmapped', reason: 'NO_CANDIDATES', ambiguityNotes: null };
  }

  const scored = candidates.map((c) => ({ candidate: c, ...classifyNameMatch(sourceName, c.name) }));
  const rank = { exact: 0, high: 1, medium: 2, low: 3, unmapped: 4 };
  scored.sort((x, y) => rank[x.confidence] - rank[y.confidence]);

  const best = scored[0];
  if (best.confidence === 'unmapped') {
    return { candidate: null, confidence: 'unmapped', reason: best.reason, ambiguityNotes: null };
  }

  const tied = scored.filter((s) => s.confidence === best.confidence);
  const ambiguityNotes = tied.length > 1
    ? `${tied.length} candidates tied at "${best.confidence}": ${tied.map((t) => t.candidate.name).join(', ')}`
    : null;

  return { candidate: best.candidate, confidence: best.confidence, reason: best.reason, ambiguityNotes };
}

function isAutoWritable(confidence) {
  return AUTO_WRITABLE_CONFIDENCE.has(confidence);
}

module.exports = {
  CONFIDENCE_LEVELS,
  AUTO_WRITABLE_CONFIDENCE,
  classifyNameMatch,
  classifyRelationMapping,
  findBestNameMatch,
  isAutoWritable,
};
