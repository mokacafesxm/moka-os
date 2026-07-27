import path from 'node:path';
import fs from 'node:fs';
import { describe, it, expect, vi } from 'vitest';

import { extractPdf, extractXlsx, extractCsv } from '../extract.js';
import {
  classifyDocument,
  resolveClassificationStatus,
  applyDeterministicRules,
  AUTO_THRESHOLD,
  REVIEW_THRESHOLD,
} from '../classify.js';

const FIXTURES = path.join(__dirname, 'fixtures');
const INVALID_CLAUDE_RESPONSE = fs.readFileSync(
  path.join(FIXTURES, 'claude', 'invalid-response.txt'),
  'utf8'
);

describe('classifyDocument — unambiguous rule-based recognition', () => {
  it('recognizes a bank statement without calling Claude', async () => {
    const extraction = await extractPdf(path.join(FIXTURES, 'pdf', 'bank-statement-sample.pdf'));
    const callClaude = vi.fn();

    const result = await classifyDocument(extraction, { apiKey: undefined, callClaude });

    expect(result.document_type).toBe('bank_statement');
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_THRESHOLD);
    expect(result.classified_by).toBe('rules');
    expect(result.pos_source_hint).toBeNull();
    expect(callClaude).not.toHaveBeenCalled();
    expect(resolveClassificationStatus(result)).toBe('auto');
  });

  it('recognizes a monthly performance workbook without calling Claude', async () => {
    const extraction = await extractXlsx(
      path.join(FIXTURES, 'xlsx', 'monthly-performance-sample.xlsx')
    );
    const callClaude = vi.fn();

    const result = await classifyDocument(extraction, { apiKey: 'unused-key', callClaude });

    expect(result.document_type).toBe('monthly_performance');
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_THRESHOLD);
    expect(result.classified_by).toBe('rules');
    expect(callClaude).not.toHaveBeenCalled();
  });

  it('does not invent a classification when no signal matches', async () => {
    const extraction = extractCsv(path.join(FIXTURES, 'csv', 'no-signal.csv'));
    const callClaude = vi.fn();

    const result = await classifyDocument(extraction, { apiKey: 'unused-key', callClaude });

    expect(result.document_type).toBe('unknown');
    expect(result.confidence).toBe(0);
    expect(result.classified_by).toBe('rules');
    expect(callClaude).not.toHaveBeenCalled();
    expect(resolveClassificationStatus(result)).toBe('rejected');
  });

  it('distinguishes AddicTill from L\'Addition via brand signals', () => {
    const addictillText = 'AddicTill export ticket moyen 4.20 nombre de tickets 12 mode de paiement carte';
    const ladditionText = "L'Addition export ticket moyen 4.20 nombre de tickets 12 mode de paiement carte";

    const addictillScores = applyDeterministicRules(addictillText);
    const ladditionScores = applyDeterministicRules(ladditionText);

    expect(addictillScores.posSourceMatches.pos_export).toBe('addictill_export');
    expect(ladditionScores.posSourceMatches.pos_export).toBe('laddition_export');
    expect(addictillScores.scores.pos_export).toBeGreaterThanOrEqual(AUTO_THRESHOLD);
  });
});

describe('classifyDocument — ambiguous documents', () => {
  it('falls back to the best rule candidate when no API key is set (never invents)', async () => {
    const extraction = extractCsv(path.join(FIXTURES, 'csv', 'ambiguous-signals.csv'));
    const callClaude = vi.fn();

    const result = await classifyDocument(extraction, { apiKey: undefined, callClaude });

    expect(callClaude).not.toHaveBeenCalled();
    expect(result.classified_by).toBe('rules');
    expect(result.confidence).toBeLessThan(AUTO_THRESHOLD);
    // Confidence for the best rule candidate here is well under REVIEW_THRESHOLD too.
    expect(resolveClassificationStatus(result)).toBe('rejected');
  });

  it('uses a valid Claude response to resolve ambiguity', async () => {
    const extraction = extractCsv(path.join(FIXTURES, 'csv', 'ambiguous-signals.csv'));
    const callClaude = vi.fn().mockResolvedValue(
      JSON.stringify({
        document_type: 'monthly_performance',
        confidence: 0.95,
        reasoning_summary: 'Contient des indicateurs de performance mensuelle explicites.',
        detected_signals: ['rapport_mensuel_mention'],
      })
    );

    const result = await classifyDocument(extraction, { apiKey: 'test-key', callClaude });

    expect(callClaude).toHaveBeenCalledTimes(1);
    expect(result.classified_by).toBe('claude');
    expect(result.document_type).toBe('monthly_performance');
    expect(result.confidence).toBe(0.95);
    expect(resolveClassificationStatus(result)).toBe('auto');
  });

  it('falls back to rules when Claude returns invalid JSON (never invents)', async () => {
    const extraction = extractCsv(path.join(FIXTURES, 'csv', 'ambiguous-signals.csv'));
    const callClaude = vi.fn().mockResolvedValue(INVALID_CLAUDE_RESPONSE);

    const result = await classifyDocument(extraction, { apiKey: 'test-key', callClaude });

    expect(result.classified_by).toBe('rules');
    expect(result.confidence).toBeLessThan(AUTO_THRESHOLD);
  });

  it('falls back to rules when Claude is unreachable (never invents)', async () => {
    const extraction = extractCsv(path.join(FIXTURES, 'csv', 'ambiguous-signals.csv'));
    const callClaude = vi.fn().mockRejectedValue(new Error('network error'));

    const result = await classifyDocument(extraction, { apiKey: 'test-key', callClaude });

    expect(result.classified_by).toBe('rules');
  });
});

describe('resolveClassificationStatus', () => {
  it('maps confidence to auto/review_required/rejected per the configured thresholds', () => {
    const base = { document_type: 'bank_statement', detected_signals: [], pos_source_hint: null, classified_by: 'rules', reasoning_summary: 'x' };
    expect(resolveClassificationStatus({ ...base, confidence: AUTO_THRESHOLD })).toBe('auto');
    expect(resolveClassificationStatus({ ...base, confidence: REVIEW_THRESHOLD })).toBe('review_required');
    expect(resolveClassificationStatus({ ...base, confidence: REVIEW_THRESHOLD - 0.01 })).toBe('rejected');
    expect(resolveClassificationStatus({ ...base, document_type: 'unknown', confidence: 0.99 })).toBe(
      'rejected'
    );
  });
});
