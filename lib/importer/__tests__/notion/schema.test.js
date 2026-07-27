import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createMockNotion } from '../helpers/mock-notion-fetch.js';

const ENV_KEYS = [
  'NOTION_IMPORT_RUNS_DB_ID',
  'NOTION_DAILY_OPERATIONS_DB_ID',
  'NOTION_PAYMENT_METHODS_DB_ID',
  'NOTION_PRODUCT_SALES_DB_ID',
  'NOTION_SALES_CATEGORIES_DB_ID',
];
let savedEnv;
let savedFetch;

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  savedFetch = global.fetch;
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  global.fetch = savedFetch;
});

describe('checkPilotageSchemas — compatible schema', () => {
  it('reports ok:true for every target when all required properties exist with matching types', async () => {
    const { PILOTAGE_TARGETS } = await import('../../config/pilotage-targets.js');
    process.env.NOTION_IMPORT_RUNS_DB_ID = 'db-import-runs';

    const schemas = {
      'db-import-runs': Object.fromEntries(
        Object.entries(PILOTAGE_TARGETS.import_runs.requiredProperties).map(([name, type]) => [name, { type }])
      ),
    };
    global.fetch = createMockNotion({ schemas }).fetch;

    const { checkPilotageSchemas } = await import('../../notion/schema.js');
    const results = await checkPilotageSchemas(['import_runs']);

    expect(results).toEqual([
      expect.objectContaining({ targetKey: 'import_runs', ok: true, reason: null }),
    ]);
  });
});

describe('checkPilotageSchemas — incompatible schema', () => {
  it('reports missing properties, type mismatches, and non-blocking extras', async () => {
    const { PILOTAGE_TARGETS } = await import('../../config/pilotage-targets.js');
    process.env.NOTION_DAILY_OPERATIONS_DB_ID = 'db-daily-ops';

    const required = PILOTAGE_TARGETS.daily_operations.requiredProperties;
    const properties = {};
    let skippedOne = false;
    for (const [name, type] of Object.entries(required)) {
      if (!skippedOne) {
        skippedOne = true;
        continue; // simulate a missing property
      }
      if (name === 'ticket_count') {
        properties[name] = { type: 'rich_text' }; // simulate a type mismatch
        continue;
      }
      properties[name] = { type };
    }
    properties['Unexpected Column'] = { type: 'rich_text' };

    global.fetch = createMockNotion({ schemas: { 'db-daily-ops': properties } }).fetch;

    const { checkPilotageSchemas } = await import('../../notion/schema.js');
    const [result] = await checkPilotageSchemas(['daily_operations']);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('SCHEMA_MISMATCH');
    expect(result.validation.missing.length).toBeGreaterThan(0);
    expect(result.validation.typeMismatches).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'ticket_count', expected: 'number', actual: 'rich_text' })])
    );
    expect(result.validation.extra).toContain('Unexpected Column');
  });

  it('reports CONFIG_MISSING when the env var is unset — never calls fetch', async () => {
    delete process.env.NOTION_PAYMENT_METHODS_DB_ID;
    const mock = createMockNotion({ schemas: {} });
    global.fetch = mock.fetch;

    const { checkPilotageSchemas } = await import('../../notion/schema.js');
    const [result] = await checkPilotageSchemas(['payment_methods']);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('CONFIG_MISSING');
    expect(mock.calls.length).toBe(0);
  });

  it('reports NOT_SHARED_WITH_INTEGRATION on a 403 and NOT_FOUND on a 404', async () => {
    process.env.NOTION_PRODUCT_SALES_DB_ID = 'db-forbidden';
    global.fetch = async () => ({ ok: false, status: 403, text: async () => 'forbidden' });
    const { checkPilotageSchemas: check1 } = await import('../../notion/schema.js');
    const [forbidden] = await check1(['product_sales']);
    expect(forbidden.reason).toBe('NOT_SHARED_WITH_INTEGRATION');

    vi.resetModules();
    process.env.NOTION_SALES_CATEGORIES_DB_ID = 'db-missing';
    global.fetch = async () => ({ ok: false, status: 404, text: async () => 'not found' });
    const { checkPilotageSchemas: check2 } = await import('../../notion/schema.js');
    const [notFound] = await check2(['sales_categories']);
    expect(notFound.reason).toBe('NOT_FOUND');
  });
});
