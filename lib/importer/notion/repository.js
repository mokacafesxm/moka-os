'use strict';

/**
 * Neutral repository layer over the pilotage Notion targets (PR4).
 * Business logic (row builders, commit pipeline) calls THIS module by
 * `targetKey` (e.g. 'product_sales') — never a raw Notion database ID —
 * so the underlying identifier scheme (today: classic `database_id`,
 * resolved from an env var per lib/importer/config/pilotage-targets.js)
 * can change later (e.g. a real Établissements-driven lookup, or a
 * migration to Notion's newer Database/Data Source model) without
 * touching any caller. See docs/ARCHITECTURE.md "PR4".
 */

const { resolveTargetId, PILOTAGE_TARGETS } = require('../config/pilotage-targets');
const notionClient = require('./notion-client');

/**
 * @param {string} targetKey
 * @returns {string} the resolved Notion database ID
 * @throws {Error} CONFIG_MISSING when the target's env var isn't set
 */
function requireTargetId(targetKey) {
  const target = PILOTAGE_TARGETS[targetKey];
  if (!target) throw new Error(`Unknown pilotage target: ${targetKey}`);
  const targetId = resolveTargetId(targetKey);
  if (!targetId) {
    const err = new Error(
      `CONFIG_MISSING: ${target.targetIdEnvVar} is not set — cannot access "${target.label}"`
    );
    err.code = 'CONFIG_MISSING';
    throw err;
  }
  return targetId;
}

/**
 * @param {string} targetKey
 * @param {string} propertyName - a rich_text property
 * @param {string} propertyValue
 * @returns {Promise<{id: string, properties: object}|null>}
 */
async function findByProperty(targetKey, propertyName, propertyValue) {
  const targetId = requireTargetId(targetKey);
  return notionClient.resolveByKey(targetId, propertyName, propertyValue);
}

/**
 * Like `findByProperty`, but returns every matching page — needed for the
 * Import Runs audit trail (PR4 addendum), where multiple attempts can
 * legitimately share the same `file_hash_sha256` and business dedup must
 * check "does ANY of them have status 'committed'", not just the first
 * match a single-result query happens to return.
 * @param {string} targetKey
 * @param {string} propertyName - a rich_text property
 * @param {string} propertyValue
 * @returns {Promise<{id: string, properties: object}[]>}
 */
async function findAllByProperty(targetKey, propertyName, propertyValue) {
  const targetId = requireTargetId(targetKey);
  return notionClient.queryDatabase(targetId, { property: propertyName, rich_text: { equals: propertyValue } }, null, 100);
}

/**
 * @param {string} targetKey
 * @param {object} properties - Notion property-value JSON (see notion-client's builders)
 * @returns {Promise<object>} the created page
 */
async function createRow(targetKey, properties) {
  const targetId = requireTargetId(targetKey);
  return notionClient.createPage(targetId, properties);
}

/**
 * @param {string} pageId
 * @param {object} properties
 * @returns {Promise<object>} the updated page
 */
async function updateRow(pageId, properties) {
  return notionClient.updatePage(pageId, properties);
}

module.exports = { requireTargetId, findByProperty, findAllByProperty, createRow, updateRow };
