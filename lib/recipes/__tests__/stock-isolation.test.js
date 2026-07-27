import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Structural guard, not just behavioral: the Recipe Catalogue foundation
// must never modify Current Stock, never write the Stock idempotency
// ledger, and never touch scan-z. Rather than only trusting unit tests to
// catch a future accidental regression, this scans the actual source files
// for the forbidden identifiers — a stronger guarantee than "no test
// happened to exercise that path".

const RECIPES_DIR = path.join(process.cwd(), 'lib', 'recipes');

function sourceFiles() {
  return fs.readdirSync(RECIPES_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(RECIPES_DIR, f));
}

describe('lib/recipes stock isolation', () => {
  it('no file in lib/recipes references Quantite_stock, Applied_Receipts_Ledger, or Stock write helpers', () => {
    const forbidden = [
      'Quantite_stock',
      'Applied_Receipts_Ledger',
      'ensureStockRowForIngredient',
      'applyIdempotentStockAddition',
      'runSupplierReceivingSaga',
      'confirmInvoiceReceipt',
    ];
    for (const file of sourceFiles()) {
      const content = fs.readFileSync(file, 'utf8');
      for (const term of forbidden) {
        expect(content, `${path.basename(file)} must not reference "${term}"`).not.toContain(term);
      }
    }
  });

  it('no file in lib/recipes references scan-z in any spelling', () => {
    for (const file of sourceFiles()) {
      const content = fs.readFileSync(file, 'utf8').toLowerCase();
      expect(content, `${path.basename(file)} must not reference scan-z`).not.toMatch(/scan[-_]?z/);
    }
  });

  it('no file in lib/recipes imports from lib/stock', () => {
    for (const file of sourceFiles()) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content, `${path.basename(file)} must not import lib/stock`).not.toMatch(/require\(['"].*\/stock\//);
    }
  });

  it('the consumption service takes no Notion client and performs no writes — pure data in, data out', () => {
    for (const file of ['consumption-service.js', 'product-mapping-service.js']) {
      const content = fs.readFileSync(path.join(RECIPES_DIR, file), 'utf8');
      expect(content, `${file} must not call createPage/updatePage/archivePage`).not.toMatch(/\.(createPage|updatePage|archivePage)\(/);
    }
  });
});
