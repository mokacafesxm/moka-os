import { describe, it, expect } from 'vitest';
import { createSoldProduct } from '../sold-products-service.js';
import { createRecipeLine, updateRecipeLine, archiveRecipeLine, listRecipeLines } from '../recipes-service.js';
import { createFakeNotion } from './helpers/fake-notion.js';

const SOLD_PRODUCTS_DB = 'sold-products-db';
const RECIPE_LINES_DB = 'recipe-lines-db';

function ingredientPage(name, uniteStock, extra = {}) {
  return {
    dbId: 'ingredients-db',
    properties: {
      Ingredient: { title: [{ text: { content: name } }] },
      ...(uniteStock ? { Unite_stock: { select: { name: uniteStock } } } : {}),
    },
    ...extra,
  };
}

async function setup() {
  const notion = createFakeNotion({
    'ing-milk': ingredientPage('Lait entier', 'ml'),
    'ing-coffee': ingredientPage('Café grains', 'g'),
    'ing-archived': ingredientPage('Vieux produit', 'g', { archived: true }),
  });
  const { id: soldProductId } = await createSoldProduct(
    { name: 'Latte', productKey: 'moka-latte' },
    { soldProductsDbId: SOLD_PRODUCTS_DB, notion }
  );
  return { notion, soldProductId };
}

describe('createRecipeLine', () => {
  it('a sold product can have multiple ingredient recipe lines', async () => {
    const { notion, soldProductId } = await setup();
    const milk = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 200, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    const coffee = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-coffee', quantity: 18, unit: 'g' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    expect(milk.success).toBe(true);
    expect(coffee.success).toBe(true);
    const lines = await listRecipeLines({ recipeLinesDbId: RECIPE_LINES_DB, notion, soldProductId });
    expect(lines).toHaveLength(2);
  });

  it('rejects a duplicate active product+ingredient line', async () => {
    const { notion, soldProductId } = await setup();
    await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 200, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    const second = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 100, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    expect(second.success).toBe(false);
    expect(second.errors).toContain('DUPLICATE_ACTIVE_RECIPE_LINE');
  });

  it('rejects zero/negative quantity', async () => {
    const { notion, soldProductId } = await setup();
    const result = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 0, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    expect(result.success).toBe(false);
    expect(result.errors).toContain('INVALID_QUANTITY');
  });

  it('rejects incompatible units', async () => {
    const { notion, soldProductId } = await setup();
    const result = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 5, unit: 'g' }, // milk stocked in ml
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    expect(result.success).toBe(false);
    expect(result.errors).toContain('INCOMPATIBLE_UNITS');
  });

  it('resolves the sold product by product_key as an alternative to soldProductId', async () => {
    const { notion } = await setup();
    const result = await createRecipeLine(
      { soldProductKey: 'moka-latte', ingredientId: 'ing-milk', quantity: 200, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    expect(result.success).toBe(true);
  });

  it('rejects a missing ingredient', async () => {
    const { notion, soldProductId } = await setup();
    const result = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-does-not-exist', quantity: 5, unit: 'g' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    expect(result.success).toBe(false);
    expect(result.errors).toContain('MISSING_INGREDIENT');
  });

  it('rejects an archived (inactive) ingredient', async () => {
    const { notion, soldProductId } = await setup();
    const result = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-archived', quantity: 5, unit: 'g' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    expect(result.success).toBe(false);
    expect(result.errors).toContain('INACTIVE_INGREDIENT');
  });

  it('never modifies the ingredient page or any Stock property', async () => {
    const { notion, soldProductId } = await setup();
    await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 200, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    expect(notion._calls.updatePage).toBe(0); // only createPage was used — INGREDIENTS was only read
    const ingredientPageAfter = await notion.getPage('ing-milk');
    expect(ingredientPageAfter.properties.Quantite_stock).toBeUndefined();
  });
});

describe('updateRecipeLine', () => {
  it('updates the quantity while keeping other fields, and re-validates', async () => {
    const { notion, soldProductId } = await setup();
    const { id } = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 200, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    const result = await updateRecipeLine(id, { quantity: 250 }, { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion });
    expect(result.success).toBe(true);
    const [line] = await listRecipeLines({ recipeLinesDbId: RECIPE_LINES_DB, notion, soldProductId });
    expect(line.quantity).toBe(250);
  });

  it('does not flag itself as a duplicate when updating', async () => {
    const { notion, soldProductId } = await setup();
    const { id } = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 200, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    const result = await updateRecipeLine(id, { quantity: 300 }, { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion });
    expect(result.success).toBe(true);
  });
});

describe('archiveRecipeLine', () => {
  it('archives a line and frees up the product+ingredient pair for a new active line', async () => {
    const { notion, soldProductId } = await setup();
    const { id } = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 200, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    await archiveRecipeLine(id, { notion });
    const second = await createRecipeLine(
      { soldProductId, ingredientId: 'ing-milk', quantity: 220, unit: 'ml' },
      { soldProductsDbId: SOLD_PRODUCTS_DB, recipeLinesDbId: RECIPE_LINES_DB, notion }
    );
    expect(second.success).toBe(true);
  });
});
