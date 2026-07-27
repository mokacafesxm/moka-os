import { describe, it, expect } from 'vitest';
import {
  validateIdempotencyKey,
  computeInvoiceHash,
  parseLedger,
  findLedgerEntry,
  mergeLedgerByKey,
  serializeLedger,
  hashLedgerKey,
  parseKeyFingerprints,
  serializeKeyFingerprints,
  MAX_LEDGER_LENGTH,
} from '../idempotency.js';

describe('validateIdempotencyKey', () => {
  it('accepts the three documented key formats', () => {
    expect(validateIdempotencyKey('supplier-receipt:abc-123:def-456').valid).toBe(true);
    expect(validateIdempotencyKey('invoice-receipt:0123abcdef:def-456').valid).toBe(true);
    expect(validateIdempotencyKey('manual-receipt:op-789:def-456').valid).toBe(true);
  });

  it('rejects a missing key', () => {
    expect(validateIdempotencyKey(undefined)).toEqual({ valid: false, reason: 'MISSING' });
    expect(validateIdempotencyKey('')).toEqual({ valid: false, reason: 'MISSING' });
  });

  it('rejects a key using timestamp-only or unrecognized prefix', () => {
    expect(validateIdempotencyKey('2026-07-19T10:00:00Z').valid).toBe(false);
    expect(validateIdempotencyKey('random-thing:a:b').valid).toBe(false);
  });

  it('rejects a key missing a segment', () => {
    expect(validateIdempotencyKey('supplier-receipt:only-one-segment').valid).toBe(false);
  });

  it('rejects an oversized key', () => {
    const huge = `manual-receipt:${'a'.repeat(500)}:ingredient`;
    expect(validateIdempotencyKey(huge)).toEqual({ valid: false, reason: 'TOO_LONG' });
  });
});

describe('computeInvoiceHash', () => {
  it('is deterministic for the same bytes', () => {
    const a = computeInvoiceHash('aGVsbG8=');
    const b = computeInvoiceHash('aGVsbG8=');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('differs for different bytes', () => {
    expect(computeInvoiceHash('aGVsbG8=')).not.toBe(computeInvoiceHash('d29ybGQ='));
  });
});

describe('ledger parse/merge/serialize', () => {
  it('parseLedger tolerates missing/malformed input', () => {
    expect(parseLedger('')).toEqual([]);
    expect(parseLedger(null)).toEqual([]);
    expect(parseLedger('not json')).toEqual([]);
    expect(parseLedger('{"not":"an array"}')).toEqual([]);
  });

  it('findLedgerEntry finds by key', () => {
    const entries = [{ key: 'a' }, { key: 'b' }];
    expect(findLedgerEntry(entries, 'b')).toEqual({ key: 'b' });
    expect(findLedgerEntry(entries, 'c')).toBeNull();
  });

  it('mergeLedgerByKey replaces rather than duplicates a repeated key', () => {
    const existing = [{ key: 'a', status: 'applied' }];
    const merged = mergeLedgerByKey(existing, [{ key: 'a', status: 'already_applied' }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe('already_applied');
  });

  it('serializeLedger stays within the size cap for a pathological input', () => {
    const huge = Array.from({ length: 500 }, (_, i) => ({
      key: `manual-receipt:op-${i}:ingredient-${i}`,
      note: 'z'.repeat(500),
    }));
    const json = serializeLedger(huge);
    expect(json.length).toBeLessThanOrEqual(MAX_LEDGER_LENGTH);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('serializeLedger never throws even for circular-safe garbage', () => {
    expect(() => serializeLedger(undefined)).not.toThrow();
    expect(serializeLedger(undefined)).toBe('[]');
  });
});

// Regression coverage for the ledger-truncation bug found during the
// deployment-readiness review: the original per-entry-object ledger
// (serializeLedger) retains only ~10 entries before MAX_LEDGER_LENGTH
// evicts the oldest one — for a single frequently-restocked ingredient,
// that meant losing the ability to detect an old duplicate within months.
// The compact fingerprint-set format (hashLedgerKey/serializeKeyFingerprints)
// used by lib/stock/apply-addition.js fixes this by storing only a 20-char
// hash per receipt instead of a full object.
describe('key fingerprint set (compact Stock-side ledger)', () => {
  it('hashLedgerKey is deterministic and fixed-length', () => {
    const a = hashLedgerKey('supplier-receipt:order-1:ingredient-1');
    const b = hashLedgerKey('supplier-receipt:order-1:ingredient-1');
    expect(a).toBe(b);
    expect(a).toHaveLength(20);
    expect(hashLedgerKey('supplier-receipt:order-2:ingredient-1')).not.toBe(a);
  });

  it('parseKeyFingerprints tolerates missing/malformed input', () => {
    expect(parseKeyFingerprints('')).toEqual([]);
    expect(parseKeyFingerprints('not json')).toEqual([]);
    expect(parseKeyFingerprints('{"not":"an array"}')).toEqual([]);
    expect(parseKeyFingerprints('["abc", 123, "def"]')).toEqual(['abc', 'def']);
  });

  it('retains at least ~7x more distinct receipts than the old per-entry-object ledger before eviction', () => {
    let fingerprints = [];
    const keys = [];
    const ATTEMPTS = 70; // comfortably under the measured ~82-entry capacity at this key length
    for (let i = 0; i < ATTEMPTS; i++) {
      const key = `supplier-receipt:11111111-1111-4111-8111-111111111${String(i).padStart(3, '0')}:22222222-2222-4222-8222-222222222222`;
      keys.push(key);
      fingerprints = [...fingerprints, hashLedgerKey(key)];
      fingerprints = parseKeyFingerprints(serializeKeyFingerprints(fingerprints));
    }
    // The very first key (oldest) must still be recognized after 70 receipts —
    // the old object-based ledger lost this after roughly 10.
    const firstFingerprint = hashLedgerKey(keys[0]);
    expect(fingerprints).toContain(firstFingerprint);
    expect(fingerprints.length).toBe(ATTEMPTS);
  });

  it('measures actual capacity: eviction only begins after ~7x the old per-entry-object ledger capacity', () => {
    let fingerprints = [];
    let evictedAt = null;
    for (let i = 0; i < 200; i++) {
      const key = `supplier-receipt:11111111-1111-4111-8111-111111111${String(i).padStart(3, '0')}:22222222-2222-4222-8222-222222222222`;
      const before = fingerprints.length;
      fingerprints = [...fingerprints, hashLedgerKey(key)];
      fingerprints = parseKeyFingerprints(serializeKeyFingerprints(fingerprints));
      if (evictedAt === null && fingerprints.length <= before) evictedAt = i + 1;
    }
    // The old object-based format (serializeLedger) measured ~10 entries before
    // eviction began; the compact fingerprint format must comfortably exceed that.
    expect(evictedAt).toBeGreaterThan(70);
  });

  it('serializeKeyFingerprints stays within the size cap and never throws for pathological input', () => {
    const huge = Array.from({ length: 5000 }, (_, i) => hashLedgerKey(`k${i}`));
    const json = serializeKeyFingerprints(huge);
    expect(json.length).toBeLessThanOrEqual(MAX_LEDGER_LENGTH);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(() => serializeKeyFingerprints(undefined)).not.toThrow();
  });
});
