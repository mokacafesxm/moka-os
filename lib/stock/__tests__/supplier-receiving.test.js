import { describe, it, expect } from 'vitest';
import { runSupplierReceivingSaga } from '../supplier-receiving.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const STOCK_DB = 'stock-db';

function seed() {
  return {
    'order-1': {
      properties: {
        Besoin: { title: [{ text: { content: 'NEW ORDER : Staff' } }] },
        Statut: { select: { name: 'Envoyé' } },
      },
    },
    'stock-flour': {
      properties: {
        Produit: { title: [{ text: { content: 'Farine' } }] },
        Quantite_stock: { number: 10 },
      },
    },
    'stock-sugar': {
      properties: {
        Produit: { title: [{ text: { content: 'Sucre' } }] },
        Quantite_stock: { number: 5 },
      },
    },
  };
}

describe('runSupplierReceivingSaga', () => {
  it('marks the order received exactly once when every line succeeds on the final call', async () => {
    const notion = createFakeNotion(seed());
    const result = await runSupplierReceivingSaga({
      orderId: 'order-1',
      isFinal: true,
      stockDbId: STOCK_DB,
      lines: [
        { stockId: 'stock-flour', name: 'Farine', quantity: 5 },
        { stockId: 'stock-sugar', name: 'Sucre', quantity: 2 },
      ],
      notion,
    });

    expect(result.success).toBe(true);
    expect(result.fullyReceived).toBe(true);
    expect(result.lines.every((l) => l.status === 'applied')).toBe(true);

    const order = await notion.getPage('order-1');
    expect(order.properties.Statut.select.name).toBe('Reçu');

    const flour = await notion.getPage('stock-flour');
    expect(flour.properties.Quantite_stock.number).toBe(15);
  });

  it('a retry after partial success does not reapply successful lines, and only the failed line is retried', async () => {
    const notion = createFakeNotion(seed());

    // First attempt: flour line is invalid (0 qty), sugar line succeeds. Not final yet.
    const attempt1 = await runSupplierReceivingSaga({
      orderId: 'order-1',
      isFinal: false,
      stockDbId: STOCK_DB,
      lines: [
        { stockId: 'stock-flour', name: 'Farine', quantity: 0 }, // invalid -> rejected
        { stockId: 'stock-sugar', name: 'Sucre', quantity: 2 },
      ],
      notion,
    });
    expect(attempt1.fullyReceived).toBe(false);
    expect(attempt1.lines.find((l) => l.stockId === 'stock-flour').status).toBe('rejected');
    expect(attempt1.lines.find((l) => l.stockId === 'stock-sugar').status).toBe('applied');

    const sugarAfterFirst = await notion.getPage('stock-sugar');
    expect(sugarAfterFirst.properties.Quantite_stock.number).toBe(7); // 5 + 2, applied once

    // Retry, now final, with the corrected flour quantity — sugar line resent unchanged.
    const attempt2 = await runSupplierReceivingSaga({
      orderId: 'order-1',
      isFinal: true,
      stockDbId: STOCK_DB,
      lines: [
        { stockId: 'stock-flour', name: 'Farine', quantity: 5 },
        { stockId: 'stock-sugar', name: 'Sucre', quantity: 2 },
      ],
      notion,
    });

    expect(attempt2.fullyReceived).toBe(true);
    expect(attempt2.lines.find((l) => l.stockId === 'stock-sugar').status).toBe('already_applied');
    expect(attempt2.lines.find((l) => l.stockId === 'stock-flour').status).toBe('applied');

    const sugarAfterRetry = await notion.getPage('stock-sugar');
    expect(sugarAfterRetry.properties.Quantite_stock.number).toBe(7); // unchanged — not reapplied

    const flourAfterRetry = await notion.getPage('stock-flour');
    expect(flourAfterRetry.properties.Quantite_stock.number).toBe(15); // 10 + 5, applied once

    const order = await notion.getPage('order-1');
    expect(order.properties.Statut.select.name).toBe('Reçu');
  });

  it('a failed stock line does not mark the order fully received even on the final call', async () => {
    const notion = createFakeNotion(seed());
    const result = await runSupplierReceivingSaga({
      orderId: 'order-1',
      isFinal: true,
      stockDbId: STOCK_DB,
      lines: [
        { stockId: 'stock-flour', name: 'Farine', quantity: -1 }, // invalid -> rejected
      ],
      notion,
    });

    expect(result.fullyReceived).toBe(false);
    const order = await notion.getPage('order-1');
    expect(order.properties.Statut.select.name).toBe('Envoyé'); // unchanged
  });

  it('resending the exact same full call twice (idempotent retry of the whole saga) does not double stock', async () => {
    const notion = createFakeNotion(seed());
    const lines = [{ stockId: 'stock-flour', name: 'Farine', quantity: 5 }];

    await runSupplierReceivingSaga({ orderId: 'order-1', isFinal: true, stockDbId: STOCK_DB, lines, notion });
    const second = await runSupplierReceivingSaga({ orderId: 'order-1', isFinal: true, stockDbId: STOCK_DB, lines, notion });

    expect(second.fullyReceived).toBe(true);
    expect(second.lines[0].status).toBe('already_applied');
    const flour = await notion.getPage('stock-flour');
    expect(flour.properties.Quantite_stock.number).toBe(15); // not 20
  });
});
