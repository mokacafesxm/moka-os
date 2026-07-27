import { describe, it, expect } from 'vitest';
import {
  buildIngredientProperties,
  createIngredient,
  updateIngredient,
  archiveIngredient,
} from '../ingredients-service.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const INGREDIENTS_DB = 'ingredients-db';
const FOURNISSEURS_DB = 'fournisseurs-db';
const STOCK_DB = 'stock-db';

describe('buildIngredientProperties — partial mode (settings/products behavior)', () => {
  it('always includes Ingredient and Visible_OrderPad (defaulting to true)', () => {
    const props = buildIngredientProperties({ ingredient: 'Farine' });
    expect(props.Ingredient.title[0].text.content).toBe('Farine');
    expect(props.Visible_OrderPad.checkbox).toBe(true);
  });

  it('omits fields that are not provided (partial update, does not clear existing values)', () => {
    const props = buildIngredientProperties({ ingredient: 'Farine' });
    expect(props.Categorie).toBeUndefined();
    expect(props.Notes).toBeUndefined();
  });

  it('includes optional fields when provided', () => {
    const props = buildIngredientProperties({ ingredient: 'Farine', categorie: 'Sec', notes: 'note' });
    expect(props.Categorie.select.name).toBe('Sec');
    expect(props.Notes.rich_text[0].text.content).toBe('note');
  });
});

describe('buildIngredientProperties — full mode (products/update behavior)', () => {
  it('always includes every field, even when absent (as null/select:null)', () => {
    const props = buildIngredientProperties({ ingredient: 'Farine' }, { mode: 'full' });
    expect(props.Categorie).toEqual({ select: null });
    expect(props.Seuil_alerte).toEqual({ number: null });
  });
});

describe('createIngredient', () => {
  it('creates the ingredient and bootstraps a Stock row', async () => {
    const notion = createFakeNotion({});
    const result = await createIngredient(
      { ingredient: 'Farine', uniteStock: 'kg' },
      { ingredientsDbId: INGREDIENTS_DB, fournisseursDbId: FOURNISSEURS_DB, stockDbId: STOCK_DB, notion }
    );
    expect(result.id).toBeTruthy();
    const stockPages = (await notion.queryDatabase(STOCK_DB)).filter((p) => p.dbId === STOCK_DB);
    expect(stockPages).toHaveLength(1);
    expect(stockPages[0].properties.Quantite_stock.number).toBe(0);
    expect(stockPages[0].properties.MOKA_Ingredients_Master.relation[0].id).toBe(result.id);
  });

  it('resolves a default supplier by name', async () => {
    const notion = createFakeNotion({
      'sup-1': { dbId: FOURNISSEURS_DB, properties: { Fournisseur: { title: [{ text: { content: 'ACME' } }] } } },
    });
    const result = await createIngredient(
      { ingredient: 'Farine', fournisseurDefaut: 'ACME' },
      { ingredientsDbId: INGREDIENTS_DB, fournisseursDbId: FOURNISSEURS_DB, notion, bootstrapStockRow: false }
    );
    const page = await notion.getPage(result.id);
    expect(page.properties['Fournisseur par defaut'].relation[0].id).toBe('sup-1');
  });

  it('rejects when no name is given', async () => {
    const notion = createFakeNotion({});
    await expect(createIngredient({}, { ingredientsDbId: INGREDIENTS_DB, fournisseursDbId: FOURNISSEURS_DB, notion })).rejects.toThrow();
  });
});

describe('updateIngredient', () => {
  it('partial mode leaves omitted fields untouched', async () => {
    const notion = createFakeNotion({
      'ing-1': { dbId: INGREDIENTS_DB, properties: { Ingredient: { title: [{ text: { content: 'Farine' } }] }, Categorie: { select: { name: 'Sec' } } } },
    });
    await updateIngredient('ing-1', { ingredient: 'Farine' }, { fournisseursDbId: FOURNISSEURS_DB, notion, mode: 'partial' });
    const page = await notion.getPage('ing-1');
    expect(page.properties.Categorie.select.name).toBe('Sec'); // untouched
  });

  it('full mode clears the default-supplier relation when nothing resolves', async () => {
    const notion = createFakeNotion({
      'ing-1': { dbId: INGREDIENTS_DB, properties: { Ingredient: { title: [{ text: { content: 'Farine' } }] }, 'Fournisseur par defaut': { relation: [{ id: 'sup-1' }] } } },
    });
    await updateIngredient('ing-1', { ingredient: 'Farine' }, { fournisseursDbId: FOURNISSEURS_DB, notion, mode: 'full' });
    const page = await notion.getPage('ing-1');
    expect(page.properties['Fournisseur par defaut'].relation).toEqual([]);
  });
});

describe('archiveIngredient', () => {
  it('requires an id', async () => {
    await expect(archiveIngredient(null, { notion: createFakeNotion({}) })).rejects.toThrow();
  });
});
