import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import ExcelJS from 'exceljs';

import { createMockNotion } from '../helpers/mock-notion-fetch.js';
import { PILOTAGE_TARGETS } from '../../config/pilotage-targets.js';
import { analyzeDocument, runPreflight, runCommit } from '../../notion/commit-pipeline.js';

const ENV_KEYS = [
  'IMPORTS_ESTABLISHMENTS',
  'NOTION_IMPORT_RUNS_DB_ID',
  'NOTION_DAILY_OPERATIONS_DB_ID',
  'NOTION_PAYMENT_METHODS_DB_ID',
  'NOTION_PRODUCT_SALES_DB_ID',
  'NOTION_SALES_CATEGORIES_DB_ID',
  'ANTHROPIC_API_KEY',
];
let savedEnv;
let savedFetch;

const DB_IDS = {
  import_runs: 'db-import-runs',
  daily_operations: 'db-daily-ops',
  payment_methods: 'db-payments',
  product_sales: 'db-product-sales',
  sales_categories: 'db-sales-categories',
};

function fullSchemas() {
  const schemas = {};
  for (const [targetKey, dbId] of Object.entries(DB_IDS)) {
    schemas[dbId] = Object.fromEntries(
      Object.entries(PILOTAGE_TARGETS[targetKey].requiredProperties).map(([name, type]) => [name, { type }])
    );
  }
  return schemas;
}

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  savedFetch = global.fetch;
  process.env.IMPORTS_ESTABLISHMENTS = 'moka-sxm:MOKA Cafe SXM';
  process.env.NOTION_IMPORT_RUNS_DB_ID = DB_IDS.import_runs;
  process.env.NOTION_DAILY_OPERATIONS_DB_ID = DB_IDS.daily_operations;
  process.env.NOTION_PAYMENT_METHODS_DB_ID = DB_IDS.payment_methods;
  process.env.NOTION_PRODUCT_SALES_DB_ID = DB_IDS.product_sales;
  process.env.NOTION_SALES_CATEGORIES_DB_ID = DB_IDS.sales_categories;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  global.fetch = savedFetch;
});

const DAILY_ROW1 = [
  'Synthese quotidienne', null, null, null, null, null, null, null,
  'Modes de ventes', null, null, null,
];
const DAILY_ROW2 = [
  'Date', 'Nombre de tickets', 'Moyenne tickets TTC', 'Moyenne tickets HT', 'Total TTC', 'Total HT', 'CA TTC', 'Clients',
  'A EMPORTER / Total TTC', 'A EMPORTER / Nombre de tickets', 'SUR PLACE / Total TTC', 'SUR PLACE / Nombre de tickets',
];

/** Builds a valid single-day AddicTill "Synthèse quotidienne" xlsx buffer. Every field is internally consistent (HT=TTC, modes sum to total) so validation.valid is true by default. */
async function buildDailySummaryBuffer({ date = '2026-07-01', ticketCount = 10 } = {}) {
  const row = [date, ticketCount, 12.34, 12.34, 123.4, 123.4, 123.4, 15, 60.0, 5, 63.4, 5];
  const total = ['Total', ticketCount, 12.34, 12.34, 123.4, 123.4, 123.4, 15, 60.0, 5, 63.4, 5];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Worksheet');
  sheet.addRow(DAILY_ROW1);
  sheet.addRow(DAILY_ROW2);
  sheet.addRow(row);
  sheet.addRow(total);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Builds a daily summary where the "Modes de ventes" sum deliberately does not match Total TTC — a genuine blocking validation error (TOTAL_MISMATCH), not a warning. */
async function buildInvalidDailySummaryBuffer() {
  const row = ['2026-07-01', 10, 12.34, 12.34, 123.4, 123.4, 123.4, 15, 1.0, 5, 1.0, 5]; // modes sum (2.0) != total (123.4)
  const total = ['Total', 10, 12.34, 12.34, 123.4, 123.4, 123.4, 15, 1.0, 5, 1.0, 5];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Worksheet');
  sheet.addRow(DAILY_ROW1);
  sheet.addRow(DAILY_ROW2);
  sheet.addRow(row);
  sheet.addRow(total);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Column names (and accents) must match exactly what pos-addictill.js's
// parseProductRanking looks up by name, AND include enough of the
// classifier's AddicTill product-ranking signals (Codes barre / Dernière
// vente / Quantité décimale) to reach the auto-classification threshold —
// see classify.js's RULES.pos_export.
const PRODUIT_HEADER = [
  'Produit', 'Rubrique', 'Quantité', 'Quantité décimale', 'CA TTC', 'CA HT', 'Offerts', 'Remises', 'PU',
  'Codes barre', 'Dernière vente',
];

/** Builds a Palmarès produits export with a grand total that deliberately does not match the sum of its own product rows — a blocking TOTAL_MISMATCH. */
async function buildInvalidProductRankingBuffer() {
  const workbook = new ExcelJS.Workbook();
  const produits = workbook.addWorksheet('Produits');
  produits.addRow(PRODUIT_HEADER);
  produits.addRow(['Café', 'Boissons', 10, 10.0, 25.0, 22.0, 0, '', 2.5, '1234567890123', '2026-07-01 10:00:00']);
  produits.addRow(['Total général', '', 999, 999.0, 999.0, 999.0, 0, '', '', '', '']); // deliberately wrong vs the single product row above
  const rubriques = workbook.addWorksheet('Rubriques');
  rubriques.addRow(['Rubrique']);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('analyzeDocument — pure parsing never touches Notion', () => {
  it('makes zero fetch calls while parsing/validating a document', async () => {
    global.fetch = () => {
      throw new Error('analyzeDocument must never call fetch');
    };
    const buffer = await buildDailySummaryBuffer();
    const analysis = await analyzeDocument({ buffer, originalFilename: 'synthese.xlsx' });
    expect(analysis.source_type).toBe('pos_export');
    expect(analysis.report_kind).toBe('daily_summary');
  });
});

describe('runCommit — blocked on validation error', () => {
  it('never writes pilotage rows when the parser reports a blocking TOTAL_MISMATCH, but still logs the attempt for audit', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    const buffer = await buildInvalidDailySummaryBuffer();
    const result = await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });

    expect(result.can_commit).toBe(false);
    expect(result.blocking_reasons).toContain('VALIDATION_ERRORS');
    expect(result.committed).toBe(false);

    // Business dedup / pilotage tables: no page ever written to any of the
    // 4 pilotage targets — only the Import Runs audit record is written.
    const pilotageWrites = Array.from(mock.pages.values()).filter((p) => p.dbId !== DB_IDS.import_runs);
    expect(pilotageWrites).toEqual([]);

    // Audit trail: the blocked attempt IS preserved, with why it failed and the parser version that ran.
    expect(result.import_run_id).toBeTruthy();
    const auditPage = mock.pages.get(result.import_run_id);
    expect(auditPage.properties.status.select.name).toBe('failed');
    expect(auditPage.properties.failure_reason.rich_text[0].plain_text).toContain('VALIDATION_ERRORS');
    expect(auditPage.properties.parser_version.rich_text[0].plain_text).toBe('addictill-v1.0.0');
  });
});

describe('runCommit — invalid Product Ranking blocked by default', () => {
  it('blocks a Palmarès produits export whose totals do not reconcile, but still logs the attempt for audit', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    const buffer = await buildInvalidProductRankingBuffer();
    const result = await runCommit({ buffer, originalFilename: 'palmares.xlsx', establishmentKey: 'moka-sxm' });

    expect(result.report_kind).toBe('product_ranking');
    expect(result.can_commit).toBe(false);
    expect(result.blocking_reasons).toContain('VALIDATION_ERRORS');

    const pilotageWrites = Array.from(mock.pages.values()).filter((p) => p.dbId !== DB_IDS.import_runs);
    expect(pilotageWrites).toEqual([]);
    expect(result.import_run_id).toBeTruthy();
    const auditPage = mock.pages.get(result.import_run_id);
    expect(auditPage.properties.status.select.name).toBe('failed');
  });
});

describe('runCommit — daily summary with non-blocking warnings is allowed', () => {
  it('commits successfully even though the payments-vs-total reconciliation warning is present', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    const buffer = await buildDailySummaryBuffer();
    const preflight = await runPreflight({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });
    expect(preflight.validation.warnings.length).toBeGreaterThan(0); // payments sum (0) != total, non-blocking
    expect(preflight.validation.errors).toEqual([]);
    expect(preflight.can_commit).toBe(true);

    const result = await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });
    expect(result.committed).toBe(true);
    expect(result.commit_result).toBe('success');
    expect(result.validation.warnings.length).toBeGreaterThan(0);
  });
});

describe('runCommit — duplicate file handling', () => {
  it('blocks re-committing the exact same file once it has already succeeded', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const buffer = await buildDailySummaryBuffer();

    const first = await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });
    expect(first.commit_result).toBe('success');

    const second = await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });
    expect(second.can_commit).toBe(false);
    expect(second.blocking_reasons).toContain('DUPLICATE_FILE_ALREADY_COMMITTED');
    expect(second.committed).toBe(false);
  }, 30000);

  it('allows and updates (never duplicates) when a corrected export for the same business day is committed under a different file', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    const original = await buildDailySummaryBuffer({ ticketCount: 10 });
    const first = await runCommit({ buffer: original, originalFilename: 'synthese-v1.xlsx', establishmentKey: 'moka-sxm' });
    expect(first.commit_result).toBe('success');

    const corrected = await buildDailySummaryBuffer({ ticketCount: 12 }); // different file bytes -> different hash, not a "duplicate file"
    const second = await runCommit({ buffer: corrected, originalFilename: 'synthese-v2.xlsx', establishmentKey: 'moka-sxm' });

    expect(second.can_commit).toBe(true);
    expect(second.commit_result).toBe('success');
    expect(second.row_results.find((r) => r.targetKey === 'daily_operations').status).toBe('updated');

    const dailyOpsPages = Array.from(mock.pages.values()).filter((p) => p.dbId === DB_IDS.daily_operations);
    expect(dailyOpsPages.length).toBe(1); // same business key -> one page, updated in place
    expect(dailyOpsPages[0].properties.ticket_count.number).toBe(12);
  }, 30000);
});

describe('runCommit — partial failure is never silently reported as success', () => {
  it('reports commit_result: partial_failure when at least one row write fails', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    mock.queueResponse(
      (url, opts) => opts.method === 'POST' && url.endsWith('/pages') && JSON.parse(opts.body).parent.database_id === DB_IDS.payment_methods,
      { ok: false, status: 500, text: async () => 'simulated failure' }
    );
    global.fetch = mock.fetch;

    // Give the daily summary payment columns so at least one payment_methods row is attempted.
    const workbook = new ExcelJS.Workbook();
    const row1 = [...DAILY_ROW1.slice(0, 8), 'Modes de ventes', null, null, null, 'Encaissements', null];
    const row2 = [...DAILY_ROW2, 'CB / Quantite', 'CB / Total'];
    const dataRow = ['2026-07-01', 10, 12.34, 12.34, 123.4, 123.4, 123.4, 15, 60.0, 5, 63.4, 5, 6, 123.4];
    const totalRow = ['Total', 10, 12.34, 12.34, 123.4, 123.4, 123.4, 15, 60.0, 5, 63.4, 5, 6, 123.4];
    const sheet = workbook.addWorksheet('Worksheet');
    sheet.addRow(row1);
    sheet.addRow(row2);
    sheet.addRow(dataRow);
    sheet.addRow(totalRow);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });

    expect(result.committed).toBe(true);
    expect(result.commit_result).toBe('partial_failure');
    expect(result.commit_result).not.toBe('success');
    expect(result.row_summary.failed).toBeGreaterThan(0);
  });
});

describe('runPreflight — unknown establishment always blocks, never inferred', () => {
  it('blocks when establishmentKey is missing or not in the allowlist', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const buffer = await buildDailySummaryBuffer();

    const missing = await runPreflight({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: null });
    expect(missing.can_commit).toBe(false);
    expect(missing.blocking_reasons).toContain('UNKNOWN_ESTABLISHMENT');

    const unknown = await runPreflight({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'not-configured' });
    expect(unknown.can_commit).toBe(false);
    expect(unknown.blocking_reasons).toContain('UNKNOWN_ESTABLISHMENT');
  });
});

describe('Import Runs — complete audit history (PR4 addendum)', () => {
  it('writes a "preview" audit record on every runPreflight call, distinct from business dedup', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const buffer = await buildDailySummaryBuffer();

    const preflight = await runPreflight({
      buffer,
      originalFilename: 'synthese.xlsx',
      establishmentKey: 'moka-sxm',
      initiatedVia: 'web',
      initiatedBy: 'alice',
    });

    expect(preflight.audit_import_run_id).toBeTruthy();
    const auditPage = mock.pages.get(preflight.audit_import_run_id);
    expect(auditPage.dbId).toBe(DB_IDS.import_runs);
    expect(auditPage.properties.status.select.name).toBe('preview');
    expect(auditPage.properties.attempt_number.number).toBe(1);
    expect(auditPage.properties.initiated_via.select.name).toBe('web');
    expect(auditPage.properties.initiated_by.rich_text[0].plain_text).toBe('alice');
    expect(auditPage.properties.parser_version.rich_text[0].plain_text).toBe('addictill-v1.0.0');

    // Previewing again (same file) is a second, distinct audit event — never overwritten, never merged.
    const secondPreflight = await runPreflight({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });
    expect(secondPreflight.attempt_number).toBe(2);
    expect(secondPreflight.audit_import_run_id).not.toBe(preflight.audit_import_run_id);

    const importRunsPages = Array.from(mock.pages.values()).filter((p) => p.dbId === DB_IDS.import_runs);
    expect(importRunsPages.length).toBe(2);
  }, 30000);

  it('does not write a redundant preview record when runCommit calls runPreflight internally — exactly one audit record per commit attempt', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const buffer = await buildDailySummaryBuffer();

    await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm', initiatedVia: 'cli', initiatedBy: 'root' });

    const importRunsPages = Array.from(mock.pages.values()).filter((p) => p.dbId === DB_IDS.import_runs);
    expect(importRunsPages.length).toBe(1);
    expect(importRunsPages[0].properties.status.select.name).toBe('committed');
    expect(importRunsPages[0].properties.initiated_via.select.name).toBe('cli');
    expect(importRunsPages[0].properties.initiated_by.rich_text[0].plain_text).toBe('root');
  }, 30000);

  it('increments attempt_number and links retry_of_import_run_id across repeated commit attempts of the exact same file, using "retry" as the in-flight placeholder', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    // First attempt fails entirely (simulate a total outage on the daily_operations write).
    mock.queueResponse(
      (url, opts) => opts.method === 'POST' && url.endsWith('/pages') && JSON.parse(opts.body).parent.database_id === DB_IDS.daily_operations,
      { ok: false, status: 500, text: async () => 'simulated outage' }
    );
    global.fetch = mock.fetch;
    const buffer = await buildDailySummaryBuffer();

    const first = await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });
    expect(first.commit_result).toBe('failed');
    expect(first.attempt_number).toBe(1);

    const firstAuditPage = mock.pages.get(first.import_run_id);
    expect(firstAuditPage.properties.status.select.name).toBe('failed');

    // Second attempt (Notion now healthy) — this is a retry of the exact same file, not blocked as a duplicate
    // (the first attempt never reached 'committed').
    const second = await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });
    expect(second.can_commit).toBe(true);
    expect(second.commit_result).toBe('success');
    expect(second.attempt_number).toBe(2);
    // retry_of_import_run_id links to the previous attempt's own generated
    // import_run_id (business id), not its Notion page id.
    const firstOwnImportRunId = firstAuditPage.properties.import_run_id.rich_text[0].plain_text;
    expect(second.retry_of_import_run_id).toBe(firstOwnImportRunId);

    const secondAuditPage = mock.pages.get(second.import_run_id);
    expect(secondAuditPage.properties.status.select.name).toBe('committed');
    expect(secondAuditPage.properties.attempt_number.number).toBe(2);

    // How many attempts, and which retry eventually succeeded — reconstructable from the full history.
    const allRuns = Array.from(mock.pages.values()).filter((p) => p.dbId === DB_IDS.import_runs);
    expect(allRuns.length).toBe(2);
    expect(allRuns.some((r) => r.properties.status.select.name === 'committed')).toBe(true);
  }, 30000);

  it('never blocks a retry after a prior failed/partial_failure attempt — only status "committed" blocks', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    mock.queueResponse(
      (url, opts) => opts.method === 'POST' && url.endsWith('/pages') && JSON.parse(opts.body).parent.database_id === DB_IDS.daily_operations,
      { ok: false, status: 500, text: async () => 'simulated outage' }
    );
    global.fetch = mock.fetch;
    const buffer = await buildDailySummaryBuffer();

    const first = await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });
    expect(first.commit_result).toBe('failed');

    const retry = await runCommit({ buffer, originalFilename: 'synthese.xlsx', establishmentKey: 'moka-sxm' });
    expect(retry.can_commit).toBe(true);
    expect(retry.blocking_reasons).not.toContain('DUPLICATE_FILE_ALREADY_COMMITTED');
  }, 30000);
});
