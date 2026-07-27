'use strict';

// Recipe-line validation — Recipe Catalogue foundation, domain F. Pure
// functions only; no Notion access here. Callers (recipes-service.js)
// resolve the sold product / ingredient first and pass in plain data.

const { isKnownUnit, canConvert } = require('./units');

/**
 * @param {object} params
 * @param {object|null} params.soldProduct - resolved sold product, or null if missing
 * @param {{id:string, active:boolean, uniteStock?:string}|null} params.ingredient - resolved ingredient, or null if missing
 * @param {number} params.quantity
 * @param {string} params.unit
 * @param {Array<{soldProductId:string, ingredientId:string, active:boolean, id?:string}>} [params.existingActiveLines]
 * @param {string} [params.excludeLineId] - when updating a line, exclude it from the duplicate check
 * @returns {{valid:boolean, errors:string[], warnings:string[]}}
 */
function validateRecipeLine({ soldProduct, ingredient, quantity, unit, existingActiveLines = [], excludeLineId }) {
  const errors = [];
  const warnings = [];

  if (!soldProduct) errors.push('MISSING_SOLD_PRODUCT');
  if (!ingredient) errors.push('MISSING_INGREDIENT');

  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) errors.push('INVALID_QUANTITY');

  if (!unit || !isKnownUnit(unit)) {
    errors.push('UNKNOWN_UNIT');
  } else if (ingredient?.uniteStock && isKnownUnit(ingredient.uniteStock) && !canConvert(unit, ingredient.uniteStock)) {
    errors.push('INCOMPATIBLE_UNITS');
  } else if (ingredient && !ingredient.uniteStock) {
    warnings.push('INGREDIENT_STOCK_UNIT_UNKNOWN');
  }

  if (ingredient && ingredient.active === false) errors.push('INACTIVE_INGREDIENT');

  if (soldProduct && ingredient) {
    const duplicate = existingActiveLines.some((line) =>
      line.active &&
      line.soldProductId === soldProduct.id &&
      line.ingredientId === ingredient.id &&
      line.id !== excludeLineId
    );
    if (duplicate) errors.push('DUPLICATE_ACTIVE_RECIPE_LINE');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Determines whether an ALREADY-PERSISTED recipe line is currently valid —
 * used for reporting (recipe completeness, mapping reports, consumption
 * preview), not for gating a write. Re-checks the same inherent-validity
 * rules as validateRecipeLine (quantity, unit, ingredient existence/active,
 * unit compatibility) but never the duplicate-active-line check, which only
 * makes sense for a NEW submission being compared against its siblings.
 * @param {{quantity:number, unit:string}} line
 * @param {{active:boolean, uniteStock?:string}|null} ingredient
 */
function isRecipeLineValid(line, ingredient) {
  if (!ingredient) return false;
  if (ingredient.active === false) return false;
  if (!Number.isFinite(line?.quantity) || line.quantity <= 0) return false;
  if (!line?.unit || !isKnownUnit(line.unit)) return false;
  if (ingredient.uniteStock && isKnownUnit(ingredient.uniteStock) && !canConvert(line.unit, ingredient.uniteStock)) return false;
  return true;
}

module.exports = { validateRecipeLine, isRecipeLineValid };
