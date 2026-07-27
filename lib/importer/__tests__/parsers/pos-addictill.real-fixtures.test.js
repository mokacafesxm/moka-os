import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { extractContent } from '../../extract.js';
import { parsePosAddictill } from '../../parsers/pos-addictill.js';

/**
 * Dynamic test suite over lib/importer/__tests__/fixtures/pos/real/ — the
 * folder is gitignored and empty by default (see README_IMPORTER.md
 * "Fixtures et anonymisation"). Drop real (or carefully anonymized)
 * AddicTill exports there and this file picks them up automatically, no
 * code change needed. Synthetic fixtures (pos-addictill.test.js) remain
 * the mandatory CI test source — this suite only runs when real files
 * happen to be present locally, and skips gracefully otherwise.
 *
 * No real financial figures are hardcoded here — only structural
 * assertions — so nothing sensitive ever ends up in a committed file.
 * A confirmed real finding kept in mind by these assertions: one of the
 * 3 calibration files (see docs/ARCHITECTURE.md "PR3") has a genuine
 * grand-total/category-subtotal inconsistency in the source data itself
 * (not a parsing bug, verified against raw ExcelJS output) — so `valid`
 * is deliberately not asserted to always be true for product rankings.
 */

const REAL_DIR = path.join(__dirname, '..', 'fixtures', 'pos', 'real');

const realFiles = fs.existsSync(REAL_DIR)
  ? fs.readdirSync(REAL_DIR).filter((name) => name.toLowerCase().endsWith('.xlsx'))
  : [];

describe('pos-addictill parser — real AddicTill fixtures', () => {
  if (realFiles.length === 0) {
    it.skip(
      'no real fixtures yet — drop real/anonymized AddicTill exports in lib/importer/__tests__/fixtures/pos/real/ to activate these tests',
      () => {}
    );
  }

  for (const fileName of realFiles) {
    it(`parses ${fileName} into a structurally correct, honestly-validated report`, async () => {
      const extraction = await extractContent(path.join(REAL_DIR, fileName), 'xlsx');
      const { reportType, statement, validation } = parsePosAddictill(extraction);

      expect(reportType).not.toBeNull();
      expect(statement).not.toBeNull();
      expect(typeof validation.valid).toBe('boolean');

      if (reportType === 'daily_summary') {
        expect(statement.days.length).toBeGreaterThan(0);
        expect(statement.currency).toMatch(/^(EUR|USD)$/);
      } else if (reportType === 'product_ranking') {
        expect(statement.products.length).toBeGreaterThan(0);
        expect(Array.isArray(statement.unmapped_products)).toBe(true);
      }

      if (!validation.valid) {
        console.warn(`[real-fixture] ${fileName} did not fully validate:`, validation.errors.length, 'error(s),', validation.warnings.length, 'warning(s)');
      }
    });
  }
});
