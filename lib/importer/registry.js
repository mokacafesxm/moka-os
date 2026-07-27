'use strict';

/**
 * File-hash registry: imports/import-registry.json tracks every file the
 * importer has ever fully processed, keyed by SHA-256 content hash, so a
 * renamed-but-identical file is never reprocessed (per AGENTS.md
 * "Registre des fichiers déjà traités").
 *
 * PR1 only reads/looks up the registry (to report `duplicate` status in
 * dry-run output) — it never writes to it, since nothing reaches a
 * completed state yet (no parser, no Notion write). `writeRegistry` /
 * `upsertEntry` exist now so the schema is fixed and tested from PR1, but
 * the first real caller arrives with the parsers/Notion writes in later PRs.
 */

const fs = require('node:fs');
const { createHash } = require('node:crypto');

const REGISTRY_SCHEMA_VERSION = '1.0';

/**
 * @typedef {Object} RegistryEntry
 * @property {string} file_hash
 * @property {string} original_filename
 * @property {string} processed_at - ISO timestamp
 * @property {string} source_type
 * @property {'success'|'duplicate'|'rejected'|'review_required'} status
 * @property {string} import_run_id
 * @property {string|null} destination_path
 */

/**
 * Computes the SHA-256 hash of raw bytes already in memory — used by the
 * web upload flow (PR4), which never writes the uploaded file to disk.
 * @param {Buffer} buffer
 * @returns {string} hex-encoded digest
 */
function computeFileHashFromBuffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Computes the SHA-256 hash of a file's raw bytes.
 * @param {string} filePath
 * @returns {string} hex-encoded digest
 */
function computeFileHash(filePath) {
  return computeFileHashFromBuffer(fs.readFileSync(filePath));
}

/**
 * Reads the registry file, tolerating a missing or corrupt file by
 * returning a fresh, empty registry rather than throwing.
 * @param {string} registryPath
 * @returns {{schema_version: string, files: RegistryEntry[]}}
 */
function readRegistry(registryPath) {
  if (!fs.existsSync(registryPath)) {
    return { schema_version: REGISTRY_SCHEMA_VERSION, files: [] };
  }
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.files)) {
      return { schema_version: REGISTRY_SCHEMA_VERSION, files: [] };
    }
    return {
      schema_version: parsed.schema_version || REGISTRY_SCHEMA_VERSION,
      files: parsed.files,
    };
  } catch {
    return { schema_version: REGISTRY_SCHEMA_VERSION, files: [] };
  }
}

/**
 * Persists the registry, pretty-printed.
 * @param {{schema_version: string, files: RegistryEntry[]}} registry
 * @param {string} registryPath
 */
function writeRegistry(registry, registryPath) {
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

/**
 * Finds an existing registry entry by file hash.
 * @param {{files: RegistryEntry[]}} registry
 * @param {string} fileHash
 * @returns {RegistryEntry|null}
 */
function findByHash(registry, fileHash) {
  return registry.files.find((entry) => entry.file_hash === fileHash) ?? null;
}

/**
 * Adds or replaces the entry for a given file hash. Not called anywhere in
 * PR1 (see module docstring) — provided now so the format is locked in and
 * unit-tested ahead of PR4's real usage.
 * @param {{schema_version: string, files: RegistryEntry[]}} registry
 * @param {RegistryEntry} entry
 * @returns {{schema_version: string, files: RegistryEntry[]}} a new registry object
 */
function upsertEntry(registry, entry) {
  const files = registry.files.filter((existing) => existing.file_hash !== entry.file_hash);
  files.push(entry);
  return { schema_version: registry.schema_version, files };
}

module.exports = {
  REGISTRY_SCHEMA_VERSION,
  computeFileHash,
  computeFileHashFromBuffer,
  readRegistry,
  writeRegistry,
  findByHash,
  upsertEntry,
};
