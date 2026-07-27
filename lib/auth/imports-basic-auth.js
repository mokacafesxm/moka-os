'use strict';

/**
 * HTTP Basic Auth for the /imports staff UI and /api/imports/* endpoints
 * (PR4) — a deliberately temporary staff-access layer. A future
 * role-based staff authentication system can replace it without changing
 * the importer service layer (lib/importer/**): every consumer of this
 * module only sees a boolean-ish verification result, never a session or
 * user model tied to Basic Auth specifically.
 *
 * Credentials come only from server-side env vars (IMPORTS_AUTH_USERNAME /
 * IMPORTS_AUTH_PASSWORD), never exposed to client-side code. Missing
 * production credentials fail closed (401, not "open"). The only dev
 * opt-out is the explicit IMPORTS_AUTH_DISABLED=true — never inferred from
 * NODE_ENV, so a misconfigured deployment cannot silently run
 * unauthenticated.
 *
 * Uses only Web Crypto (`crypto.subtle`) and `atob`/`TextDecoder` instead
 * of `node:crypto`/`Buffer` — this module is loaded from middleware.js,
 * and Next.js still bundles the legacy `middleware.js` file convention for
 * the Edge runtime by default (only the newer `proxy.js` convention
 * defaults to Node.js — see docs/ARCHITECTURE.md "PR4" "Edge runtime").
 * `node:crypto` fails to bundle there ("Cannot find module 'node:crypto'"),
 * so every primitive here is a Web/Edge-safe standard API instead — which
 * also happens to work identically under plain Node, so this file behaves
 * the same everywhere it's loaded.
 */

const REALM = 'moka-importer';

/** @returns {boolean} */
function isAuthDisabled() {
  return process.env.IMPORTS_AUTH_DISABLED === 'true';
}

/** @returns {{username: string, password: string}|null} null when either env var is missing/empty */
function getConfiguredCredentials() {
  const username = process.env.IMPORTS_AUTH_USERNAME;
  const password = process.env.IMPORTS_AUTH_PASSWORD;
  if (!username || !password) return null;
  return { username, password };
}

/**
 * SHA-256 digest of a UTF-8 string via Web Crypto.
 * @param {string} value
 * @returns {Promise<Uint8Array>}
 */
async function sha256(value) {
  const data = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

/**
 * Constant-time byte comparison — always walks every byte of both
 * fixed-length (32-byte, SHA-256) digests regardless of where they first
 * differ, so comparison time never leaks information about the input.
 * @param {Uint8Array} a
 * @param {Uint8Array} b
 * @returns {boolean}
 */
function constantTimeBytesEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Constant-time string comparison via a fixed-length SHA-256 digest of each
 * side, so differing input lengths never leak information through
 * comparison time.
 * @param {string} a
 * @param {string} b
 * @returns {Promise<boolean>}
 */
async function constantTimeEqual(a, b) {
  const [digestA, digestB] = await Promise.all([sha256(a), sha256(b)]);
  return constantTimeBytesEqual(digestA, digestB);
}

/**
 * Decodes a base64 string to UTF-8 text using only atob/TextDecoder (both
 * standard in every runtime this module loads under — see module docstring).
 * @param {string} base64
 * @returns {string}
 */
function base64ToUtf8(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * @param {string|null|undefined} authorizationHeader - the raw `Authorization` request header
 * @returns {{username: string, password: string}|null} null when missing/malformed/not Basic
 */
function parseBasicAuthHeader(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.startsWith('Basic ')) return null;
  const encoded = authorizationHeader.slice('Basic '.length).trim();
  let decoded;
  try {
    decoded = base64ToUtf8(encoded);
  } catch {
    return null;
  }
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return null;
  return { username: decoded.slice(0, separatorIndex), password: decoded.slice(separatorIndex + 1) };
}

/**
 * Verifies a request's Authorization header against the configured
 * credentials. Never logs the submitted credentials (only the boolean
 * result / a reason code is ever surfaced to callers).
 * @param {string|null|undefined} authorizationHeader
 * @returns {Promise<{ok: boolean, reason: 'DISABLED'|'CONFIG_MISSING'|'MISSING_HEADER'|'INVALID_CREDENTIALS'|null}>}
 */
async function verifyBasicAuth(authorizationHeader) {
  if (isAuthDisabled()) return { ok: true, reason: 'DISABLED' };

  const configured = getConfiguredCredentials();
  if (!configured) return { ok: false, reason: 'CONFIG_MISSING' };

  const submitted = parseBasicAuthHeader(authorizationHeader);
  if (!submitted) return { ok: false, reason: 'MISSING_HEADER' };

  const [usernameOk, passwordOk] = await Promise.all([
    constantTimeEqual(submitted.username, configured.username),
    constantTimeEqual(submitted.password, configured.password),
  ]);
  if (!usernameOk || !passwordOk) return { ok: false, reason: 'INVALID_CREDENTIALS' };

  return { ok: true, reason: null };
}

/**
 * @param {string} pathname
 * @returns {boolean} true for /imports, /imports/*, /api/imports, /api/imports/*
 */
function isImportsPath(pathname) {
  return (
    pathname === '/imports' ||
    pathname.startsWith('/imports/') ||
    pathname === '/api/imports' ||
    pathname.startsWith('/api/imports/')
  );
}

module.exports = {
  REALM,
  isAuthDisabled,
  getConfiguredCredentials,
  constantTimeEqual,
  parseBasicAuthHeader,
  verifyBasicAuth,
  isImportsPath,
};
