'use strict';

// Shared idempotency-key and bounded-ledger helpers for the Current Stock
// safety patch (Architecture Ownership Audit, section 1/2/3). Deliberately
// self-contained — does NOT import anything from lib/importer, keeping the
// operational (Stock/Supplier Orders) and importer/pilotage domains fully
// decoupled per the audit's own recommendation.

const crypto = require('node:crypto');

const KEY_PREFIXES = ['supplier-receipt', 'invoice-receipt', 'manual-receipt'];

// Notion page ids are 36-char UUIDs (with dashes); invoice hashes are 64-char
// hex; client-generated operation ids are expected to be short random tokens.
// 140 per segment comfortably covers all of these without being unbounded.
const MAX_KEY_LENGTH = 300;
const KEY_PATTERN = /^(supplier-receipt|invoice-receipt|manual-receipt):[A-Za-z0-9._-]{1,140}:[A-Za-z0-9._-]{1,140}$/;

// Same truncation philosophy as lib/importer/notion/audit-metadata.js (bounded,
// deterministic, never throws) — reimplemented locally rather than shared,
// since Stock ledgers and importer audit_metadata are different domains.
const MAX_LEDGER_LENGTH = 1900;
const MAX_LEDGER_ENTRIES = 40;

/**
 * @returns {{valid: true} | {valid: false, reason: string}}
 */
function validateIdempotencyKey(key) {
  if (typeof key !== 'string' || key.length === 0) return { valid: false, reason: 'MISSING' };
  if (key.length > MAX_KEY_LENGTH) return { valid: false, reason: 'TOO_LONG' };
  if (!KEY_PATTERN.test(key)) return { valid: false, reason: 'INVALID_FORMAT' };
  return { valid: true };
}

/**
 * sha256 hex digest of an invoice image, from either a base64 string or a
 * Buffer. Always computed server-side from the actual submitted bytes —
 * never trusts a client-supplied hash.
 */
function computeInvoiceHash(base64OrBuffer) {
  const buf = Buffer.isBuffer(base64OrBuffer)
    ? base64OrBuffer
    : Buffer.from(String(base64OrBuffer || ''), 'base64');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Tolerant parse — a missing/malformed ledger property is just an empty ledger, never a crash. */
function parseLedger(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findLedgerEntry(entries, key) {
  return (entries || []).find((e) => e && e.key === key) || null;
}

/**
 * Merge-by-key: a repeat entry for the same key replaces the previous one
 * instead of growing the ledger — a retry of the same event never bloats
 * storage, and the ledger stays bounded by the number of *distinct* keys,
 * not the number of attempts.
 */
function mergeLedgerByKey(existingEntries, incomingEntries) {
  const map = new Map();
  for (const e of existingEntries || []) if (e && e.key) map.set(e.key, e);
  for (const e of incomingEntries || []) if (e && e.key) map.set(e.key, e);
  return Array.from(map.values());
}

// Fixed-length fingerprint of a full idempotency key. Used ONLY for the
// high-volume, long-lived Stock-side ledger (one entry per receipt ever
// applied to that ingredient, potentially hundreds over the ingredient's
// lifetime) — storing the full ~90-char key plus metadata per entry was
// measured to blow the MAX_LEDGER_LENGTH budget after roughly 10 entries,
// well before MAX_LEDGER_ENTRIES (40) ever took effect, silently evicting
// older receipts and reopening the double-apply window this patch exists to
// close. 20 hex chars (80 bits) makes an accidental collision between two
// DIFFERENT real keys astronomically unlikely at any realistic volume.
function hashLedgerKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex').slice(0, 20);
}

/** Tolerant parse of a compact key-fingerprint set — same fail-open philosophy as parseLedger. */
function parseKeyFingerprints(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Bounded, deterministic serialization of a set of key fingerprints (bare
 * strings, not objects) — far more compact per-entry than serializeLedger,
 * so it takes many more distinct receipts before the oldest is evicted.
 * Still never throws and always fits MAX_LEDGER_LENGTH; still drops the
 * oldest first. This is a mitigation, not a guarantee: with no new
 * database, a bounded rich_text property cannot hold unlimited history —
 * see docs/ARCHITECTURE.md "Stock safety patch" for the long-term fix
 * (an append-only Stock Movements database).
 */
function serializeKeyFingerprints(fingerprints) {
  let list = Array.isArray(fingerprints) ? fingerprints.slice() : [];
  let json;
  try {
    json = JSON.stringify(list);
  } catch {
    return '[]';
  }
  while (json.length > MAX_LEDGER_LENGTH && list.length > 0) {
    list = list.slice(1);
    try {
      json = JSON.stringify(list);
    } catch {
      return '[]';
    }
  }
  return json.length <= MAX_LEDGER_LENGTH ? json : '[]';
}

/**
 * Bounded, deterministic serialization — guaranteed to return valid JSON no
 * longer than MAX_LEDGER_LENGTH, and to never throw, even for pathological
 * input. Drops the OLDEST entries first (by array order) when truncating.
 */
function serializeLedger(entries) {
  let list = Array.isArray(entries) ? entries.slice() : [];
  if (list.length > MAX_LEDGER_ENTRIES) list = list.slice(list.length - MAX_LEDGER_ENTRIES);

  let json;
  try {
    json = JSON.stringify(list);
  } catch {
    return '[]';
  }

  while (json.length > MAX_LEDGER_LENGTH && list.length > 0) {
    list = list.slice(1);
    try {
      json = JSON.stringify(list);
    } catch {
      return '[]';
    }
  }
  return json.length <= MAX_LEDGER_LENGTH ? json : '[]';
}

module.exports = {
  KEY_PREFIXES,
  MAX_KEY_LENGTH,
  MAX_LEDGER_LENGTH,
  MAX_LEDGER_ENTRIES,
  validateIdempotencyKey,
  computeInvoiceHash,
  parseLedger,
  findLedgerEntry,
  mergeLedgerByKey,
  serializeLedger,
  hashLedgerKey,
  parseKeyFingerprints,
  serializeKeyFingerprints,
};
