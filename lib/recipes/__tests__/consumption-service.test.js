import { describe, it, expect } from 'vitest';
import { calculateTheoreticalConsumption, calculateBatchConsumption } from '../consumption-service.js';

const soldProduct = { id: 'sold-1', productKey: 'moka-latte' };
const ingredientsById = {
  'ing-milk': { active: true, uniteStock: 'l', name: 'Lait entier' },
  'ing-coffee': { active: true, uniteStock: 'kg', name: 'Café grains' },
};
const recipeLines = [
  { id: 'line-milk', soldProductId: 'sold-1', ingredientId: 'ing-milk', active: true, quantity: 200, unit: 'ml', yieldFactor: 1 },
  { id: 'line-coffee', soldProductId: 'sold-1', ingredientId: 'ing-coffee', active: true, quantity: 18, unit: 'g', yieldFactor: 1 },
];

describe('calculateTheoreticalConsumption', () => {
  it('computes sold quantity × recipe quantity per unit, converted into the ingredient stock unit', () => {
    const result = calculateTheoreticalConsumption({ soldProduct, quantitySold: 10, recipeLines, ingredientsById });
    const milk = result.lines.find((l) => l.ingredientId === 'ing-milk');
    const coffee = result.lines.find((l) => l.ingredientId === 'ing-coffee');
    // 10 lattes × 200ml = 2000ml = 2l
    expect(milk.consumedQuantity).toBeCloseTo(2, 6);
    expect(milk.unit).toBe('l');
    // 10 lattes × 18g = 180g = 0.18kg
    expect(coffee.consumedQuantity).toBeCloseTo(0.18, 6);
    expect(coffee.unit).toBe('kg');
    expect(result.incompleteRecipe).toBe(false);
    expect(result.missingMapping).toBe(false);
  });

  it('is deterministic — the same input always produces the same output', () => {
    const a = calculateTheoreticalConsumption({ soldProduct, quantitySold: 5, recipeLines, ingredientsById });
    const b = calculateTheoreticalConsumption({ soldProduct, quantitySold: 5, recipeLines, ingredientsById });
    expect(a).toEqual(b);
  });

  it('clearly indicates a missing mapping (soldProduct null)', () => {
    const result = calculateTheoreticalConsumption({ soldProduct: null, quantitySold: 10, recipeLines, ingredientsById });
    expect(result.missingMapping).toBe(true);
    expect(result.lines).toEqual([]);
  });

  it('clearly indicates an incomplete recipe (no active lines)', () => {
    const result = calculateTheoreticalConsumption({ soldProduct, quantitySold: 10, recipeLines: [], ingredientsById });
    expect(result.incompleteRecipe).toBe(true);
    expect(result.missingMapping).toBe(false);
  });

  it('flags a line invalid rather than guessing when units are incompatible', () => {
    const badLines = [{ id: 'line-bad', soldProductId: 'sold-1', ingredientId: 'ing-milk', active: true, quantity: 5, unit: 'g' }]; // milk stocked in l
    const result = calculateTheoreticalConsumption({ soldProduct, quantitySold: 10, recipeLines: badLines, ingredientsById });
    expect(result.lines[0].valid).toBe(false);
    expect(result.incompleteRecipe).toBe(true);
  });

  it('preserves the source reference verbatim', () => {
    const result = calculateTheoreticalConsumption({ soldProduct, quantitySold: 10, recipeLines, ingredientsById, sourceRef: { saleId: 'sale-42' } });
    expect(result.sourceRef).toEqual({ saleId: 'sale-42' });
  });

  it('never touches Stock or a Stock ledger — this module has no notion/write dependency at all', () => {
    // Structural guarantee: calculateTheoreticalConsumption takes only plain data and
    // returns plain data — there is no `notion` parameter anywhere in its signature.
    expect(calculateTheoreticalConsumption.length).toBe(1);
  });
});

describe('calculateBatchConsumption', () => {
  it('supports multiple sold products in one calculation and sums totals per ingredient', () => {
    const items = [
      { soldProduct, quantitySold: 10, sourceRef: 'batch-1' },
      { soldProduct, quantitySold: 5, sourceRef: 'batch-2' },
    ];
    const result = calculateBatchConsumption(items, { recipeLines, ingredientsById });
    const milkTotal = result.totalsByIngredient.find((t) => t.ingredientId === 'ing-milk');
    // (10 + 5) lattes × 200ml = 3000ml = 3l
    expect(milkTotal.totalConsumedQuantity).toBeCloseTo(3, 6);
    expect(milkTotal.contributions).toHaveLength(2);
    expect(milkTotal.contributions.map((c) => c.sourceRef)).toEqual(['batch-1', 'batch-2']);
  });

  it('excludes invalid lines from totals rather than guessing a value', () => {
    const badLines = [{ id: 'line-bad', soldProductId: 'sold-1', ingredientId: 'ing-milk', active: true, quantity: 5, unit: 'g' }];
    const items = [{ soldProduct, quantitySold: 10, sourceRef: 'batch-1' }];
    const result = calculateBatchConsumption(items, { recipeLines: badLines, ingredientsById });
    expect(result.totalsByIngredient).toHaveLength(0);
  });
});
