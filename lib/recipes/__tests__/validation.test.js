import { describe, it, expect } from 'vitest';
import { validateRecipeLine } from '../validation.js';

const soldProduct = { id: 'sold-1', name: 'Latte' };
const ingredient = { id: 'ing-1', name: 'Lait entier', active: true, uniteStock: 'ml' };

describe('validateRecipeLine', () => {
  it('accepts a valid line', () => {
    const result = validateRecipeLine({ soldProduct, ingredient, quantity: 200, unit: 'ml' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a missing sold product', () => {
    const result = validateRecipeLine({ soldProduct: null, ingredient, quantity: 200, unit: 'ml' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('MISSING_SOLD_PRODUCT');
  });

  it('rejects a missing ingredient', () => {
    const result = validateRecipeLine({ soldProduct, ingredient: null, quantity: 200, unit: 'ml' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('MISSING_INGREDIENT');
  });

  it('rejects zero or negative quantity', () => {
    expect(validateRecipeLine({ soldProduct, ingredient, quantity: 0, unit: 'ml' }).errors).toContain('INVALID_QUANTITY');
    expect(validateRecipeLine({ soldProduct, ingredient, quantity: -5, unit: 'ml' }).errors).toContain('INVALID_QUANTITY');
  });

  it('accepts a compatible unit conversion (g recipe line against a kg-stocked ingredient)', () => {
    const kgIngredient = { id: 'ing-2', name: 'Farine', active: true, uniteStock: 'kg' };
    const result = validateRecipeLine({ soldProduct, ingredient: kgIngredient, quantity: 50, unit: 'g' });
    expect(result.valid).toBe(true);
  });

  it('rejects incompatible units (mass vs volume)', () => {
    const result = validateRecipeLine({ soldProduct, ingredient, quantity: 50, unit: 'g' }); // ingredient stocked in ml
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('INCOMPATIBLE_UNITS');
  });

  it('rejects an unknown recipe unit', () => {
    const result = validateRecipeLine({ soldProduct, ingredient, quantity: 50, unit: 'cuillère' });
    expect(result.errors).toContain('UNKNOWN_UNIT');
  });

  it('warns (does not reject) when the ingredient stock unit is unset', () => {
    const noUnitIngredient = { id: 'ing-3', name: 'Épice', active: true, uniteStock: '' };
    const result = validateRecipeLine({ soldProduct, ingredient: noUnitIngredient, quantity: 5, unit: 'g' });
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain('INGREDIENT_STOCK_UNIT_UNKNOWN');
  });

  it('rejects an inactive (archived) ingredient', () => {
    const inactive = { ...ingredient, active: false };
    const result = validateRecipeLine({ soldProduct, ingredient: inactive, quantity: 200, unit: 'ml' });
    expect(result.errors).toContain('INACTIVE_INGREDIENT');
  });

  it('rejects a duplicate active product+ingredient line', () => {
    const existingActiveLines = [{ id: 'line-1', soldProductId: 'sold-1', ingredientId: 'ing-1', active: true }];
    const result = validateRecipeLine({ soldProduct, ingredient, quantity: 200, unit: 'ml', existingActiveLines });
    expect(result.errors).toContain('DUPLICATE_ACTIVE_RECIPE_LINE');
  });

  it('does not flag a duplicate against an inactive existing line', () => {
    const existingActiveLines = [{ id: 'line-1', soldProductId: 'sold-1', ingredientId: 'ing-1', active: false }];
    const result = validateRecipeLine({ soldProduct, ingredient, quantity: 200, unit: 'ml', existingActiveLines });
    expect(result.errors).not.toContain('DUPLICATE_ACTIVE_RECIPE_LINE');
  });

  it('excludes the line being updated from its own duplicate check', () => {
    const existingActiveLines = [{ id: 'line-1', soldProductId: 'sold-1', ingredientId: 'ing-1', active: true }];
    const result = validateRecipeLine({
      soldProduct, ingredient, quantity: 200, unit: 'ml', existingActiveLines, excludeLineId: 'line-1',
    });
    expect(result.errors).not.toContain('DUPLICATE_ACTIVE_RECIPE_LINE');
  });
});
