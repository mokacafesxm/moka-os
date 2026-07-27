import { describe, it, expect } from 'vitest';
import { normalizeName, generateProductKey, namesMatchExactly } from '../normalization.js';

describe('normalizeName', () => {
  it('strips accents', () => {
    expect(normalizeName('MÖKA')).toBe('moka');
    expect(normalizeName('Möka\'s Caesar')).toBe(normalizeName("MÖKA's Caesar"));
  });

  it('lowercases and collapses whitespace/punctuation', () => {
    expect(normalizeName('  Iced   Latte!! ')).toBe('iced latte');
  });

  it('drops apostrophes without inserting a separator', () => {
    expect(normalizeName("MÖKA's Caesar")).toBe('mokas caesar');
  });

  it('is deterministic', () => {
    expect(normalizeName('Café Latte')).toBe(normalizeName('Café Latte'));
  });
});

describe('generateProductKey', () => {
  it('produces a stable kebab-case key', () => {
    expect(generateProductKey('Smashed Avocado')).toBe('smashed-avocado');
    expect(generateProductKey("MÖKA's Caesar")).toBe('mokas-caesar');
  });

  it('is deterministic — same input always produces the same key', () => {
    expect(generateProductKey('Burrito Breakfast')).toBe(generateProductKey('Burrito Breakfast'));
  });

  it('normalizes spelling variants to the same key', () => {
    expect(generateProductKey("Möka's Caesar")).toBe(generateProductKey("MÖKA's Caesar"));
  });
});

describe('namesMatchExactly', () => {
  it('matches names differing only by accent/case/punctuation', () => {
    expect(namesMatchExactly("Möka's Caesar", "MÖKA's Caesar")).toBe(true);
  });

  it('does not match genuinely different names', () => {
    expect(namesMatchExactly('Latte', 'Latte Large')).toBe(false);
  });
});
