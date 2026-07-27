import { describe, it, expect } from 'vitest';
import { handleStockUpdate } from '../handle-stock-update.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const STOCK_DB = 'stock-db';

describe('handleStockUpdate — replace / manual physical-count mode', () => {
  it('overwrites the absolute quantity, unchanged from pre-patch behavior, no idempotency key needed', async () => {
    const notion = createFakeNotion({
      'stock-1': { properties: { Produit: { title: [{ text: { content: 'Farine' } }] }, Quantite_stock: { number: 10 } } },
    });

    const result = await handleStockUpdate({ id: 'stock-1', poidsTotal: 42, mode: 'replace', stockDbId: STOCK_DB, notion });
    expect(result).toMatchObject({ success: true, newQuantity: 42, action: 'update' });

    const page = await notion.getPage('stock-1');
    expect(page.properties.Quantite_stock.number).toBe(42);
  });

  it('replace mode can be repeated freely (each call is an independent absolute set, by design)', async () => {
    const notion = createFakeNotion({
      'stock-1': { properties: { Produit: { title: [{ text: { content: 'Farine' } }] }, Quantite_stock: { number: 10 } } },
    });
    await handleStockUpdate({ id: 'stock-1', poidsTotal: 42, mode: 'replace', stockDbId: STOCK_DB, notion });
    await handleStockUpdate({ id: 'stock-1', poidsTotal: 42, mode: 'replace', stockDbId: STOCK_DB, notion });
    const page = await notion.getPage('stock-1');
    expect(page.properties.Quantite_stock.number).toBe(42);
  });

  it('creates a new row on replace mode when no id/name match exists (unchanged upsert-on-create behavior)', async () => {
    const notion = createFakeNotion({});
    const result = await handleStockUpdate({ name: 'Nouveau', poidsTotal: 7, mode: 'replace', stockDbId: STOCK_DB, notion });
    expect(result).toMatchObject({ success: true, newQuantity: 7, action: 'create' });
  });
});

describe('handleStockUpdate — additive modes require idempotency', () => {
  it('rejects an add without an idempotencyKey', async () => {
    const notion = createFakeNotion({
      'stock-1': { properties: { Produit: { title: [{ text: { content: 'Farine' } }] }, Quantite_stock: { number: 10 } } },
    });
    const result = await handleStockUpdate({ id: 'stock-1', poidsTotal: 5, mode: 'add', stockDbId: STOCK_DB, notion });
    expect(result.success).toBe(false);
  });

  it('applies an add with a valid key and reports already_applied on retry', async () => {
    const notion = createFakeNotion({
      'stock-1': { properties: { Produit: { title: [{ text: { content: 'Farine' } }] }, Quantite_stock: { number: 10 } } },
    });
    const key = 'manual-receipt:op-1:stock-1';
    const first = await handleStockUpdate({ id: 'stock-1', poidsTotal: 5, mode: 'add', idempotencyKey: key, stockDbId: STOCK_DB, notion });
    const second = await handleStockUpdate({ id: 'stock-1', poidsTotal: 5, mode: 'add', idempotencyKey: key, stockDbId: STOCK_DB, notion });

    expect(first).toMatchObject({ success: true, status: 'applied', newQuantity: 15 });
    expect(second).toMatchObject({ success: true, status: 'already_applied', newQuantity: 15 });
  });
});
