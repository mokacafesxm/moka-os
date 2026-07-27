import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';

import { loadProductMappings, normalizeProductKey } from '../../parsers/recipe-mapping.js';

const tmpFiles = [];
afterEach(() => {
  while (tmpFiles.length > 0) fs.rmSync(tmpFiles.pop(), { force: true });
});

function tmpPath(name) {
  const filePath = path.join(os.tmpdir(), `recipe-mapping-test-${Date.now()}-${name}`);
  tmpFiles.push(filePath);
  return filePath;
}

describe('loadProductMappings', () => {
  it('returns an empty map when the file does not exist (never invents a mapping)', () => {
    const map = loadProductMappings(tmpPath('missing.json'));
    expect(map.size).toBe(0);
  });

  it('tolerates a corrupt JSON file by returning an empty map', () => {
    const filePath = tmpPath('corrupt.json');
    fs.writeFileSync(filePath, '{ not valid json', 'utf8');
    expect(loadProductMappings(filePath).size).toBe(0);
  });

  it('loads and normalizes valid mapping entries', () => {
    const filePath = tmpPath('valid.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({ mappings: [{ addictill_product_key: '  Cafe Latte ', moka_product_key: 'moka-latte' }] }),
      'utf8'
    );
    const map = loadProductMappings(filePath);
    expect(map.get('CAFE LATTE')).toBe('moka-latte');
  });

  it('ignores malformed entries (missing keys) rather than guessing', () => {
    const filePath = tmpPath('partial.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({ mappings: [{ addictill_product_key: 'CAFE' }, { moka_product_key: 'moka-x' }] }),
      'utf8'
    );
    expect(loadProductMappings(filePath).size).toBe(0);
  });
});

describe('normalizeProductKey', () => {
  it('collapses internal whitespace and trims', () => {
    expect(normalizeProductKey('  Iced   Latte  ')).toBe('ICED LATTE');
  });
});
