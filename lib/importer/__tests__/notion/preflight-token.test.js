import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { mintPreflightToken, verifyPreflightToken } from '../../notion/preflight-token.js';

let savedSecret;

beforeEach(() => {
  savedSecret = process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET;
  process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET = 'test-secret-do-not-use-in-prod-0123456789';
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET;
  else process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET = savedSecret;
});

const rawOcr = {
  date: '2026-07-01',
  total_ttc_cents: 12340,
  ticket_count: 10,
  ocr_confidence: 'high',
  labels_detected: ['TOTAL'],
  resume: 'Z du 2026-07-01',
  product_lines: [],
  checks: {
    date_valid: true,
    ttc_valid: true,
    ticket_count_plausible: true,
    expected_labels_present: true,
    image_quality: 'good',
    repeated_value_consistent: true,
    line_total_reconciled: true,
  },
};

function baseParams(overrides = {}) {
  return {
    file_hash_sha256: 'abc123',
    source_subtype: 'scanz_ocr_summary',
    establishment_key: 'moka-sxm',
    ocr_raw_values: rawOcr,
    ...overrides,
  };
}

describe('mintPreflightToken / verifyPreflightToken', () => {
  it('mints a token whose payload verifies and matches what was minted', () => {
    const token = mintPreflightToken(baseParams());
    const result = verifyPreflightToken(token);

    expect(result.ok).toBe(true);
    expect(result.expired).toBe(false);
    expect(result.payload.file_hash_sha256).toBe('abc123');
    expect(result.payload.establishment_key).toBe('moka-sxm');
    expect(result.payload.source_subtype).toBe('scanz_ocr_summary');
    expect(result.payload.ocr_raw_values).toEqual(rawOcr);
  });

  it('rejects a tampered payload — signature never verifies, payload never returned', () => {
    const token = mintPreflightToken(baseParams());
    const [payloadB64, signatureB64] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')), establishment_key: 'attacker-establishment' })
    ).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${signatureB64}`;

    const result = verifyPreflightToken(tamperedToken);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
    expect(result.payload).toBeUndefined();
  });

  it('rejects a tampered signature', () => {
    const token = mintPreflightToken(baseParams());
    const [payloadB64, signatureB64] = token.split('.');
    const flippedChar = signatureB64[0] === 'a' ? 'b' : 'a';
    const tamperedToken = `${payloadB64}.${flippedChar}${signatureB64.slice(1)}`;

    const result = verifyPreflightToken(tamperedToken);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('rejects malformed input without throwing', () => {
    expect(verifyPreflightToken(null)).toEqual({ ok: false, reason: 'MALFORMED' });
    expect(verifyPreflightToken(undefined)).toEqual({ ok: false, reason: 'MALFORMED' });
    expect(verifyPreflightToken('')).toEqual({ ok: false, reason: 'MALFORMED' });
    expect(verifyPreflightToken('not-a-token-at-all')).toEqual({ ok: false, reason: 'MALFORMED' });
    expect(verifyPreflightToken('too.many.dots.here')).toEqual({ ok: false, reason: 'MALFORMED' });
    expect(verifyPreflightToken(42)).toEqual({ ok: false, reason: 'MALFORMED' });
  });

  it('marks a token past its expiry as expired, but its verified payload remains usable', () => {
    const token = mintPreflightToken(baseParams({ ttlMs: -1000 }));
    const result = verifyPreflightToken(token);

    expect(result.ok).toBe(true);
    expect(result.expired).toBe(true);
    expect(result.payload.file_hash_sha256).toBe('abc123'); // still usable per spec v3 clarification
  });

  it('fails closed with CONFIG_MISSING when the secret is not configured, for both mint and verify', () => {
    delete process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET;

    expect(() => mintPreflightToken(baseParams())).toThrowError(/CONFIG_MISSING/);

    process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET = 'temp';
    const token = mintPreflightToken(baseParams());
    delete process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET;
    expect(verifyPreflightToken(token)).toEqual({ ok: false, reason: 'CONFIG_MISSING' });
  });

  it('a token signed with a different secret never verifies', () => {
    const token = mintPreflightToken(baseParams());
    process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET = 'a-completely-different-secret-value';
    const result = verifyPreflightToken(token);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });
});
