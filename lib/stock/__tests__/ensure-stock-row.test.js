import { describe, it, expect } from 'vitest';
import { ensureStockRowForIngredient, findExistingStockRow } from '../ensure-stock-row.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const STOCK_DB = 'stock-db';

describe('ensureStockRowForIngredient', () => {
  it('creates a new zero-quantity row when none exists', async () => {
    const notion = createFakeNotion({});
    const result = await ensureStockRowForIngredient({
      ingredientId: 'ing-1', ingredientName: 'Farine', stockDbId: STOCK_DB, notion,
    });
    expect(result.created).toBe(true);
    const page = await notion.getPage(result.id);
    expect(page.properties.Quantite_stock.number).toBe(0);
    expect(page.properties.MOKA_Ingredients_Master.relation[0].id).toBe('ing-1');
  });

  it('is idempotent — a second call for the same ingredient does not create a duplicate row', async () => {
    const notion = createFakeNotion({});
    const first = await ensureStockRowForIngredient({ ingredientId: 'ing-1', ingredientName: 'Farine', stockDbId: STOCK_DB, notion });
    const second = await ensureStockRowForIngredient({ ingredientId: 'ing-1', ingredientName: 'Farine', stockDbId: STOCK_DB, notion });
    expect(second.created).toBe(false);
    expect(second.id).toBe(first.id);
    expect(notion._calls.createPage).toBe(1);
  });

  it('concurrent calls for the same ingredient create at most one Stock row', async () => {
    const notion = createFakeNotion({});
    const [a, b, c] = await Promise.all([
      ensureStockRowForIngredient({ ingredientId: 'ing-1', ingredientName: 'Farine', stockDbId: STOCK_DB, notion }),
      ensureStockRowForIngredient({ ingredientId: 'ing-1', ingredientName: 'Farine', stockDbId: STOCK_DB, notion }),
      ensureStockRowForIngredient({ ingredientId: 'ing-1', ingredientName: 'Farine', stockDbId: STOCK_DB, notion }),
    ]);
    expect(notion._calls.createPage).toBe(1);
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
  });

  it('finds an existing row by name even if it was never linked via relation (fixes a gap in the old admin/sync-stock check)', async () => {
    const notion = createFakeNotion({
      'stock-1': { dbId: STOCK_DB, properties: { Produit: { title: [{ text: { content: 'Farine' } }] }, Quantite_stock: { number: 12 } } },
    });
    const result = await ensureStockRowForIngredient({ ingredientId: 'ing-1', ingredientName: 'Farine', stockDbId: STOCK_DB, notion });
    expect(result.created).toBe(false);
    expect(result.id).toBe('stock-1');
    // Never touches the existing row's quantity.
    const page = await notion.getPage('stock-1');
    expect(page.properties.Quantite_stock.number).toBe(12);
  });

  it('never resets an existing row to zero', async () => {
    const notion = createFakeNotion({
      'stock-1': {
        dbId: STOCK_DB,
        properties: {
          Produit: { title: [{ text: { content: 'Farine' } }] },
          Quantite_stock: { number: 42 },
          MOKA_Ingredients_Master: { relation: [{ id: 'ing-1' }] },
        },
      },
    });
    await ensureStockRowForIngredient({ ingredientId: 'ing-1', ingredientName: 'Farine', stockDbId: STOCK_DB, notion });
    const page = await notion.getPage('stock-1');
    expect(page.properties.Quantite_stock.number).toBe(42);
    expect(notion._calls.createPage).toBe(0);
  });
});

describe('findExistingStockRow', () => {
  it('matches by relation before falling back to name', async () => {
    const notion = createFakeNotion({
      'stock-1': { dbId: STOCK_DB, properties: { Produit: { title: [{ text: { content: 'Other name' } }] }, MOKA_Ingredients_Master: { relation: [{ id: 'ing-1' }] } } },
    });
    const id = await findExistingStockRow('ing-1', 'Farine', { stockDbId: STOCK_DB, notion });
    expect(id).toBe('stock-1');
  });

  it('returns null when nothing matches', async () => {
    const notion = createFakeNotion({});
    const id = await findExistingStockRow('ing-1', 'Farine', { stockDbId: STOCK_DB, notion });
    expect(id).toBeNull();
  });
});
