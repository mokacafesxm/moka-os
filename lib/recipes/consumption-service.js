'use strict';

// Theoretical-consumption preview — Recipe Catalogue foundation, target
// architecture domain I. Pure, deterministic calculation only: sold
// quantity × recipe quantity per unit = theoretical ingredient consumption.
// This module NEVER touches Notion, NEVER writes to Stock or any Stock
// Movements/ledger, and never guesses a missing mapping or an invalid unit
// conversion — those are always reported explicitly so the caller (and any
// future Stock Movements integration) can see exactly what's missing.

const { convert, isKnownUnit } = require('./units');
const { annotateLineValidity } = require('./product-mapping-service');

/**
 * @param {object} params
 * @param {object|null} params.soldProduct - resolved sold product, or null if unmapped
 * @param {number} params.quantitySold
 * @param {Array<object>} params.recipeLines - ALL recipe lines (will be filtered to this product)
 * @param {Record<string, {active:boolean, uniteStock?:string, name?:string}>} params.ingredientsById
 * @param {*} [params.sourceRef] - preserved verbatim in the result, e.g. the originating sale/row reference
 * @returns {{
 *   soldProductId: string|null, productKey: string|null, quantitySold: number, sourceRef?: any,
 *   missingMapping: boolean, incompleteRecipe: boolean,
 *   lines: Array<{ingredientId:string, ingredientName?:string, consumedQuantity:number|null, unit:string|null, sourceRecipeLineId:string, valid:boolean, unresolvedUnit?:boolean, reason?:string}>,
 * }}
 */
function calculateTheoreticalConsumption({ soldProduct, quantitySold, recipeLines, ingredientsById = {}, sourceRef }) {
  const base = { quantitySold, sourceRef };

  if (!soldProduct) {
    return { ...base, soldProductId: null, productKey: null, missingMapping: true, incompleteRecipe: false, lines: [] };
  }

  const activeLines = annotateLineValidity(
    (recipeLines || []).filter((l) => l.soldProductId === soldProduct.id && l.active),
    ingredientsById
  );

  if (activeLines.length === 0) {
    return {
      ...base, soldProductId: soldProduct.id, productKey: soldProduct.productKey,
      missingMapping: false, incompleteRecipe: true, lines: [],
    };
  }

  const lines = activeLines.map((line) => {
    const ingredient = ingredientsById[line.ingredientId] || null;
    if (!ingredient) {
      return {
        ingredientId: line.ingredientId, sourceRecipeLineId: line.id,
        consumedQuantity: null, unit: null, valid: false, reason: 'MISSING_INGREDIENT',
      };
    }
    if (!line.valid) {
      return {
        ingredientId: line.ingredientId, ingredientName: ingredient.name, sourceRecipeLineId: line.id,
        consumedQuantity: null, unit: line.unit || null, valid: false, reason: 'INVALID_RECIPE_LINE',
      };
    }

    const rawConsumed = Number(quantitySold) * line.quantity * (line.yieldFactor ?? 1);

    if (ingredient.uniteStock && isKnownUnit(ingredient.uniteStock)) {
      const converted = convert(rawConsumed, line.unit, ingredient.uniteStock);
      if (!converted.ok) {
        return {
          ingredientId: line.ingredientId, ingredientName: ingredient.name, sourceRecipeLineId: line.id,
          consumedQuantity: null, unit: line.unit, valid: false, reason: converted.reason,
        };
      }
      return {
        ingredientId: line.ingredientId, ingredientName: ingredient.name, sourceRecipeLineId: line.id,
        consumedQuantity: converted.value, unit: ingredient.uniteStock, valid: true,
      };
    }

    // Ingredient has no known stock unit to convert into — report in the
    // recipe line's own unit, explicitly flagged unresolved (never silently
    // treated as if it were the ingredient's stock unit).
    return {
      ingredientId: line.ingredientId, ingredientName: ingredient.name, sourceRecipeLineId: line.id,
      consumedQuantity: rawConsumed, unit: line.unit, valid: true, unresolvedUnit: true,
    };
  });

  const incompleteRecipe = lines.some((l) => !l.valid);

  return {
    ...base, soldProductId: soldProduct.id, productKey: soldProduct.productKey,
    missingMapping: false, incompleteRecipe, lines,
  };
}

/**
 * Aggregates theoretical consumption across multiple sold products/sales in
 * one calculation, summing per-ingredient totals while preserving each
 * contributing source reference — never merges away where a quantity came
 * from.
 * @param {Array<{soldProduct:object|null, quantitySold:number, sourceRef?:any}>} items
 * @param {{recipeLines:Array<object>, ingredientsById:object}} ctx
 */
function calculateBatchConsumption(items, { recipeLines, ingredientsById = {} }) {
  const perItem = (items || []).map((item) =>
    calculateTheoreticalConsumption({
      soldProduct: item.soldProduct,
      quantitySold: item.quantitySold,
      recipeLines,
      ingredientsById,
      sourceRef: item.sourceRef,
    })
  );

  const totalsByIngredient = new Map();
  for (const result of perItem) {
    for (const line of result.lines) {
      if (!line.valid) continue;
      const key = `${line.ingredientId}:${line.unit}`;
      const existing = totalsByIngredient.get(key) || {
        ingredientId: line.ingredientId, ingredientName: line.ingredientName, unit: line.unit,
        totalConsumedQuantity: 0, contributions: [],
      };
      existing.totalConsumedQuantity += line.consumedQuantity;
      existing.contributions.push({ sourceRef: result.sourceRef, quantity: line.consumedQuantity });
      totalsByIngredient.set(key, existing);
    }
  }

  return {
    perItem,
    totalsByIngredient: Array.from(totalsByIngredient.values()),
  };
}

module.exports = { calculateTheoreticalConsumption, calculateBatchConsumption };
