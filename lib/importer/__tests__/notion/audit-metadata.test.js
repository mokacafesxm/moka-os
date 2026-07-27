import { describe, it, expect } from 'vitest';

import { compactAuditMetadata, buildAuditMetadataString, MAX_AUDIT_METADATA_LENGTH } from '../../notion/audit-metadata.js';

function smallInput(overrides = {}) {
  return {
    ocr: {
      confidence_reported: 'high',
      confidence_computed: 0.95,
      resume: 'Z du 2026-07-01',
      raw_values: { date: '2026-07-01', total_ttc_cents: 12340 },
      deterministic_checks: { date_valid: true, ttc_valid: true },
    },
    review: {
      reviewed_at: '2026-07-19T14:32:00.000Z',
      reviewed_by: 'alice',
      final_values: { total_ttc: 123.4 },
      corrected_fields: [],
    },
    warnings: [],
    reconciliation: {
      conflict_detected: false,
      existing_source_subtype: null,
      existing_authority: null,
      incoming_authority: 10,
      action: 'created',
    },
    ...overrides,
  };
}

describe('compactAuditMetadata — small payloads are never truncated', () => {
  it('serializes compactly (no whitespace) and marks truncated: false', () => {
    const result = compactAuditMetadata(smallInput());
    expect(result.truncated).toBe(false);
    expect(result.omittedSections).toEqual([]);
    expect(result.json).not.toMatch(/\n|  /); // compact — no indentation
    expect(JSON.parse(result.json).truncated).toBe(false);
  });

  it('never retains full product-line detail (not part of the input shape at all)', () => {
    const result = compactAuditMetadata(smallInput());
    const parsed = JSON.parse(result.json);
    expect(parsed.ocr.raw_values.product_lines).toBeUndefined();
  });
});

describe('compactAuditMetadata — deterministic truncation order', () => {
  it('drops ocr.resume first when the payload is too large', () => {
    const result = compactAuditMetadata(
      smallInput({ ocr: { ...smallInput().ocr, resume: 'x'.repeat(3000) } })
    );
    expect(result.truncated).toBe(true);
    expect(result.omittedSections).toContain('ocr.resume');
    expect(JSON.parse(result.json).ocr.resume).toBe('');
  });

  it('truncates warnings to at most 3 entries of at most 80 chars when still too large', () => {
    const manyWarnings = Array.from({ length: 50 }, (_, i) => `warning ${i} ${'x'.repeat(100)}`);
    const result = compactAuditMetadata(smallInput({ warnings: manyWarnings, ocr: { ...smallInput().ocr, resume: 'x'.repeat(3000) } }));
    expect(result.omittedSections).toContain('warnings');
    const parsed = JSON.parse(result.json);
    expect(parsed.warnings.length).toBeLessThanOrEqual(3);
    for (const w of parsed.warnings) expect(w.length).toBeLessThanOrEqual(80);
  });

  it('collapses deterministic_checks to a {passed, total} summary as the next reduction', () => {
    const manyWarnings = Array.from({ length: 50 }, (_, i) => `warning ${i} ${'x'.repeat(100)}`);
    // 3 warnings capped at 80 chars each is small — deterministic_checks
    // itself must be the thing pushing this candidate past the cap, so
    // it needs to be large enough on its own to force level 3.
    const bigChecks = Object.fromEntries(
      Array.from({ length: 60 }, (_, i) => [`check_number_${i}_with_a_fairly_long_descriptive_name`, i % 2 === 0])
    );
    const result = compactAuditMetadata(
      smallInput({
        warnings: manyWarnings,
        ocr: { ...smallInput().ocr, resume: 'x'.repeat(3000), deterministic_checks: bigChecks },
      })
    );
    expect(result.omittedSections).toContain('ocr.deterministic_checks');
    const parsed = JSON.parse(result.json);
    expect(parsed.ocr.deterministic_checks).toHaveProperty('passed');
    expect(parsed.ocr.deterministic_checks).toHaveProperty('total');
  });

  it('always includes the truncated boolean and omitted_sections array at every level', () => {
    const result = compactAuditMetadata(smallInput({ ocr: { ...smallInput().ocr, resume: 'x'.repeat(3000) } }));
    const parsed = JSON.parse(result.json);
    expect(typeof parsed.truncated).toBe('boolean');
    expect(Array.isArray(parsed.omitted_sections)).toBe(true);
  });
});

describe('compactAuditMetadata — hard size guarantee, never fails', () => {
  it('stays at or below the maximum length for a very large but plausible payload', () => {
    const manyWarnings = Array.from({ length: 50 }, (_, i) => `warning ${i} ${'x'.repeat(80)}`);
    const result = compactAuditMetadata(
      smallInput({
        ocr: { ...smallInput().ocr, resume: 'x'.repeat(5000) },
        warnings: manyWarnings,
        review: { ...smallInput().review, final_values: { total_ttc: 123.4, total_ht: 110, ticket_count: 10 }, corrected_fields: ['total_ht'] },
      })
    );
    expect(result.json.length).toBeLessThanOrEqual(MAX_AUDIT_METADATA_LENGTH);
  });

  it('never exceeds the maximum length or throws, even for a pathologically oversized review payload', () => {
    const pathological = smallInput({
      ocr: { ...smallInput().ocr, resume: 'x'.repeat(100000) },
      warnings: Array.from({ length: 10000 }, () => 'w'.repeat(1000)),
      review: {
        reviewed_at: 'x',
        reviewed_by: 'y',
        final_values: { note: 'z'.repeat(100000) },
        corrected_fields: Array.from({ length: 10000 }, () => 'field'.repeat(200)),
      },
      reconciliation: { ...smallInput().reconciliation, action: 'r'.repeat(100000) },
    });

    expect(() => compactAuditMetadata(pathological)).not.toThrow();
    const result = compactAuditMetadata(pathological);
    expect(result.json.length).toBeLessThanOrEqual(MAX_AUDIT_METADATA_LENGTH);
    expect(() => JSON.parse(result.json)).not.toThrow(); // always valid JSON, never a truncated/garbled string
  });

  it('handles a completely empty input without throwing', () => {
    expect(() => compactAuditMetadata({})).not.toThrow();
    expect(() => compactAuditMetadata()).not.toThrow();
    const result = compactAuditMetadata();
    expect(result.json.length).toBeLessThanOrEqual(MAX_AUDIT_METADATA_LENGTH);
  });
});

describe('buildAuditMetadataString', () => {
  it('returns just the JSON string, matching compactAuditMetadata(...).json', () => {
    const input = smallInput();
    expect(buildAuditMetadataString(input)).toBe(compactAuditMetadata(input).json);
  });
});
