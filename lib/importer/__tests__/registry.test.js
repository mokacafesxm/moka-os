import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';

import {
  computeFileHash,
  readRegistry,
  writeRegistry,
  findByHash,
  upsertEntry,
  REGISTRY_SCHEMA_VERSION,
} from '../registry.js';

const FIXTURES = path.join(__dirname, 'fixtures');

const tmpFiles = [];
afterEach(() => {
  while (tmpFiles.length > 0) {
    const file = tmpFiles.pop();
    fs.rmSync(file, { force: true });
  }
});

function tmpPath(name) {
  const filePath = path.join(os.tmpdir(), `importer-registry-test-${Date.now()}-${name}`);
  tmpFiles.push(filePath);
  return filePath;
}

describe('computeFileHash', () => {
  it('is deterministic for identical content', () => {
    const filePath = path.join(FIXTURES, 'csv', 'comma-delimited.csv');
    expect(computeFileHash(filePath)).toBe(computeFileHash(filePath));
  });

  it('is stable across a copy with a different filename (rename must not create a new import)', () => {
    const original = path.join(FIXTURES, 'csv', 'comma-delimited.csv');
    const copy = tmpPath('renamed.csv');
    fs.copyFileSync(original, copy);
    expect(computeFileHash(copy)).toBe(computeFileHash(original));
  });

  it('differs for different content', () => {
    const a = path.join(FIXTURES, 'csv', 'comma-delimited.csv');
    const b = path.join(FIXTURES, 'csv', 'semicolon-delimited.csv');
    expect(computeFileHash(a)).not.toBe(computeFileHash(b));
  });
});

describe('readRegistry', () => {
  it('returns a fresh empty registry when the file does not exist', () => {
    const registry = readRegistry(tmpPath('missing.json'));
    expect(registry).toEqual({ schema_version: REGISTRY_SCHEMA_VERSION, files: [] });
  });

  it('tolerates a corrupt JSON file by returning a fresh registry', () => {
    const filePath = tmpPath('corrupt.json');
    fs.writeFileSync(filePath, '{ not valid json', 'utf8');
    const registry = readRegistry(filePath);
    expect(registry).toEqual({ schema_version: REGISTRY_SCHEMA_VERSION, files: [] });
  });

  it('reads back a previously written registry', () => {
    const filePath = tmpPath('roundtrip.json');
    const original = {
      schema_version: '1.0',
      files: [
        {
          file_hash: 'abc123',
          original_filename: 'test.csv',
          processed_at: '2026-01-01T00:00:00.000Z',
          source_type: 'bank_statement',
          status: 'success',
          import_run_id: 'run-1',
          destination_path: 'imports/processed/test.csv',
        },
      ],
    };
    writeRegistry(original, filePath);
    expect(readRegistry(filePath)).toEqual(original);
  });
});

describe('findByHash / upsertEntry', () => {
  it('finds an existing entry by hash and returns null otherwise', () => {
    const registry = {
      schema_version: '1.0',
      files: [{ file_hash: 'hash-1', original_filename: 'a.csv' }],
    };
    expect(findByHash(registry, 'hash-1')).toEqual(registry.files[0]);
    expect(findByHash(registry, 'hash-missing')).toBeNull();
  });

  it('upserts without mutating the original registry object', () => {
    const registry = { schema_version: '1.0', files: [{ file_hash: 'hash-1', v: 1 }] };
    const updated = upsertEntry(registry, { file_hash: 'hash-1', v: 2 });

    expect(registry.files[0].v).toBe(1); // original untouched
    expect(updated.files).toHaveLength(1);
    expect(updated.files[0].v).toBe(2);
  });

  it('adds a new entry when the hash is not already present', () => {
    const registry = { schema_version: '1.0', files: [] };
    const updated = upsertEntry(registry, { file_hash: 'hash-new', v: 1 });
    expect(updated.files).toHaveLength(1);
  });
});
