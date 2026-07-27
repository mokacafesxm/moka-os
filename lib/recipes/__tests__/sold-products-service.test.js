import { describe, it, expect } from 'vitest';
import {
  createSoldProduct,
  updateSoldProduct,
  archiveSoldProduct,
  findSoldProductByKey,
  listSoldProducts,
  computeRecipeStatus,
} from '../sold-products-service.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const SOLD_PRODUCTS_DB = 'sold-products-db';

describe('createSoldProduct / findSoldProductByKey / listSoldProducts', () => {
  it('creates a sold product with a product_key', async () => {
    const notion = createFakeNotion({});
    const result = await createSoldProduct({ name: 'Latte', productKey: 'moka-latte' }, { soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    const found = await findSoldProductByKey('moka-latte', { soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    expect(found.id).toBe(result.id);
    expect(found.active).toBe(true);
  });

  it('rejects a duplicate product_key', async () => {
    const notion = createFakeNotion({});
    await createSoldProduct({ name: 'Latte', productKey: 'moka-latte' }, { soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    await expect(
      createSoldProduct({ name: 'Latte 2', productKey: 'moka-latte' }, { soldProductsDbId: SOLD_PRODUCTS_DB, notion })
    ).rejects.toThrow();
  });

  it('requires a name and a product_key', async () => {
    const notion = createFakeNotion({});
    await expect(createSoldProduct({ productKey: 'x' }, { soldProductsDbId: SOLD_PRODUCTS_DB, notion })).rejects.toThrow();
    await expect(createSoldProduct({ name: 'X' }, { soldProductsDbId: SOLD_PRODUCTS_DB, notion })).rejects.toThrow();
  });

  it('findSoldProductByKey returns null when nothing matches (never invents a mapping)', async () => {
    const notion = createFakeNotion({});
    expect(await findSoldProductByKey('unknown', { soldProductsDbId: SOLD_PRODUCTS_DB, notion })).toBeNull();
  });

  it('lists all sold products', async () => {
    const notion = createFakeNotion({});
    await createSoldProduct({ name: 'Latte', productKey: 'moka-latte' }, { soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    await createSoldProduct({ name: 'Cappuccino', productKey: 'moka-cappuccino' }, { soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    const list = await listSoldProducts({ soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    expect(list).toHaveLength(2);
  });
});

describe('updateSoldProduct / archiveSoldProduct', () => {
  it('updates fields', async () => {
    const notion = createFakeNotion({});
    const { id } = await createSoldProduct({ name: 'Latte', productKey: 'moka-latte' }, { soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    await updateSoldProduct(id, { name: 'Latte', productKey: 'moka-latte', category: 'Boissons chaudes' }, { notion });
    const found = await findSoldProductByKey('moka-latte', { soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    expect(found.category).toBe('Boissons chaudes');
  });

  it('archives a sold product', async () => {
    const notion = createFakeNotion({});
    const { id } = await createSoldProduct({ name: 'Latte', productKey: 'moka-latte' }, { soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    await archiveSoldProduct(id, { notion });
    expect(notion._calls.archivePage).toBe(1);
    const list = await listSoldProducts({ soldProductsDbId: SOLD_PRODUCTS_DB, notion });
    expect(list).toHaveLength(0); // archived pages excluded from queries, like real Notion
  });
});

describe('computeRecipeStatus', () => {
  it('is not_required when the product does not need a recipe', () => {
    expect(computeRecipeStatus({ requiresRecipe: false }, [])).toBe('not_required');
  });

  it('is unmapped when no active recipe lines exist', () => {
    expect(computeRecipeStatus({ requiresRecipe: true }, [])).toBe('unmapped');
    expect(computeRecipeStatus({ requiresRecipe: true }, [{ active: false, valid: true }])).toBe('unmapped');
  });

  it('is complete when all active lines are valid', () => {
    const lines = [{ active: true, valid: true }, { active: true, valid: true }];
    expect(computeRecipeStatus({ requiresRecipe: true }, lines)).toBe('complete');
  });

  it('is incomplete when any active line is invalid', () => {
    const lines = [{ active: true, valid: true }, { active: true, valid: false }];
    expect(computeRecipeStatus({ requiresRecipe: true }, lines)).toBe('incomplete');
  });
});
