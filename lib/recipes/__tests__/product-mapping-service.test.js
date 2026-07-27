import { describe, it, expect } from 'vitest';
import { resolveSoldProductForSale, buildProductMappingReport } from '../product-mapping-service.js';

const soldProducts = [{ id: 'sold-1', productKey: 'moka-latte', requiresRecipe: true }];

describe('resolveSoldProductForSale', () => {
  it('matches by exact (normalized) moka_product_key', () => {
    const row = { moka_product_key: ' Moka-Latte ' };
    expect(resolveSoldProductForSale(row, soldProducts).id).toBe('sold-1');
  });

  it('returns null for an unmapped sale (never invents a mapping)', () => {
    expect(resolveSoldProductForSale({ moka_product_key: null }, soldProducts)).toBeNull();
    expect(resolveSoldProductForSale({ moka_product_key: 'unknown-key' }, soldProducts)).toBeNull();
  });
});

describe('buildProductMappingReport', () => {
  const ingredientsById = { 'ing-1': { active: true, uniteStock: 'ml', name: 'Lait' } };

  it('unmapped Product Sales rows remain unmapped, not silently matched', () => {
    const rows = [{ moka_product_key: null, product_name_raw: 'Something Unknown' }];
    const report = buildProductMappingReport(rows, soldProducts, [], ingredientsById);
    expect(report.rows[0].mapped).toBe(false);
    expect(report.unmappedRows).toHaveLength(1);
    expect(report.unmappedRows[0].product_name_raw).toBe('Something Unknown');
  });

  it('reports recipe completeness for a mapped row', () => {
    const rows = [{ moka_product_key: 'moka-latte' }];
    const recipeLines = [{ id: 'line-1', soldProductId: 'sold-1', ingredientId: 'ing-1', active: true, quantity: 200, unit: 'ml' }];
    const report = buildProductMappingReport(rows, soldProducts, recipeLines, ingredientsById);
    expect(report.rows[0].mapped).toBe(true);
    expect(report.rows[0].recipeStatus).toBe('complete');
  });

  it('reports "unmapped" recipe status for a mapped sale whose product has no recipe lines yet', () => {
    const rows = [{ moka_product_key: 'moka-latte' }];
    const report = buildProductMappingReport(rows, soldProducts, [], ingredientsById);
    expect(report.rows[0].mapped).toBe(true);
    expect(report.rows[0].recipeStatus).toBe('unmapped');
  });
});
