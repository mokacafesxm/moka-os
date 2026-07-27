'use strict';

/**
 * Establishment allowlist (PR4) — a deliberately minimal stand-in for a
 * future Établissements Notion database (explicitly out of scope for
 * PR4). Configured via `IMPORTS_ESTABLISHMENTS=key:Display Name,key2:Name2`.
 *
 * `establishment_key` is mandatory and explicit everywhere (CLI flag, UI
 * field, API payload) — never inferred from filename, document content,
 * or session state. Business dedup keys use `establishment_key` only,
 * never the display name, so swapping this allowlist for a real Notion
 * relation later never touches parser outputs, business keys, Import Run
 * logic, or UI/API contracts — only this one module's `resolveEstablishment`.
 */

/**
 * @param {string|undefined} raw - process.env.IMPORTS_ESTABLISHMENTS
 * @returns {Map<string, string>} key -> display name
 */
function parseEstablishmentsEnv(raw) {
  const map = new Map();
  if (!raw) return map;
  for (const pair of raw.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) continue; // malformed entry — skip, never guess a key/name split
    const key = trimmed.slice(0, separatorIndex).trim();
    const name = trimmed.slice(separatorIndex + 1).trim();
    if (key && name) map.set(key, name);
  }
  return map;
}

/**
 * @param {string} establishmentKey
 * @param {string|undefined} [envValue] - defaults to process.env.IMPORTS_ESTABLISHMENTS
 * @returns {{key: string, name: string}|null} null when the key is not in the allowlist — never invented
 */
function resolveEstablishment(establishmentKey, envValue = process.env.IMPORTS_ESTABLISHMENTS) {
  if (!establishmentKey) return null;
  const map = parseEstablishmentsEnv(envValue);
  const name = map.get(establishmentKey);
  return name ? { key: establishmentKey, name } : null;
}

/**
 * @param {string|undefined} [envValue]
 * @returns {{key: string, name: string}[]}
 */
function listEstablishments(envValue = process.env.IMPORTS_ESTABLISHMENTS) {
  return Array.from(parseEstablishmentsEnv(envValue), ([key, name]) => ({ key, name }));
}

module.exports = { parseEstablishmentsEnv, resolveEstablishment, listEstablishments };
