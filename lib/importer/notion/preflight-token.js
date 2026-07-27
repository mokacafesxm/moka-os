'use strict';

/**
 * HMAC-signed preflight token (scan-z secondary source, spec v3 §0) —
 * cryptographically binds a scan-z preflight's raw OCR result to the image
 * hash, source subtype, establishment, and an expiry, so a commit can never
 * trust a client-resubmitted "raw values" field: the client can only ever
 * resubmit the SAME token it was given, and any modification to its
 * payload invalidates the signature. Not encrypted, only signed — the same
 * values are already shown to the authenticated human reviewer in
 * plaintext via the preview UI, so confidentiality isn't a requirement.
 *
 * Chosen over server-side temporary storage precisely because this app
 * runs as stateless Vercel serverless functions with no shared in-memory
 * store, and never persists an uploaded file between steps anywhere else —
 * see docs/ARCHITECTURE.md "scan-z secondary source" §0.
 *
 * Time-limited (default 30 minutes) and tamper-evident, but explicitly NOT
 * guaranteed single-use — nothing here prevents the same valid token from
 * being replayed to commit more than once before it expires. This is safe
 * in practice: every replay still goes through the full precedence/
 * duplicate/schema checks in commit-pipeline.js and the idempotent
 * per-row upsert in pilotage-writer.js, so a replay can only ever repeat
 * the exact same safe write the original commit would have made — never
 * something new, different, or more damaging. A future revision could add
 * single-use enforcement (e.g. burning the token's identity into Import
 * Runs and rejecting a repeat) if replay ever becomes an operational
 * concern; not implemented here.
 */

const crypto = require('node:crypto');
const { PreflightTokenPayloadSchema } = require('../schemas');

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** @returns {string|null} */
function getSecret() {
  const secret = process.env.IMPORTS_PREFLIGHT_TOKEN_SECRET;
  return secret && secret.trim() ? secret.trim() : null;
}

/**
 * @param {string} payloadB64
 * @param {string} secret
 * @returns {Buffer}
 */
function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest();
}

/**
 * @param {{file_hash_sha256: string, source_subtype: string, establishment_key: string, ocr_raw_values: object, ttlMs?: number}} params
 * @returns {string} the signed token, format `base64url(payload_json).base64url(hmac)`
 * @throws {Error} CONFIG_MISSING (err.code) when IMPORTS_PREFLIGHT_TOKEN_SECRET is unset
 */
function mintPreflightToken({ file_hash_sha256, source_subtype, establishment_key, ocr_raw_values, ttlMs = DEFAULT_TTL_MS }) {
  const secret = getSecret();
  if (!secret) {
    const err = new Error('CONFIG_MISSING: IMPORTS_PREFLIGHT_TOKEN_SECRET is not set — cannot mint a preflight token');
    err.code = 'CONFIG_MISSING';
    throw err;
  }

  const now = Date.now();
  const payload = {
    file_hash_sha256,
    source_subtype,
    establishment_key,
    ocr_raw_values,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttlMs).toISOString(),
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signatureB64 = sign(payloadB64, secret).toString('base64url');
  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verifies a preflight token's signature before trusting ANY of its
 * payload fields. A malformed token, or one whose signature does not
 * verify, never has its payload parsed or returned — the client must
 * never be able to redefine what the raw OCR values were. See module
 * docstring and docs/ARCHITECTURE.md "scan-z secondary source" §0.
 * @param {string|null|undefined} token
 * @returns {{ok: true, expired: boolean, payload: import('../schemas').PreflightTokenPayload} | {ok: false, reason: 'CONFIG_MISSING'|'MALFORMED'|'INVALID_SIGNATURE'}}
 */
function verifyPreflightToken(token) {
  const secret = getSecret();
  if (!secret) return { ok: false, reason: 'CONFIG_MISSING' };

  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, reason: 'MALFORMED' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'MALFORMED' };
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return { ok: false, reason: 'MALFORMED' };

  let expectedSignature;
  let submittedSignature;
  try {
    expectedSignature = sign(payloadB64, secret);
    submittedSignature = Buffer.from(signatureB64, 'base64url');
  } catch {
    return { ok: false, reason: 'MALFORMED' };
  }

  // Constant-time comparison. timingSafeEqual requires equal-length
  // buffers — a tampered/garbage signature can easily fail that length
  // check, which is treated as a normal "does not verify" outcome, never
  // a crash.
  let signatureValid;
  try {
    signatureValid =
      expectedSignature.length === submittedSignature.length &&
      crypto.timingSafeEqual(expectedSignature, submittedSignature);
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    // Never parse or return the payload here — an invalid signature means
    // nothing in the payload can be trusted, not even to inspect it.
    return { ok: false, reason: 'INVALID_SIGNATURE' };
  }

  let rawPayload;
  try {
    rawPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    // Signature verified against bytes that don't even parse as JSON.
    return { ok: false, reason: 'MALFORMED' };
  }

  const parsed = PreflightTokenPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return { ok: false, reason: 'MALFORMED' };
  }

  const expired = new Date(parsed.data.expires_at).getTime() <= Date.now();
  return { ok: true, expired, payload: parsed.data };
}

module.exports = { DEFAULT_TTL_MS, mintPreflightToken, verifyPreflightToken };
