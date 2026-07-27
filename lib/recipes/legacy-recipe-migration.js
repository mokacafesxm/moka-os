'use strict';

// Pure classification/proposal-building logic for the one-off legacy
// MOKA_Recettes -> Sold Product Catalogue + Recipe Lines migration
// (scripts/manual-migrations/populate-recipe-catalogue.js). Extracted here
// so it's unit-testable with plain data — no Notion access, no I/O.
//
// Classification rule: a MOKA_Recettes row is INVALID (junk) only if it has
// no Plat/Nom_plat title AND no Menu_lie relation AND no Ingredient relation
// at all — a page created but never filled in. Every other row is grouped
// by its Menu_lie relation target (the ground truth for "which sold dish
// this recipe belongs to" — a direct Notion relation, never a name guess).
// A row whose Menu_lie doesn't resolve to a live menu item is reported as
// NEEDS_MANUAL_REVIEW rather than silently dropped or silently attached to
// a best-guess dish by name.

const { generateProductKey, normalizeName } = require('./normalization');
const { findBestNameMatch } = require('./mapping-confidence');

const KNOWN_UNITS = new Set(['g', 'kg', 'ml', 'l', 'pièce', 'unité']);

/**
 * @param {Array<{id, plat, nomPlat, quantite, unite, menuIds:string[], ingredientIds:string[]}>} rows
 * @param {Map<string, {id,name,category}>} menuById
 * @returns {{ junkRows: object[], dishGroups: Map<string, object[]>, unlinkedRows: object[] }}
 */
function classifyLegacyRecetteRows(rows, menuById) {
  const junkRows = rows.filter((r) => !r.plat && !r.nomPlat && r.menuIds.length === 0 && r.ingredientIds.length === 0);
  const realRows = rows.filter((r) => !junkRows.includes(r));

  const dishGroups = new Map();
  const unlinkedRows = [];
  for (const row of realRows) {
    const menuId = row.menuIds[0];
    if (!menuId || !menuById.has(menuId)) {
      unlinkedRows.push(row);
      continue;
    }
    if (!dishGroups.has(menuId)) dishGroups.set(menuId, []);
    dishGroups.get(menuId).push(row);
  }

  return { junkRows, dishGroups, unlinkedRows };
}

/**
 * Resolves and validates each raw recipe line's ingredient/quantity/unit —
 * never guesses: an ingredient id that doesn't resolve in `ingredientById`,
 * a non-positive quantity, or an unrecognized unit each independently
 * exclude that one line (reported, not silently dropped from the report,
 * just excluded from what gets written).
 * @param {Array<object>} lines
 * @param {Map<string, {id,name,archived}>} ingredientById
 */
function resolveRecipeLines(lines, ingredientById) {
  return lines.map((line) => {
    const ingredient = line.ingredientIds[0] ? ingredientById.get(line.ingredientIds[0]) || null : null;
    const errors = [];
    if (!ingredient) errors.push('INGREDIENT_NOT_FOUND_IN_MASTER');
    else if (ingredient.archived) errors.push('INGREDIENT_ARCHIVED');
    if (line.quantite == null || line.quantite <= 0) errors.push('INVALID_QUANTITY');
    if (!line.unite || !KNOWN_UNITS.has(line.unite)) errors.push('UNKNOWN_OR_MISSING_UNIT');
    return { ...line, ingredient, valid: errors.length === 0, errors };
  });
}

/**
 * Builds one proposed Sold Product (+ its resolved recipe lines) for a
 * legacy dish group. The sold-product mapping confidence is always 'exact'
 * — it's derived from a direct Notion relation (Menu_lie), never a name
 * heuristic — while the OPTIONAL Website Product cross-reference is a real
 * name-matching problem, classified independently.
 * @param {{id, name, category}} menuItem
 * @param {Array<object>} rawLines
 * @param {Map<string, object>} ingredientById
 * @param {Array<{id,name}>} websiteCandidates
 */
function buildSoldProductProposal(menuItem, rawLines, ingredientById, websiteCandidates) {
  const productKey = generateProductKey(menuItem.name);
  const websiteProductMatch = findBestNameMatch(menuItem.name, websiteCandidates);
  const aliases = [...new Set(rawLines.map((l) => l.nomPlat || (l.plat || '').split(' — ')[0]).filter(Boolean))]
    .filter((alias) => normalizeName(alias) !== normalizeName(menuItem.name));

  const lines = resolveRecipeLines(rawLines, ingredientById);

  return {
    menuId: menuItem.id,
    menuItem,
    productKey,
    confidence: 'exact',
    confidenceReason: 'DIRECT_NOTION_RELATION (Menu_lie)',
    websiteProductMatch,
    aliases,
    lines,
    validLineCount: lines.filter((l) => l.valid).length,
    invalidLineCount: lines.filter((l) => !l.valid).length,
  };
}

/** Phase-8-style summary: percentage of proposed SOLD PRODUCTS below auto-writable (exact/high) confidence. */
function computeMediumLowPercentage(proposals) {
  if (proposals.length === 0) return 0;
  const exactOrHigh = proposals.filter((p) => p.confidence === 'exact' || p.confidence === 'high').length;
  return ((proposals.length - exactOrHigh) / proposals.length) * 100;
}

module.exports = {
  KNOWN_UNITS,
  classifyLegacyRecetteRows,
  resolveRecipeLines,
  buildSoldProductProposal,
  computeMediumLowPercentage,
};
