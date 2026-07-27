import { describe, it, expect } from 'vitest';
import { applyIdempotentStockAddition } from '../apply-addition.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const STOCK_DB = 'stock-db';

function seedStockPage(id, quantity = 10) {
  return {
    [id]: {
      properties: {
        Produit: { title: [{ text: { content: 'Farine' } }] },
        Quantite_stock: { number: quantity },
      },
    },
  };
}

describe('applyIdempotentStockAddition', () => {
  it('applies a fresh key and increases quantity', async () => {
    const notion = createFakeNotion(seedStockPage('stock-1', 10));
    const result = await applyIdempotentStockAddition({
      id: 'stock-1',
      quantity: 5,
      idempotencyKey: 'supplier-receipt:order-1:ingredient-1',
      stockDbId: STOCK_DB,
      notion,
    });
    expect(result).toMatchObject({ status: 'applied', newQuantity: 15 });
  });

  it('never applies the same idempotency key twice', async () => {
    const notion = createFakeNotion(seedStockPage('stock-1', 10));
    const key = 'supplier-receipt:order-1:ingredient-1';

    const first = await applyIdempotentStockAddition({ id: 'stock-1', quantity: 5, idempotencyKey: key, stockDbId: STOCK_DB, notion });
    const second = await applyIdempotentStockAddition({ id: 'stock-1', quantity: 5, idempotencyKey: key, stockDbId: STOCK_DB, notion });

    expect(first).toMatchObject({ status: 'applied', newQuantity: 15 });
    expect(second).toMatchObject({ status: 'already_applied', newQuantity: 15 });

    const page = await notion.getPage('stock-1');
    expect(page.properties.Quantite_stock.number).toBe(15); // not 20
  });

  it('produces exactly one increment for repeated/simultaneous requests with the same key', async () => {
    const notion = createFakeNotion(seedStockPage('stock-1', 10));
    const key = 'supplier-receipt:order-1:ingredient-1';

    const [a, b, c] = await Promise.all([
      applyIdempotentStockAddition({ id: 'stock-1', quantity: 5, idempotencyKey: key, stockDbId: STOCK_DB, notion }),
      applyIdempotentStockAddition({ id: 'stock-1', quantity: 5, idempotencyKey: key, stockDbId: STOCK_DB, notion }),
      applyIdempotentStockAddition({ id: 'stock-1', quantity: 5, idempotencyKey: key, stockDbId: STOCK_DB, notion }),
    ]);

    const statuses = [a.status, b.status, c.status].sort();
    expect(statuses).toEqual(['already_applied', 'already_applied', 'applied']);

    const page = await notion.getPage('stock-1');
    expect(page.properties.Quantite_stock.number).toBe(15);
  });

  it('allows different legitimate keys to increment the same ingredient independently', async () => {
    const notion = createFakeNotion(seedStockPage('stock-1', 10));

    const first = await applyIdempotentStockAddition({
      id: 'stock-1', quantity: 5, idempotencyKey: 'supplier-receipt:order-1:ingredient-1', stockDbId: STOCK_DB, notion,
    });
    const second = await applyIdempotentStockAddition({
      id: 'stock-1', quantity: 3, idempotencyKey: 'invoice-receipt:abc123:ingredient-1', stockDbId: STOCK_DB, notion,
    });

    expect(first.status).toBe('applied');
    expect(second.status).toBe('applied');
    const page = await notion.getPage('stock-1');
    expect(page.properties.Quantite_stock.number).toBe(18); // 10 + 5 + 3
  });

  it('rejects a missing/invalid idempotency key without mutating stock', async () => {
    const notion = createFakeNotion(seedStockPage('stock-1', 10));
    const result = await applyIdempotentStockAddition({ id: 'stock-1', quantity: 5, idempotencyKey: '', stockDbId: STOCK_DB, notion });
    expect(result.status).toBe('rejected');
    const page = await notion.getPage('stock-1');
    expect(page.properties.Quantite_stock.number).toBe(10);
  });

  it('rejects a non-positive quantity', async () => {
    const notion = createFakeNotion(seedStockPage('stock-1', 10));
    const result = await applyIdempotentStockAddition({
      id: 'stock-1', quantity: 0, idempotencyKey: 'manual-receipt:op-1:ingredient-1', stockDbId: STOCK_DB, notion,
    });
    expect(result.status).toBe('rejected');
    expect(result.reason).toBe('INVALID_QUANTITY');
  });

  it('bootstraps a new Stock row idempotently when no id/name match exists yet', async () => {
    const notion = createFakeNotion({});
    const key = 'manual-receipt:op-1:new-ingredient';

    const first = await applyIdempotentStockAddition({ name: 'Nouveau produit', quantity: 4, idempotencyKey: key, stockDbId: STOCK_DB, notion });
    expect(first.status).toBe('applied');
    expect(notion._calls.createPage).toBe(1);

    // Retry with the same name/key must resolve to the SAME row and not create a second one.
    const second = await applyIdempotentStockAddition({ name: 'Nouveau produit', quantity: 4, idempotencyKey: key, stockDbId: STOCK_DB, notion });
    expect(second.status).toBe('already_applied');
    expect(notion._calls.createPage).toBe(1);
    expect(notion._pages.size).toBe(1);
  });
});
