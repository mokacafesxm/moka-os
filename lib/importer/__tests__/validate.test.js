import { describe, it, expect } from 'vitest';

import { parseAmount, detectCurrencyHint, parseDate, checkBalanceEquation } from '../validate.js';

describe('parseAmount', () => {
  it('parses a simple dot-decimal amount', () => {
    expect(parseAmount('12.34')).toEqual({ ok: true, amountCents: 1234, negative: false });
  });

  it('parses a simple comma-decimal (French) amount', () => {
    expect(parseAmount('12,34')).toEqual({ ok: true, amountCents: 1234, negative: false });
  });

  it('parses French thousands grouping with comma decimal', () => {
    expect(parseAmount('1 234,56')).toEqual({ ok: true, amountCents: 123456, negative: false });
  });

  it('parses US thousands grouping with dot decimal', () => {
    expect(parseAmount('1,234.56')).toEqual({ ok: true, amountCents: 123456, negative: false });
  });

  it('parses an explicit leading-plus positive amount', () => {
    expect(parseAmount('+ 1 234,56')).toEqual({ ok: true, amountCents: 123456, negative: false });
  });

  it('parses a leading-minus negative amount', () => {
    expect(parseAmount('-45.00')).toEqual({ ok: true, amountCents: -4500, negative: true });
  });

  it('parses a parenthesized negative amount', () => {
    expect(parseAmount('(45.00)')).toEqual({ ok: true, amountCents: -4500, negative: true });
  });

  it('strips currency symbols', () => {
    expect(parseAmount('€1 234,56')).toEqual({ ok: true, amountCents: 123456, negative: false });
    expect(parseAmount('$1,234.56')).toEqual({ ok: true, amountCents: 123456, negative: false });
  });

  it('treats a single comma followed by exactly 3 digits as thousands grouping (only EUR/USD in scope, both use 2-digit decimals)', () => {
    expect(parseAmount('1,234')).toEqual({ ok: true, amountCents: 123400, negative: false });
  });

  it('refuses to guess on a genuinely ambiguous separator (neither 2-digit decimal nor 3-digit grouping)', () => {
    const result = parseAmount('12,3456');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ambiguous_comma_separator');
  });

  it('rejects unparseable input rather than inventing a value', () => {
    expect(parseAmount('not-an-amount').ok).toBe(false);
    expect(parseAmount('').ok).toBe(false);
    expect(parseAmount(null).ok).toBe(false);
  });
});

describe('detectCurrencyHint', () => {
  it('detects EUR from the € symbol or ISO code', () => {
    expect(detectCurrencyHint('12,34 €')).toBe('EUR');
    expect(detectCurrencyHint('12.34 EUR')).toBe('EUR');
  });

  it('detects USD from the $ symbol or ISO code', () => {
    expect(detectCurrencyHint('$12.34')).toBe('USD');
    expect(detectCurrencyHint('12.34 USD')).toBe('USD');
  });

  it('returns null rather than assuming a currency', () => {
    expect(detectCurrencyHint('12.34')).toBeNull();
  });
});

describe('parseDate', () => {
  it('parses an ISO date', () => {
    const result = parseDate('2026-01-15');
    expect(result.ok).toBe(true);
    expect(result.iso).toBe('2026-01-15');
    expect(result.ambiguous).toBe(false);
  });

  it('parses an unambiguous DD/MM/YYYY date (day > 12)', () => {
    const result = parseDate('25/03/2026');
    expect(result.ok).toBe(true);
    expect(result.iso).toBe('2026-03-25');
    expect(result.ambiguous).toBe(false);
  });

  it('parses an unambiguous MM/DD/YYYY date (assumeFormat does not matter, month > 12 impossible so day must be second)', () => {
    const result = parseDate('03/25/2026');
    expect(result.ok).toBe(true);
    expect(result.iso).toBe('2026-03-25');
    expect(result.ambiguous).toBe(false);
  });

  it('flags a genuinely ambiguous date and defaults to DMY', () => {
    const result = parseDate('03/04/2026');
    expect(result.ok).toBe(true);
    expect(result.ambiguous).toBe(true);
    expect(result.iso).toBe('2026-04-03'); // DMY: day=03, month=04
  });

  it('respects assumeFormat: MDY for a genuinely ambiguous date', () => {
    const result = parseDate('03/04/2026', { assumeFormat: 'MDY' });
    expect(result.ok).toBe(true);
    expect(result.ambiguous).toBe(true);
    expect(result.iso).toBe('2026-03-04'); // MDY: month=03, day=04
  });

  it('rejects an impossible calendar date rather than silently accepting it', () => {
    expect(parseDate('2026-02-30').ok).toBe(false);
    expect(parseDate('31/04/2026').ok).toBe(false); // April has 30 days
  });

  it('rejects an unrecognized format', () => {
    expect(parseDate('15 janvier 2026').ok).toBe(false);
  });
});

describe('checkBalanceEquation', () => {
  it('confirms a consistent balance equation', () => {
    const result = checkBalanceEquation({
      openingBalanceCents: 100000,
      totalCreditsCents: 50000,
      totalDebitsCents: 20000,
      closingBalanceCents: 130000,
    });
    expect(result).toEqual({ ok: true, expectedClosingBalanceCents: 130000, differenceCents: 0 });
  });

  it('detects an inconsistent balance equation without tolerating rounding', () => {
    const result = checkBalanceEquation({
      openingBalanceCents: 100000,
      totalCreditsCents: 50000,
      totalDebitsCents: 20000,
      closingBalanceCents: 130001, // off by 1 cent
    });
    expect(result.ok).toBe(false);
    expect(result.expectedClosingBalanceCents).toBe(130000);
    expect(result.differenceCents).toBe(1);
  });
});
