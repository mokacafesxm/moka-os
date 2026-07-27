import { describe, it, expect } from 'vitest';
import { canConvert, convert, unitFamily, isKnownUnit } from '../units.js';

describe('unit families', () => {
  it('classifies known units', () => {
    expect(unitFamily('g')).toBe('mass');
    expect(unitFamily('kg')).toBe('mass');
    expect(unitFamily('ml')).toBe('volume');
    expect(unitFamily('l')).toBe('volume');
    expect(unitFamily('pièce')).toBe('count');
  });

  it('returns null for an unknown unit', () => {
    expect(unitFamily('cuillère')).toBeNull();
    expect(isKnownUnit('cuillère')).toBe(false);
  });
});

describe('canConvert', () => {
  it('allows same-family conversions', () => {
    expect(canConvert('g', 'kg')).toBe(true);
    expect(canConvert('ml', 'l')).toBe(true);
  });

  it('rejects cross-family conversions', () => {
    expect(canConvert('g', 'ml')).toBe(false);
    expect(canConvert('kg', 'piece')).toBe(false);
  });

  it('rejects unknown units', () => {
    expect(canConvert('g', 'cuillère')).toBe(false);
  });
});

describe('convert', () => {
  it('converts g <-> kg correctly', () => {
    expect(convert(500, 'g', 'kg')).toEqual({ ok: true, value: 0.5 });
    expect(convert(2, 'kg', 'g')).toEqual({ ok: true, value: 2000 });
  });

  it('converts ml <-> l correctly', () => {
    expect(convert(250, 'ml', 'l')).toEqual({ ok: true, value: 0.25 });
    expect(convert(1.5, 'l', 'ml')).toEqual({ ok: true, value: 1500 });
  });

  it('is a no-op identity conversion for the same unit', () => {
    expect(convert(5, 'piece', 'piece')).toEqual({ ok: true, value: 5 });
  });

  it('never silently converts incompatible units', () => {
    const result = convert(5, 'g', 'ml');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INCOMPATIBLE_UNITS');
  });

  it('rejects an unknown unit rather than guessing', () => {
    const result = convert(5, 'g', 'cuillère');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('UNKNOWN_UNIT');
  });

  it('rejects a non-finite quantity', () => {
    expect(convert(NaN, 'g', 'kg').ok).toBe(false);
  });
});
