'use strict';

// Name normalization and deterministic product_key generation — Recipe Data
// Population phase. Pure functions, no Notion access. Used both by the
// one-off migration script (scripts/manual-migrations/populate-recipe-catalogue.js)
// and available for any future reconciliation pass, so the exact same rule
// is never re-implemented ad hoc.

/** Strips accents, lowercases, collapses punctuation/whitespace. Deterministic — same input always produces the same output. */
function normalizeName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining accent marks
    .toLowerCase()
    .replace(/['’]/g, '') // apostrophes dropped, not turned into a separator (MÖKA's -> mokas)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deterministic, stable product_key — kebab-case of the normalized name. Same input always yields the same key. */
function generateProductKey(name) {
  const normalized = normalizeName(name);
  return normalized.replace(/\s+/g, '-');
}

/** True if two names are the same product after normalization (accents/casing/punctuation-insensitive only — never a fuzzy/approximate match). */
function namesMatchExactly(a, b) {
  return normalizeName(a) === normalizeName(b);
}

module.exports = { normalizeName, generateProductKey, namesMatchExactly };
