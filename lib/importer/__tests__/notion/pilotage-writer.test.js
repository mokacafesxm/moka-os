import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createMockNotion } from '../helpers/mock-notion-fetch.js';
import { writeAllPilotageRows, summarizeResults, checkAuthority, computeRowDiff } from '../../notion/pilotage-writer.js';

const ENV_KEYS = [
  'NOTION_DAILY_OPERATIONS_DB_ID',
  'NOTION_PAYMENT_METHODS_DB_ID',
  'NOTION_PRODUCT_SALES_DB_ID',
  'NOTION_SALES_CATEGORIES_DB_ID',
];
let savedEnv;
let savedFetch;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.NOTION_DAILY_OPERATIONS_DB_ID = 'db-daily-ops';
  process.env.NOTION_PAYMENT_METHODS_DB_ID = 'db-payments';
  process.env.NOTION_PRODUCT_SALES_DB_ID = 'db-product-sales';
  process.env.NOTION_SALES_CATEGORIES_DB_ID = 'db-sales-categories';
  savedFetch = global.fetch;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  global.fetch = savedFetch;
});

const dailyOpRow = (overrides = {}) => ({
  import_key: 'do-key-1',
  establishment_key: 'moka-sxm',
  date: '2026-07-01',
  source_type: 'pos_export',
  source_subtype: 'addictill_daily_summary',
  ticket_count: 42,
  total_ttc: 1234.56,
  total_ht: 1100.0,
  ca_ttc: 1234.56,
  clients: 55,
  ...overrides,
});

describe('writeAllPilotageRows — create', () => {
  it('creates a new page per row when nothing matches the import_key', async () => {
    const mock = createMockNotion();
    global.fetch = mock.fetch;

    const results = await writeAllPilotageRows({ dailyOperations: [dailyOpRow()] }, 'run-page-1');

    expect(results).toEqual([
      { targetKey: 'daily_operations', importKey: 'do-key-1', status: 'created', reason: null },
    ]);
    expect(summarizeResults(results)).toEqual({ created: 1, updated: 0, skipped: 0, failed: 0, blocked_precedence: 0 });
  });
});

describe('writeAllPilotageRows — skip vs update', () => {
  it('skips when an existing row already matches every field and source_import', async () => {
    const mock = createMockNotion();
    global.fetch = mock.fetch;
    const created = await writeAllPilotageRows({ dailyOperations: [dailyOpRow()] }, 'run-page-1');
    expect(created[0].status).toBe('created');

    mock.calls.length = 0;
    const results = await writeAllPilotageRows({ dailyOperations: [dailyOpRow()] }, 'run-page-1');

    expect(results).toEqual([
      { targetKey: 'daily_operations', importKey: 'do-key-1', status: 'skipped', reason: null },
    ]);
    expect(mock.calls.some((c) => c.method === 'POST' && c.url.endsWith('/pages'))).toBe(false);
    expect(mock.calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('updates when the same business record is re-submitted with corrected data (never creates a duplicate)', async () => {
    const mock = createMockNotion();
    global.fetch = mock.fetch;
    await writeAllPilotageRows({ dailyOperations: [dailyOpRow({ ticket_count: 10 })] }, 'run-page-1');

    const results = await writeAllPilotageRows(
      { dailyOperations: [dailyOpRow({ ticket_count: 99 })] }, // corrected export, same import_key
      'run-page-1'
    );

    expect(results).toEqual([
      { targetKey: 'daily_operations', importKey: 'do-key-1', status: 'updated', reason: null },
    ]);
    // Still only one page for this business key — no duplicate created.
    const dailyOpsPages = Array.from(mock.pages.values()).filter((p) => p.dbId === 'db-daily-ops');
    expect(dailyOpsPages.length).toBe(1);
    expect(dailyOpsPages[0].properties.ticket_count.number).toBe(99);
  });

  it('updates (rather than skips) when data is identical but source_import points at a different run', async () => {
    const mock = createMockNotion();
    global.fetch = mock.fetch;
    await writeAllPilotageRows({ dailyOperations: [dailyOpRow()] }, 'run-page-1');

    const results = await writeAllPilotageRows({ dailyOperations: [dailyOpRow()] }, 'run-page-2');
    expect(results[0].status).toBe('updated');
  });
});

describe('writeAllPilotageRows — partial failure', () => {
  it('reports a per-row failure without throwing, and never rolls up to a false "success"', async () => {
    const mock = createMockNotion();
    mock.queueResponse(
      (url, opts) => opts.method === 'POST' && url.endsWith('/pages'),
      { ok: false, status: 500, text: async () => 'simulated failure' }
    );
    global.fetch = mock.fetch;

    const results = await writeAllPilotageRows(
      { dailyOperations: [dailyOpRow(), dailyOpRow({ import_key: 'do-key-2', date: '2026-07-02' })] },
      'run-page-1'
    );

    const summary = summarizeResults(results);
    expect(summary.failed).toBe(1);
    expect(summary.created).toBe(1);
    expect(results.find((r) => r.status === 'failed').reason).toMatch(/simulated failure/);
  });
});

describe('checkAuthority — source-authority precedence (scan-z secondary source)', () => {
  it('never blocks when there is no existing row (authority 0)', () => {
    const result = checkAuthority('daily_operations', { source_subtype: 'scanz_ocr_summary' }, {});
    expect(result.blocked).toBe(false);
  });

  it('blocks scan-z from replacing an existing AddicTill row', () => {
    const existing = { source_subtype: { type: 'select', select: { name: 'addictill_daily_summary' } } };
    const result = checkAuthority('daily_operations', { source_subtype: 'scanz_ocr_summary' }, existing);
    expect(result.blocked).toBe(true);
    expect(result.existingAuthority).toBe(100);
    expect(result.incomingAuthority).toBe(10);
  });

  it('allows AddicTill to replace an existing scan-z row (an upgrade)', () => {
    const existing = { source_subtype: { type: 'select', select: { name: 'scanz_ocr_summary' } } };
    const result = checkAuthority('daily_operations', { source_subtype: 'addictill_daily_summary' }, existing);
    expect(result.blocked).toBe(false);
  });

  it('allows equal-authority updates (AddicTill after AddicTill, or scan-z after scan-z)', () => {
    const existingAddictill = { source_subtype: { type: 'select', select: { name: 'addictill_daily_summary' } } };
    expect(checkAuthority('daily_operations', { source_subtype: 'addictill_daily_summary' }, existingAddictill).blocked).toBe(false);

    const existingScanZ = { source_subtype: { type: 'select', select: { name: 'scanz_ocr_summary' } } };
    expect(checkAuthority('daily_operations', { source_subtype: 'scanz_ocr_summary' }, existingScanZ).blocked).toBe(false);
  });

  it('has no precedence concept for Product Sales/Sales Categories — never blocks', () => {
    const existing = { source_subtype: { type: 'select', select: { name: 'addictill_daily_summary' } } };
    expect(checkAuthority('product_sales', { source_subtype: 'scanz_ocr_summary' }, existing).blocked).toBe(false);
    expect(checkAuthority('sales_categories', { source_subtype: 'scanz_ocr_summary' }, existing).blocked).toBe(false);
  });

  it('treats an unrecognized existing source_subtype as authority 0 (fail-closed, never blocks a recognized incoming source)', () => {
    const existing = { source_subtype: { type: 'select', select: { name: 'something_unrecognized' } } };
    const result = checkAuthority('daily_operations', { source_subtype: 'scanz_ocr_summary' }, existing);
    expect(result.blocked).toBe(false);
    expect(result.existingAuthority).toBe(0);
  });
});

describe('writeAllPilotageRows — end-to-end precedence blocking (spec v3 §6)', () => {
  it('blocks a scan-z write over an existing AddicTill row, with zero pilotage writes and a clear reason — the exact "scan-z after AddicTill" scenario', async () => {
    const mock = createMockNotion();
    global.fetch = mock.fetch;

    await writeAllPilotageRows({ dailyOperations: [dailyOpRow({ source_subtype: 'addictill_daily_summary' })] }, 'run-page-1');

    mock.calls.length = 0;
    const results = await writeAllPilotageRows(
      { dailyOperations: [dailyOpRow({ source_subtype: 'scanz_ocr_summary', ticket_count: 999 })] },
      'run-page-2'
    );

    expect(results[0].status).toBe('blocked_precedence');
    expect(results[0].reason).toMatch(/addictill_daily_summary/);
    expect(mock.calls.some((c) => c.method === 'POST' && c.url.endsWith('/pages'))).toBe(false);
    expect(mock.calls.some((c) => c.method === 'PATCH')).toBe(false);

    // Confirm the original AddicTill data was never touched.
    const pages = Array.from(mock.pages.values()).filter((p) => p.dbId === 'db-daily-ops');
    expect(pages.length).toBe(1);
    expect(pages[0].properties.ticket_count.number).toBe(42);
  });

  it('summarizeResults counts blocked_precedence separately from failed', async () => {
    const mock = createMockNotion();
    global.fetch = mock.fetch;
    await writeAllPilotageRows({ dailyOperations: [dailyOpRow({ source_subtype: 'addictill_daily_summary' })] }, 'run-page-1');

    const results = await writeAllPilotageRows(
      { dailyOperations: [dailyOpRow({ source_subtype: 'scanz_ocr_summary' })] },
      'run-page-2'
    );
    expect(summarizeResults(results)).toEqual({ created: 0, updated: 0, skipped: 0, failed: 0, blocked_precedence: 1 });
  });
});

describe('computeRowDiff', () => {
  it('returns an empty diff when the row already matches every field', () => {
    const existing = {
      import_key: { type: 'rich_text', rich_text: [{ plain_text: 'do-key-1' }] },
      establishment_key: { type: 'rich_text', rich_text: [{ plain_text: 'moka-sxm' }] },
      date: { type: 'date', date: { start: '2026-07-01' } },
      source_type: { type: 'select', select: { name: 'pos_export' } },
      source_subtype: { type: 'select', select: { name: 'addictill_daily_summary' } },
      ticket_count: { type: 'number', number: 42 },
      total_ttc: { type: 'number', number: 1234.56 },
      total_ht: { type: 'number', number: 1100.0 },
      ca_ttc: { type: 'number', number: 1234.56 },
      clients: { type: 'number', number: 55 },
    };
    expect(computeRowDiff('daily_operations', dailyOpRow(), existing)).toEqual([]);
  });

  it('reports exactly the fields that differ, with old and new values, when data changed', () => {
    const existing = {
      import_key: { type: 'rich_text', rich_text: [{ plain_text: 'do-key-1' }] },
      establishment_key: { type: 'rich_text', rich_text: [{ plain_text: 'moka-sxm' }] },
      date: { type: 'date', date: { start: '2026-07-01' } },
      source_type: { type: 'select', select: { name: 'pos_export' } },
      source_subtype: { type: 'select', select: { name: 'addictill_daily_summary' } },
      ticket_count: { type: 'number', number: 10 },
      total_ttc: { type: 'number', number: 1234.56 },
      total_ht: { type: 'number', number: 1100.0 },
      ca_ttc: { type: 'number', number: 1234.56 },
      clients: { type: 'number', number: 55 },
    };
    const diff = computeRowDiff('daily_operations', dailyOpRow({ ticket_count: 12 }), existing);
    expect(diff).toEqual([{ field: 'ticket_count', oldValue: 10, newValue: 12 }]);
  });
});
