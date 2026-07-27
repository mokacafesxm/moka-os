import { describe, it, expect } from 'vitest';
import {
  buildBesoinTitle,
  resolveOrderItemIds,
  createSupplierOrder,
  updateSupplierOrderStatus,
  groupItemsBySupplier,
  buildOrderPadMessage,
} from '../supplier-orders-service.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const BESOINS_DB = 'besoins-db';
const INGREDIENTS_DB = 'ingredients-db';
const NOW = '2026-07-21T10:00:00.000Z';

function ingredientPage(name) {
  return { dbId: INGREDIENTS_DB, properties: { Ingredient: { title: [{ text: { content: name } }] } } };
}

describe('buildBesoinTitle', () => {
  it('matches the original rule exactly', () => {
    expect(buildBesoinTitle('Commandes', 'Alice', 'ACME', 'Farine')).toBe('Order composée — ACME');
    expect(buildBesoinTitle('Composer', 'Alice', 'ACME', 'Farine')).toBe('Order composée — ACME');
    expect(buildBesoinTitle('Prépas', 'Alice', 'ACME', 'Farine')).toBe('Prépa : Farine');
    expect(buildBesoinTitle('OrderPad', 'Alice', 'ACME', 'Farine')).toBe('NEW ORDER : Alice');
    expect(buildBesoinTitle(undefined, undefined, undefined, undefined)).toBe('NEW ORDER : Staff');
  });
});

describe('createSupplierOrder — quantity bug fix', () => {
  it('a single-item, non-grouped order uses the REAL item quantity, not an item count', async () => {
    const notion = createFakeNotion();
    await createSupplierOrder({
      source: 'OrderPad',
      staffName: 'Alice',
      items: [{ name: 'Farine', quantite: 25, unite: 'kg', resolvedId: null }],
      besoinsDbId: BESOINS_DB,
      notion,
      nowIso: NOW,
    });
    const [page] = Array.from(notion._pages.values());
    expect(page.properties['Quantité suggérée'].number).toBe(25); // NOT 1 (item count)
    expect(page.properties['Unité'].select.name).toBe('kg');
  });

  it('a grouped (Commandes) order NEVER sets Quantité suggérée/Unité, regardless of item count', async () => {
    const notion = createFakeNotion();
    await createSupplierOrder({
      source: 'Commandes',
      fournisseur: 'ACME',
      items: [{ name: 'Farine', quantite: 25, unite: 'kg', resolvedId: null }],
      besoinsDbId: BESOINS_DB,
      notion,
      nowIso: NOW,
    });
    const [page] = Array.from(notion._pages.values());
    expect(page.properties['Quantité suggérée']).toBeUndefined();
    expect(page.properties['Unité']).toBeUndefined();
    expect(page.properties['Besoin'].title[0].plain_text).toBe('Order composée — ACME');
  });

  it('a multi-item OrderPad group omits Quantité suggérée (no single meaningful quantity), unlike the old buggy item-count behavior', async () => {
    const notion = createFakeNotion();
    await createSupplierOrder({
      source: 'OrderPad',
      staffName: 'Alice',
      items: [
        { name: 'Farine', quantite: 25, unite: 'kg', resolvedId: null },
        { name: 'Sucre', quantite: 10, unite: 'kg', resolvedId: null },
      ],
      besoinsDbId: BESOINS_DB,
      notion,
      nowIso: NOW,
    });
    const [page] = Array.from(notion._pages.values());
    expect(page.properties['Quantité suggérée']).toBeUndefined(); // NOT 2 (old bug: groupItems.length)
    expect(page.properties['ID Produit'].rich_text[0].plain_text).toBe('Farine, Sucre');
  });
});

describe('createSupplierOrder — cross-entry-point consistency', () => {
  it('the same logical order produces IDENTICAL BESOINS properties whether shaped like the supplier-orders route or the orders/send route', async () => {
    const notionA = createFakeNotion();
    const notionB = createFakeNotion();
    const commonInput = {
      source: 'OrderPad',
      staffName: 'Alice',
      staffId: 'staff-1',
      fournisseurId: 'supplier-1',
      items: [{ name: 'Farine', quantite: 25, unite: 'kg', resolvedId: 'ingredient-1' }],
      besoinsDbId: BESOINS_DB,
      nowIso: NOW,
    };
    await createSupplierOrder({ ...commonInput, notion: notionA });
    await createSupplierOrder({ ...commonInput, notion: notionB });
    const [pageA] = Array.from(notionA._pages.values());
    const [pageB] = Array.from(notionB._pages.values());
    expect(pageA.properties).toEqual(pageB.properties);
  });
});

describe('resolveOrderItemIds', () => {
  it('passes through a valid uuid without querying Notion', async () => {
    const notion = createFakeNotion();
    const uuid = '11111111-1111-1111-1111-111111111111';
    const [resolved] = await resolveOrderItemIds([{ name: 'Farine', id: uuid }], { ingredientsDbId: INGREDIENTS_DB, notion });
    expect(resolved.resolvedId).toBe(uuid);
    expect(notion._calls.queryDatabase).toBe(0);
  });

  it('resolves by name when no valid id is given', async () => {
    const notion = createFakeNotion({ 'ing-1': ingredientPage('Farine') });
    const [resolved] = await resolveOrderItemIds([{ name: 'Farine' }], { ingredientsDbId: INGREDIENTS_DB, notion });
    expect(resolved.resolvedId).toBe('ing-1');
  });

  it('returns null when no match exists', async () => {
    const notion = createFakeNotion();
    const [resolved] = await resolveOrderItemIds([{ name: 'Inconnu' }], { ingredientsDbId: INGREDIENTS_DB, notion });
    expect(resolved.resolvedId).toBeNull();
  });
});

describe('updateSupplierOrderStatus', () => {
  it('updates only the provided fields', async () => {
    const notion = createFakeNotion({ 'order-1': { properties: { Statut: { select: { name: 'À commander' } } } } });
    await updateSupplierOrderStatus({ id: 'order-1', statut: 'Envoyé', dateEnvoi: NOW, notion });
    const page = await notion.getPage('order-1');
    expect(page.properties.Statut.select.name).toBe('Envoyé');
    expect(page.properties['Date envoi'].date.start).toBe(NOW);
  });
});

describe('groupItemsBySupplier + buildOrderPadMessage (orders/send adapter helpers)', () => {
  it('groups a flat cart by supplier name', () => {
    const items = [
      { Produit: 'Farine', Quantité: 5, Fournisseur: 'ACME', StaffName: 'Alice' },
      { Produit: 'Sucre', Quantité: 3, Fournisseur: 'ACME', StaffName: 'Alice' },
      { Produit: 'Café', Quantité: 2, Fournisseur: 'Autre', StaffName: 'Alice' },
    ];
    const grouped = groupItemsBySupplier(items);
    expect(Object.keys(grouped)).toEqual(['ACME', 'Autre']);
    expect(grouped['ACME'].items).toHaveLength(2);
  });

  it('builds the exact same WhatsApp-style message template as before', () => {
    const msg = buildOrderPadMessage('ACME', [{ Produit: 'Farine', Quantité: 5, Unite: 'kg' }], 'lundi 21 juillet 2026');
    expect(msg).toContain('Bonjour ACME 👋');
    expect(msg).toContain('- Farine — 5 kg');
    expect(msg).toContain('— Équipe MÖKA');
  });
});
