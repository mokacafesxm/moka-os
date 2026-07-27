import { describe, it, expect } from 'vitest';
import { confirmInvoiceReceipt } from '../invoice-receipt.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const STOCK_DB = 'stock-db';

function seed() {
  return {
    'stock-flour': {
      properties: {
        Produit: { title: [{ text: { content: 'Farine' } }] },
        Quantite_stock: { number: 10 },
      },
    },
  };
}

const SAME_IMAGE = 'aGVsbG8gaW52b2ljZQ==';
const OTHER_IMAGE = 'ZGlmZmVyZW50IGludm9pY2U=';

describe('confirmInvoiceReceipt', () => {
  it('the same invoice hash and ingredient cannot increment stock twice', async () => {
    const notion = createFakeNotion(seed());
    const items = [{ stockId: 'stock-flour', name: 'Farine', quantity: 5 }];

    const first = await confirmInvoiceReceipt({ base64: SAME_IMAGE, items, stockDbId: STOCK_DB, notion });
    const second = await confirmInvoiceReceipt({ base64: SAME_IMAGE, items, stockDbId: STOCK_DB, notion });

    expect(first.lines[0].status).toBe('applied');
    expect(second.lines[0].status).toBe('already_applied');
    expect(first.invoiceHash).toBe(second.invoiceHash);

    const page = await notion.getPage('stock-flour');
    expect(page.properties.Quantite_stock.number).toBe(15); // not 20
  });

  it('a different invoice (different bytes) can legitimately add stock again for the same ingredient', async () => {
    const notion = createFakeNotion(seed());
    const items = [{ stockId: 'stock-flour', name: 'Farine', quantity: 5 }];

    await confirmInvoiceReceipt({ base64: SAME_IMAGE, items, stockDbId: STOCK_DB, notion });
    const second = await confirmInvoiceReceipt({ base64: OTHER_IMAGE, items, stockDbId: STOCK_DB, notion });

    expect(second.lines[0].status).toBe('applied');
    const page = await notion.getPage('stock-flour');
    expect(page.properties.Quantite_stock.number).toBe(20);
  });

  it('routes through the canonical supplier-receiving saga when linked to a supplier order', async () => {
    const notion = createFakeNotion({
      ...seed(),
      'order-1': { properties: { Statut: { select: { name: 'Envoyé' } } } },
    });
    const items = [{ stockId: 'stock-flour', name: 'Farine', quantity: 5 }];

    const result = await confirmInvoiceReceipt({
      base64: SAME_IMAGE,
      items,
      supplierOrderId: 'order-1',
      isFinal: true,
      stockDbId: STOCK_DB,
      notion,
    });

    expect(result.origin).toBe('supplier_order_linked');
    expect(result.fullyReceived).toBe(true);
    const order = await notion.getPage('order-1');
    expect(order.properties.Statut.select.name).toBe('Reçu');
  });
});
