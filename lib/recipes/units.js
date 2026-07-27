'use strict';

// Minimal, safe unit-conversion model for recipe lines (Architecture cleanup
// — Recipe Catalogue foundation, domain E). Deliberately narrow: only the
// three families explicitly in scope (mass, volume, count), and only exact,
// well-known unit spellings. Never guesses — an unrecognized or
// cross-family conversion is reported as incompatible/unresolved, never
// silently coerced.

const MASS = 'mass';
const VOLUME = 'volume';
const COUNT = 'count';

// Canonical unit -> { family, toBase } — base units are grams (mass),
// milliliters (volume), and "piece" (count, no conversion within the family
// beyond identity — a "piece"/"unité" is never converted to a different
// count unit).
const UNIT_TABLE = {
  g: { family: MASS, toBase: 1 },
  kg: { family: MASS, toBase: 1000 },
  ml: { family: VOLUME, toBase: 1 },
  l: { family: VOLUME, toBase: 1000 },
  piece: { family: COUNT, toBase: 1 },
  pièce: { family: COUNT, toBase: 1 },
  unite: { family: COUNT, toBase: 1 },
  unité: { family: COUNT, toBase: 1 },
};

function normalizeUnit(unit) {
  return String(unit || '').trim().toLowerCase();
}

function unitFamily(unit) {
  const entry = UNIT_TABLE[normalizeUnit(unit)];
  return entry ? entry.family : null;
}

function isKnownUnit(unit) {
  return Boolean(UNIT_TABLE[normalizeUnit(unit)]);
}

/** Two units are convertible only if both are known AND in the same family. */
function canConvert(fromUnit, toUnit) {
  const from = UNIT_TABLE[normalizeUnit(fromUnit)];
  const to = UNIT_TABLE[normalizeUnit(toUnit)];
  if (!from || !to) return false;
  return from.family === to.family;
}

/**
 * @returns {{ok:true, value:number} | {ok:false, reason:string}}
 */
function convert(quantity, fromUnit, toUnit) {
  if (!Number.isFinite(quantity)) return { ok: false, reason: 'INVALID_QUANTITY' };
  const from = UNIT_TABLE[normalizeUnit(fromUnit)];
  const to = UNIT_TABLE[normalizeUnit(toUnit)];
  if (!from) return { ok: false, reason: 'UNKNOWN_UNIT' };
  if (!to) return { ok: false, reason: 'UNKNOWN_UNIT' };
  if (from.family !== to.family) return { ok: false, reason: 'INCOMPATIBLE_UNITS' };
  const inBase = quantity * from.toBase;
  return { ok: true, value: inBase / to.toBase };
}

module.exports = { MASS, VOLUME, COUNT, normalizeUnit, unitFamily, isKnownUnit, canConvert, convert };
