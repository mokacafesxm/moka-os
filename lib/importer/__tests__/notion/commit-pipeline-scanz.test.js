import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { createMockNotion } from '../helpers/mock-notion-fetch.js';
import { PILOTAGE_TARGETS } from '../../config/pilotage-targets.js';
import { dailyOperationsKey } from '../../notion/business-keys.js';
import { titleProp, textProp, selectProp, numberProp, dateProp, relationProp } from '../../notion/notion-client.js';
import { runScanZPreflight, runScanZCommit } from '../../notion/commit-pipeline.js';

const ENV_KEYS = [
  'IMPORTS_SCANZ_ENABLED',
  'IMPORTS_PREFLIGHT_TOKEN_SECRET',
  'IMPORTS_ESTABLISHMENTS',
  'NOTION_IMPORT_RUNS_DB_ID',
  'NOTION_DAILY_OPERATIONS_DB_ID',
  'NOTION_PAYMENT_METHODS_DB_ID',
];
let savedEnv;
let savedFetch;

const DB_IDS = {
  import_runs: 'db-import-runs',
  daily_operations: 'db-daily-ops',
  payment_methods: 'db-payments',
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
  process.env.IMPORTS_SCANZ_ENABLED = 'true';
  process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET = 'test-secret-do-not-use-in-prod-0123456789';
  process.env.IMPORTS_ESTABLISHMENTS = 'moka-sxm:MOKA Cafe SXM';
  process.env.NOTION_IMPORT_RUNS_DB_ID = DB_IDS.import_runs;
  process.env.NOTION_DAILY_OPERATIONS_DB_ID = DB_IDS.daily_operations;
  process.env.NOTION_PAYMENT_METHODS_DB_ID = DB_IDS.payment_methods;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  global.fetch = savedFetch;
});

function fakeOcrJson(overrides = {}) {
  return {
    date: '2026-07-01',
    total_ttc: 123.4,
    total_ttc_alt: 123.4,
    nb_transactions: 10,
    produits: [{ nom: 'Café', quantite: 5, total: 60.0 }, { nom: 'Croissant', quantite: 5, total: 63.4 }],
    ocr_confidence: 'high',
    image_quality: 'good',
    labels_detected: ['TOTAL', 'NOMBRE DE TICKETS'],
    resume: 'Z du 1 juillet 2026',
    ...overrides,
  };
}

function fakeClaude(json = fakeOcrJson()) {
  let callCount = 0;
  const fn = async () => {
    callCount += 1;
    return JSON.stringify(json);
  };
  fn.callCount = () => callCount;
  return fn;
}

function seedDailyOperationsRow(mock, { sourceSubtype = 'addictill_daily_summary', date = '2026-07-01', establishmentKey = 'moka-sxm', ticketCount = 50 } = {}) {
  const importKey = dailyOperationsKey({ establishmentKey, date, sourceType: 'pos_export' });
  return mock.seedPage(DB_IDS.daily_operations, {
    Name: titleProp('seed'),
    import_key: textProp(importKey),
    establishment_key: textProp(establishmentKey),
    date: dateProp(date),
    source_type: selectProp('pos_export'),
    source_subtype: selectProp(sourceSubtype),
    ticket_count: numberProp(ticketCount),
    total_ttc: numberProp(500.0),
    total_ht: numberProp(450.0),
    ca_ttc: numberProp(500.0),
    clients: numberProp(80),
    source_import: relationProp('page-existing-run'),
  });
}

const IMAGE_BUFFER = Buffer.from('fake-jpeg-bytes-not-a-real-image');

describe('IMPORTS_SCANZ_ENABLED gate', () => {
  it('refuses preflight and commit when the flag is not "true", making zero Notion/vision calls', async () => {
    delete process.env.IMPORTS_SCANZ_ENABLED;
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const claude = fakeClaude();

    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: claude,
    });
    expect(preflight.scanz_enabled).toBe(false);
    expect(preflight.blocking_reasons).toContain('SCANZ_DISABLED');
    expect(claude.callCount()).toBe(0);
    expect(mock.calls.length).toBe(0);

    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      establishmentKey: 'moka-sxm',
      preflightToken: 'irrelevant',
      finalValues: {},
    });
    expect(commit.committed).toBe(false);
    expect(commit.blocking_reasons).toContain('SCANZ_DISABLED');
  });
});

describe('runScanZPreflight + runScanZCommit — happy path', () => {
  it('commits successfully, never manufactures total_ht/ca_ttc, and calls Claude vision exactly once total', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const claude = fakeClaude();

    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      initiatedVia: 'web',
      initiatedBy: 'alice',
      callClaude: claude,
    });
    expect(preflight.can_commit).toBe(true);
    expect(preflight.preflight_token).toBeTruthy();
    expect(preflight.confidence.finalConfidence).toBe(0.95);

    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: preflight.preflight_token,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, total_ht: null, ca_ttc: null, ticket_count: 10 },
      initiatedVia: 'web',
      initiatedBy: 'alice',
    });

    expect(commit.committed).toBe(true);
    expect(commit.commit_result).toBe('success');
    expect(commit.corrected_fields).toEqual([]);

    // Claude vision was called exactly once (at preflight) — never re-invoked at commit.
    expect(claude.callCount()).toBe(1);

    const dailyOpsPage = Array.from(mock.pages.values()).find((p) => p.dbId === DB_IDS.daily_operations);
    expect(dailyOpsPage.properties.total_ht.number).toBeNull();
    expect(dailyOpsPage.properties.ca_ttc.number).toBeNull();
    expect(dailyOpsPage.properties.source_subtype.select.name).toBe('scanz_ocr_summary');
  });

  it('records human corrections in corrected_fields and in the final audit_metadata', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const claude = fakeClaude();

    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: claude,
    });

    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: preflight.preflight_token,
      // Human corrects ticket_count (OCR read 10, register said 12) and supplies a real HT figure.
      finalValues: { date: '2026-07-01', total_ttc: 123.4, total_ht: 110.0, ca_ttc: null, ticket_count: 12 },
      initiatedVia: 'cli',
      initiatedBy: 'bob',
    });

    expect(commit.corrected_fields.sort()).toEqual(['ticket_count', 'total_ht'].sort());

    const auditPage = mock.pages.get(commit.import_run_id);
    const auditMetadata = JSON.parse(auditPage.properties.audit_metadata.rich_text[0].plain_text);
    expect(auditMetadata.review.reviewed_by).toBe('bob');
    expect(auditMetadata.review.corrected_fields.sort()).toEqual(['ticket_count', 'total_ht'].sort());
    expect(auditMetadata.review.final_values.ticket_count).toBe(12);
    expect(auditMetadata.reconciliation.action).toBe('committed');

    const dailyOpsPage = Array.from(mock.pages.values()).find((p) => p.dbId === DB_IDS.daily_operations);
    expect(dailyOpsPage.properties.ticket_count.number).toBe(12);
    expect(dailyOpsPage.properties.total_ht.number).toBe(110.0);
  });

  it('never writes failure_reason for a successful commit — failure_reason stays exclusively for actual failures', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(),
    });
    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: preflight.preflight_token,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
    });
    const auditPage = mock.pages.get(commit.import_run_id);
    expect(auditPage.properties.failure_reason.rich_text[0]?.plain_text ?? '').toBe('');
    expect(auditPage.properties.status.select.name).toBe('committed');
  });
});

describe('scan-z hard blocks (invalid OCR read)', () => {
  it('blocks the whole preflight when the OCR date is invalid — status "blocked", not "failed"', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(fakeOcrJson({ date: null })),
    });
    expect(preflight.can_commit).toBe(false);
    expect(preflight.blocking_reasons).toContain('VALIDATION_ERRORS');
    expect(preflight.rows).toBeNull();

    const auditPage = mock.pages.get(preflight.audit_import_run_id);
    expect(auditPage.properties.status.select.name).toBe('preview'); // preview is always 'preview', regardless of blocking reasons
  });
});

describe('scan-z ticket_count validation', () => {
  it('blocks a structurally invalid ticket count (0)', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(fakeOcrJson({ nb_transactions: 0 })),
    });
    expect(preflight.can_commit).toBe(false);
    expect(preflight.blocking_reasons).toContain('VALIDATION_ERRORS');
  });

  it('accepts an unusually high but structurally valid ticket count, non-blocking, with mandatory acknowledgement', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(fakeOcrJson({ nb_transactions: 5000 })),
    });
    expect(preflight.can_commit).toBe(true);
    expect(preflight.confidence.requiresAcknowledgement).toBe(true);
    expect(preflight.validation.warnings.length).toBeGreaterThan(0);
  });
});

describe('scan-z source-authority precedence (spec v3 §6)', () => {
  it('scan-z after AddicTill: blocked at preflight, blocked at commit, zero pilotage writes, AddicTill data untouched', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    seedDailyOperationsRow(mock, { sourceSubtype: 'addictill_daily_summary', ticketCount: 50 });

    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(),
    });
    expect(preflight.can_commit).toBe(false);
    expect(preflight.blocking_reasons).toContain('PRECEDENCE_CONFLICT');
    expect(preflight.precedence.blocked).toBe(true);
    expect(preflight.precedence.existingSourceSubtype).toBe('addictill_daily_summary');
    expect(preflight.precedence.diff.length).toBeGreaterThan(0);

    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: preflight.preflight_token,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
    });
    expect(commit.committed).toBe(false);
    expect(commit.can_commit).toBe(false);
    expect(commit.blocking_reasons).toContain('PRECEDENCE_CONFLICT');

    const dailyOpsPages = Array.from(mock.pages.values()).filter((p) => p.dbId === DB_IDS.daily_operations);
    expect(dailyOpsPages.length).toBe(1);
    expect(dailyOpsPages[0].properties.ticket_count.number).toBe(50); // unchanged
    expect(dailyOpsPages[0].properties.source_subtype.select.name).toBe('addictill_daily_summary'); // unchanged
  });

  it('has no override of any kind — a second attempt with the same inputs is blocked identically', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    seedDailyOperationsRow(mock, { sourceSubtype: 'addictill_daily_summary' });

    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(),
    });

    // No force/override parameter exists on runScanZCommit at all — passing
    // arbitrary extra fields has no effect, confirming there is no escape hatch.
    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: preflight.preflight_token,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
      forceOverride: true,
      force: true,
      override: true,
    });
    expect(commit.committed).toBe(false);
    expect(commit.blocking_reasons).toContain('PRECEDENCE_CONFLICT');
  });
});

describe('scan-z preflight-token security (spec v3 §0)', () => {
  it('rejects a tampered token and never trusts its payload — the minimal Import Run uses only independently-derived fields', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(),
    });

    const [payloadB64, signatureB64] = preflight.preflight_token.split('.');
    const flippedChar = signatureB64[0] === 'a' ? 'b' : 'a';
    const tamperedToken = `${payloadB64}.${flippedChar}${signatureB64.slice(1)}`;

    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: tamperedToken,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
      initiatedVia: 'cli',
      initiatedBy: 'root',
    });

    expect(commit.committed).toBe(false);
    expect(commit.blocking_reasons).toContain('PREFLIGHT_TOKEN_INVALID_SIGNATURE');

    const auditPage = mock.pages.get(commit.import_run_id);
    expect(auditPage.properties.status.select.name).toBe('failed');
    expect(auditPage.properties.file_hash_sha256.rich_text[0].plain_text).toBe(
      // Independently recomputed from the resubmitted image bytes, matches what preflight computed for the same bytes.
      Array.from(mock.pages.values()).find((p) => p.dbId === DB_IDS.import_runs && p.id === preflight.audit_import_run_id)
        .properties.file_hash_sha256.rich_text[0].plain_text
    );
    expect(auditPage.properties.initiated_by.rich_text[0].plain_text).toBe('root');

    const pilotageWrites = Array.from(mock.pages.values()).filter(
      (p) => p.dbId === DB_IDS.daily_operations || p.dbId === DB_IDS.payment_methods
    );
    expect(pilotageWrites).toEqual([]);
  });

  it('rejects a malformed token string the same way, without throwing', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: 'not-a-real-token',
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
    });
    expect(commit.committed).toBe(false);
    expect(commit.blocking_reasons).toContain('PREFLIGHT_TOKEN_MALFORMED');
  });

  it('rejects an expired (but validly signed) token, using its verified payload only to record PREFLIGHT_TOKEN_EXPIRED — zero pilotage writes', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    // Mint a token that is already expired via the low-level API directly
    // (runScanZPreflight always mints a fresh 30-minute token — this
    // simulates a human taking too long to review before confirming).
    const { mintPreflightToken } = await import('../../notion/preflight-token.js');
    const expiredToken = mintPreflightToken({
      file_hash_sha256: (await import('../../registry.js')).computeFileHashFromBuffer(IMAGE_BUFFER),
      source_subtype: 'scanz_ocr_summary',
      establishment_key: 'moka-sxm',
      ocr_raw_values: {
        date: '2026-07-01', total_ttc_cents: 12340, ticket_count: 10, ocr_confidence: 'high',
        labels_detected: ['TOTAL'], resume: 'x', product_lines: [],
        checks: { date_valid: true, ttc_valid: true, ticket_count_plausible: true, expected_labels_present: true, image_quality: 'good', repeated_value_consistent: true, line_total_reconciled: true },
      },
      ttlMs: -1000,
    });

    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: expiredToken,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
    });

    expect(commit.committed).toBe(false);
    expect(commit.blocking_reasons).toContain('PREFLIGHT_TOKEN_EXPIRED');

    const auditPage = mock.pages.get(commit.import_run_id);
    expect(auditPage.properties.establishment_key.rich_text[0].plain_text).toBe('moka-sxm'); // from the verified payload
    expect(auditPage.properties.status.select.name).toBe('failed');

    const pilotageWrites = Array.from(mock.pages.values()).filter(
      (p) => p.dbId === DB_IDS.daily_operations || p.dbId === DB_IDS.payment_methods
    );
    expect(pilotageWrites).toEqual([]);
  });

  it('rejects a token bound to a different establishment than the one submitted at commit', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;
    process.env.IMPORTS_ESTABLISHMENTS = 'moka-sxm:MOKA Cafe SXM,moka-other:Other Cafe';

    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(),
    });

    const commit = await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-other', // different from what the token was minted for
      preflightToken: preflight.preflight_token,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
    });
    expect(commit.committed).toBe(false);
    expect(commit.blocking_reasons).toContain('PREFLIGHT_TOKEN_ESTABLISHMENT_MISMATCH');
  });

  it('rejects a token whose bound file hash does not match the resubmitted image bytes', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(),
    });

    const commit = await runScanZCommit({
      imageBuffer: Buffer.from('a-completely-different-image'),
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: preflight.preflight_token,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
    });
    expect(commit.committed).toBe(false);
    expect(commit.blocking_reasons).toContain('PREFLIGHT_TOKEN_FILE_MISMATCH');
  });
});

describe('scan-z duplicate file handling', () => {
  it('blocks re-committing the exact same photo once it has already succeeded', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    const firstPreflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(),
    });
    await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: firstPreflight.preflight_token,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
    });

    const secondPreflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(),
    });
    expect(secondPreflight.can_commit).toBe(false);
    expect(secondPreflight.blocking_reasons).toContain('DUPLICATE_FILE_ALREADY_COMMITTED');
  }, 20000);
});

describe('scan-z never writes to Product Sales or Sales Categories', () => {
  it('only ever touches Import Runs, Daily Operations, and Payment Methods', async () => {
    const mock = createMockNotion({ schemas: fullSchemas() });
    global.fetch = mock.fetch;

    const preflight = await runScanZPreflight({
      imageBuffer: IMAGE_BUFFER,
      mimeType: 'image/jpeg',
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      callClaude: fakeClaude(),
    });
    await runScanZCommit({
      imageBuffer: IMAGE_BUFFER,
      originalFilename: 'z.jpg',
      establishmentKey: 'moka-sxm',
      preflightToken: preflight.preflight_token,
      finalValues: { date: '2026-07-01', total_ttc: 123.4, ticket_count: 10 },
    });

    const touchedDbIds = new Set(Array.from(mock.pages.values()).map((p) => p.dbId));
    expect(touchedDbIds.has('db-product-sales')).toBe(false);
    expect(touchedDbIds.has('db-sales-categories')).toBe(false);
    expect([...touchedDbIds].sort()).toEqual([DB_IDS.daily_operations, DB_IDS.import_runs].sort());
  });
});
