'use strict';

/**
 * Read-only Notion schema discovery/validation (PR4). Never creates,
 * renames, or modifies a Notion property — only reports a precise
 * SCHEMA_MISMATCH so the caller can block writes. Select/multi_select
 * *option values* (e.g. a new payment method appearing in real data) are
 * data, not schema, and are outside this check's concern entirely.
 */

const { getDatabase } = require('./notion-client');
const { PILOTAGE_TARGETS, resolveTargetId } = require('../config/pilotage-targets');

/**
 * @param {string} targetKey
 * @returns {Promise<{targetKey: string, targetId: string|null, reachable: boolean, reason: string|null, properties: object|null}>}
 */
async function getDatabaseSchema(targetKey) {
  const targetId = resolveTargetId(targetKey);
  if (!targetId) {
    return { targetKey, targetId: null, reachable: false, reason: 'CONFIG_MISSING', properties: null };
  }
  try {
    const db = await getDatabase(targetId);
    return { targetKey, targetId, reachable: true, reason: null, properties: db.properties };
  } catch (error) {
    const reason =
      error.status === 404 ? 'NOT_FOUND' : error.status === 403 ? 'NOT_SHARED_WITH_INTEGRATION' : 'FETCH_ERROR';
    return { targetKey, targetId, reachable: false, reason, error: error.message, properties: null };
  }
}

/**
 * @param {Record<string, string>} requiredProperties - name -> expected Notion property type
 * @param {Record<string, {type: string}>|null} actualProperties - as returned by getDatabase()
 * @returns {{valid: boolean, missing: string[], typeMismatches: {name:string,expected:string,actual:string}[], extra: string[]}}
 */
function validateSchema(requiredProperties, actualProperties) {
  const missing = [];
  const typeMismatches = [];
  const actual = actualProperties ?? {};

  for (const [name, expectedType] of Object.entries(requiredProperties)) {
    const actualProp = actual[name];
    if (!actualProp) {
      missing.push(name);
      continue;
    }
    if (actualProp.type !== expectedType) {
      typeMismatches.push({ name, expected: expectedType, actual: actualProp.type });
    }
  }

  const requiredNames = new Set(Object.keys(requiredProperties));
  const extra = Object.keys(actual).filter((name) => !requiredNames.has(name));

  return { valid: missing.length === 0 && typeMismatches.length === 0, missing, typeMismatches, extra };
}

/**
 * @param {string} targetKey
 * @returns {Promise<{targetKey: string, label: string, ok: boolean, reason: string|null, validation: object|null}>}
 */
async function checkTargetSchema(targetKey) {
  const target = PILOTAGE_TARGETS[targetKey];
  const schemaResult = await getDatabaseSchema(targetKey);
  if (!schemaResult.reachable) {
    return { targetKey, label: target.label, ok: false, reason: schemaResult.reason, validation: null };
  }
  const validation = validateSchema(target.requiredProperties, schemaResult.properties);
  return {
    targetKey,
    label: target.label,
    ok: validation.valid,
    reason: validation.valid ? null : 'SCHEMA_MISMATCH',
    validation,
  };
}

/**
 * @param {string[]} [targetKeys] - defaults to all 5 pilotage targets
 * @returns {Promise<Array<Awaited<ReturnType<typeof checkTargetSchema>>>>}
 */
async function checkPilotageSchemas(targetKeys = Object.keys(PILOTAGE_TARGETS)) {
  const results = [];
  for (const targetKey of targetKeys) {
    results.push(await checkTargetSchema(targetKey));
  }
  return results;
}

module.exports = { getDatabaseSchema, validateSchema, checkTargetSchema, checkPilotageSchemas };
