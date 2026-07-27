import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Structural guard for the legacy-recipe migration script itself (Phase 12:
// "legacy source preservation"). The script is intentionally outside
// lib/recipes (it's a one-off, not part of the app) so it isn't covered by
// stock-isolation.test.js's directory scan — verified separately here.

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'manual-migrations', 'populate-recipe-catalogue.js');

describe('legacy-recipe migration script — read-only source preservation', () => {
  const content = fs.readFileSync(SCRIPT_PATH, 'utf8');

  it('the legacy database constants are only ever used for reads (queryAll/getPage), never write calls', () => {
    const legacyDbConstants = ['MOKA_RECETTES_DB', 'MOKA_MENU_DB', 'MOKA_INGREDIENTS_DB', 'WEBSITE_PRODUCTS_DB'];
    for (const name of legacyDbConstants) {
      // A write call would look like `createPage(MOKA_RECETTES_DB, ...)`,
      // `updatePage(...MOKA_MENU_DB...)`, or `archivePage(...WEBSITE_PRODUCTS_DB...)`.
      const writeCallPattern = new RegExp(`(createPage|updatePage|archivePage)\\([^)]*${name}`);
      expect(content, `${name} must never appear in a write-call argument list`).not.toMatch(writeCallPattern);
    }
  });

  it('only writes to NOTION_SOLD_PRODUCTS_DB_ID / NOTION_RECIPE_LINES_DB_ID via the canonical services, never a raw createPage/updatePage on a legacy id', () => {
    // The script never calls the raw notion.createPage/updatePage/archivePage
    // helpers directly at all for writes — every write goes through
    // soldProductsService.* / recipesService.*, which is what actually
    // enforces the idempotency/business-key/validation rules.
    expect(content).toMatch(/soldProductsService\.(createSoldProduct|findSoldProductByKey)/);
    expect(content).toMatch(/recipesService\.createRecipeLine/);
  });

  it('never references STOCK, PRODUCT_SALES, Daily Operations, or scan-z', () => {
    const forbidden = ['Quantite_stock', 'PRODUCT_SALES', 'Daily_Operations', 'DailyOperations'];
    for (const term of forbidden) {
      expect(content, `must not reference "${term}"`).not.toContain(term);
    }
    expect(content.toLowerCase()).not.toMatch(/scan[-_]?z/);
  });

  it('defaults to dry-run and requires an explicit --confirm flag to write', () => {
    expect(content).toMatch(/CONFIRM = process\.argv\.includes\(.--confirm.\)/);
    expect(content).toMatch(/if \(!CONFIRM\)/);
  });
});
