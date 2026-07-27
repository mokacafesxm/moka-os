import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { extractPdf } from '../../extract.js';
import { parseBankStatement } from '../../parsers/bank-statement.js';

/**
 * Dynamic test suite over lib/importer/__tests__/fixtures/bank/real/ — the
 * folder is gitignored and empty by default (see README_IMPORTER.md
 * "Fixtures et anonymisation"). Drop real (or carefully anonymized) Crédit
 * Mutuel PDFs there and this file picks them up automatically, no code
 * change needed.
 *
 * The `credit_mutuel` profile is now CALIBRATED against 3 real EUR
 * statements (Nov 2025, Jan 2026, Mar 2026 — see docs/ARCHITECTURE.md
 * "PR2A"), not a guess — so these assertions are meaningfully stronger
 * than a pure smoke test. What's intentionally NOT asserted: that every
 * real file always validates cleanly. One of the 3 calibration files has a
 * genuine same-amount débit/crédit collision (two transactions, same
 * amount, different columns — mathematically indistinguishable from flat
 * table data, see resolveDebitCreditAssignment's docstring) that the
 * parser correctly refuses to guess rather than silently mis-assign. When
 * that happens, the only errors present must be TOTAL_MISMATCH (proof the
 * parser degrades safely, not a structural failure) with a matching
 * ambiguity warning — never something unexplained.
 */

const REAL_DIR = path.join(__dirname, '..', 'fixtures', 'bank', 'real');

const realFiles = fs.existsSync(REAL_DIR)
  ? fs.readdirSync(REAL_DIR).filter((name) => name.toLowerCase().endsWith('.pdf'))
  : [];

describe('bank-statement parser — real Crédit Mutuel fixtures', () => {
  if (realFiles.length === 0) {
    it.skip(
      'no real fixtures yet — drop anonymized/real Crédit Mutuel PDFs in lib/importer/__tests__/fixtures/bank/real/ to activate these tests',
      () => {}
    );
  }

  for (const fileName of realFiles) {
    it(`parses ${fileName} into a structurally correct, honestly-validated statement`, async () => {
      const extraction = await extractPdf(path.join(REAL_DIR, fileName));
      const { statement, validation } = parseBankStatement(extraction);

      expect(statement.bank_name).toBe('Crédit Mutuel');
      expect(statement.currency).not.toBeNull();
      expect(statement.account_number).not.toBeNull();
      expect(statement.opening_balance_cents).not.toBeNull();
      expect(statement.closing_balance_cents).not.toBeNull();
      expect(statement.transactions.length).toBeGreaterThan(0);
      expect(typeof validation.valid).toBe('boolean');

      if (!validation.valid) {
        console.warn(`[real-fixture] ${fileName} did not fully validate:`, validation.errors, validation.warnings);
        // Any failure here must be the known, honestly-flagged ambiguity
        // case (TOTAL_MISMATCH from dropped ambiguous transactions) — never
        // a structural error (missing balance/currency, unsupported
        // profile), which would mean the profile itself needs fixing.
        expect(validation.errors.every((e) => e.startsWith('TOTAL_MISMATCH'))).toBe(true);
        expect(validation.warnings.some((w) => w.includes('ambigu'))).toBe(true);
      }
    });
  }
});
