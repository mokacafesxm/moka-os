import { describe, it, expect } from 'vitest';

import {
  parseScanZOcr,
  runScanZOcr,
  computeDeterministicChecks,
  computeCompositeConfidence,
  DEFAULT_TICKET_COUNT_CEILING,
} from '../../parsers/scanz-ocr.js';

function baseOcrJson(overrides = {}) {
  return {
    date: '2026-07-01',
    total_ttc: 123.4,
    total_ttc_alt: 123.4,
    nb_transactions: 10,
    produits: [
      { nom: 'Café', quantite: 5, total: 60.0 },
      { nom: 'Croissant', quantite: 5, total: 63.4 },
    ],
    ocr_confidence: 'high',
    image_quality: 'good',
    labels_detected: ['TOTAL', 'NOMBRE DE TICKETS'],
    resume: 'Z du 1 juillet 2026',
    ...overrides,
  };
}

describe('parseScanZOcr — hard blocks', () => {
  it('blocks on a missing/unparseable date, never inferring one', () => {
    const result = parseScanZOcr(baseOcrJson({ date: null }));
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors[0]).toMatch(/SCANZ_INVALID_DATE/);
    expect(result.statement).toBeNull();
  });

  it('blocks on a missing/non-positive total_ttc', () => {
    expect(parseScanZOcr(baseOcrJson({ total_ttc: null })).validation.valid).toBe(false);
    expect(parseScanZOcr(baseOcrJson({ total_ttc: 0 })).validation.valid).toBe(false);
    expect(parseScanZOcr(baseOcrJson({ total_ttc: -5 })).validation.valid).toBe(false);
  });

  it('blocks on a missing, non-numeric, non-integer, or non-positive ticket count', () => {
    expect(parseScanZOcr(baseOcrJson({ nb_transactions: null })).validation.valid).toBe(false);
    expect(parseScanZOcr(baseOcrJson({ nb_transactions: 'ten' })).validation.valid).toBe(false);
    expect(parseScanZOcr(baseOcrJson({ nb_transactions: 3.5 })).validation.valid).toBe(false);
    expect(parseScanZOcr(baseOcrJson({ nb_transactions: 0 })).validation.valid).toBe(false);
    expect(parseScanZOcr(baseOcrJson({ nb_transactions: -3 })).validation.valid).toBe(false);
  });

  it('each hard-block error names which field triggered it, and blocks are independent (all fire together when all fields are bad)', () => {
    const result = parseScanZOcr(baseOcrJson({ date: null, total_ttc: null, nb_transactions: null }));
    expect(result.validation.errors).toHaveLength(3);
  });
});

describe('parseScanZOcr — never manufactures total_ht/ca_ttc/clients', () => {
  it('always leaves total_ht_cents, ca_ttc_cents, and clients_count null, regardless of confidence', () => {
    const result = parseScanZOcr(baseOcrJson());
    expect(result.statement.days[0].total_ht_cents).toBeNull();
    expect(result.statement.days[0].ca_ttc_cents).toBeNull();
    expect(result.statement.days[0].clients_count).toBeNull();
    expect(result.statement.days[0].payments).toEqual([]);
  });
});

describe('parseScanZOcr — unusually high ticket count is a warning, never a block', () => {
  it('accepts a structurally valid but implausibly high ticket count, with a warning and mandatory acknowledgement', () => {
    const result = parseScanZOcr(baseOcrJson({ nb_transactions: DEFAULT_TICKET_COUNT_CEILING * 10 }));
    expect(result.validation.valid).toBe(true);
    expect(result.statement.days[0].ticket_count).toBe(DEFAULT_TICKET_COUNT_CEILING * 10);
    expect(result.validation.warnings.some((w) => /inhabituellement élevé/.test(w))).toBe(true);
    expect(result.confidence.requiresAcknowledgement).toBe(true);
  });

  it('a ticket count at or below the ceiling never triggers the warning', () => {
    const result = parseScanZOcr(baseOcrJson({ nb_transactions: DEFAULT_TICKET_COUNT_CEILING }));
    expect(result.validation.warnings).toEqual([]);
    expect(result.confidence.requiresAcknowledgement).toBe(false);
  });
});

describe('computeDeterministicChecks', () => {
  it('flags missing expected labels', () => {
    const checks = computeDeterministicChecks(baseOcrJson({ labels_detected: ['SOME OTHER TEXT'] }));
    expect(checks.expected_labels_present).toBe(false);
  });

  it('flags an inconsistent repeated-value read', () => {
    const checks = computeDeterministicChecks(baseOcrJson({ total_ttc: 100, total_ttc_alt: 50 }));
    expect(checks.repeated_value_consistent).toBe(false);
  });

  it('flags an unreconciled line-total sum', () => {
    const checks = computeDeterministicChecks(
      baseOcrJson({ produits: [{ nom: 'X', quantite: 1, total: 1.0 }] })
    );
    expect(checks.line_total_reconciled).toBe(false);
  });

  it('treats missing product lines or a missing alt-total as consistent (nothing to contradict)', () => {
    const checks = computeDeterministicChecks(baseOcrJson({ produits: [], total_ttc_alt: null }));
    expect(checks.line_total_reconciled).toBe(true);
    expect(checks.repeated_value_consistent).toBe(true);
  });
});

describe('computeCompositeConfidence', () => {
  it('maps self-reported confidence to the expected base score when every check passes', () => {
    const checks = computeDeterministicChecks(baseOcrJson());
    expect(computeCompositeConfidence({ ocrConfidence: 'high', checks }).finalConfidence).toBe(0.95);
    expect(computeCompositeConfidence({ ocrConfidence: 'medium', checks }).finalConfidence).toBe(0.8);
    expect(computeCompositeConfidence({ ocrConfidence: 'low', checks }).finalConfidence).toBe(0.5);
  });

  it('requires acknowledgement when 2+ signals are degraded, even if no single cap alone would', () => {
    const checks = {
      date_valid: true,
      ttc_valid: true,
      ticket_count_plausible: true,
      expected_labels_present: false, // cap 0.75
      image_quality: 'good',
      repeated_value_consistent: true,
      line_total_reconciled: false, // cap 0.80
    };
    const result = computeCompositeConfidence({ ocrConfidence: 'high', checks });
    expect(result.cappedBy.length).toBe(2);
    expect(result.requiresAcknowledgement).toBe(true);
  });

  it('never fully blocks via confidence alone — always returns a usable score', () => {
    const checks = {
      date_valid: true,
      ttc_valid: true,
      ticket_count_plausible: false,
      expected_labels_present: false,
      image_quality: 'poor',
      repeated_value_consistent: false,
      line_total_reconciled: false,
    };
    const result = computeCompositeConfidence({ ocrConfidence: 'low', checks });
    expect(result.finalConfidence).toBeGreaterThanOrEqual(0);
    expect(result.requiresAcknowledgement).toBe(true);
  });
});

describe('runScanZOcr — the vision call happens exactly once, is injectable, and never touches the network in tests', () => {
  it('parses a mocked Claude vision response without any network access', async () => {
    let callCount = 0;
    const fakeClaude = async ({ imageBase64, mimeType }) => {
      callCount += 1;
      expect(typeof imageBase64).toBe('string');
      expect(mimeType).toBe('image/jpeg');
      return JSON.stringify(baseOcrJson());
    };

    const result = await runScanZOcr({
      buffer: Buffer.from('fake-jpeg-bytes'),
      mimeType: 'image/jpeg',
      callClaude: fakeClaude,
    });

    expect(callCount).toBe(1);
    expect(result.validation.valid).toBe(true);
    expect(result.raw.date).toBe('2026-07-01');
  });

  it('tolerates a response wrapped in markdown code fences', async () => {
    const fakeClaude = async () => '```json\n' + JSON.stringify(baseOcrJson()) + '\n```';
    const result = await runScanZOcr({ buffer: Buffer.from('x'), mimeType: 'image/png', callClaude: fakeClaude });
    expect(result.validation.valid).toBe(true);
  });
});
