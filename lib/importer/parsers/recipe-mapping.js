'use strict';

/**
 * Product Mapping (PR3 scope) — an exact-key lookup from an AddicTill
 * product name to a MÖKA product/recipe key. Deliberately narrow: this is
 * ONLY the identity link (AddicTill key -> MÖKA key), never ingredient
 * composition or quantities.
 *
 * Per the approved PR3 plan, three concerns stay strictly separate:
 *   1. Product Mapping (this file)      — AddicTill key -> MÖKA key
 *   2. Recipes                          — recipe identity/metadata (NOT built in PR3)
 *   3. Recipe Lines                     — recipe -> ingredient + qty + unit (NOT built in PR3)
 * See docs/ARCHITECTURE.md "PR3" for the full rationale — no
 * product/ingredient relation exists anywhere in the live Notion schema
 * today, so this is new territory, built one layer at a time.
 *
 * The mapping source is a local JSON file, empty by default. It is NOT
 * queried from Notion — no Notion access exists before PR4. Matching is
 * exact-key only (case/whitespace-normalized) — never fuzzy — so an
 * unmapped product is always reported, never silently guessed.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MAPPING_PATH = path.join(process.cwd(), 'lib', 'importer', 'config', 'product-mapping.json');

/**
 * @param {string} name
 * @returns {string}
 */
function normalizeProductKey(name) {
  return name.trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Loads product mappings from a local JSON file. Tolerates a missing file
 * (returns an empty map, not an error) — matches the registry.js pattern
 * from PR1.
 * @param {string} [mappingPath]
 * @returns {Map<string, string>} normalized AddicTill key -> MÖKA product key
 */
function loadProductMappings(mappingPath = DEFAULT_MAPPING_PATH) {
  if (!fs.existsSync(mappingPath)) return new Map();

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  } catch {
    return new Map();
  }

  const map = new Map();
  for (const entry of raw?.mappings ?? []) {
    if (typeof entry?.addictill_product_key === 'string' && typeof entry?.moka_product_key === 'string') {
      map.set(normalizeProductKey(entry.addictill_product_key), entry.moka_product_key);
    }
  }
  return map;
}

/**
 * Annotates each product with a `mapping_status` ('mapped'/'unmapped') and,
 * when mapped, the resolved `moka_product_key` — based on an exact
 * (normalized) name match against `mappings`, never fuzzy. Returns the
 * annotated products plus the deduplicated list of unmapped product names —
 * never silently dropped.
 * @param {import('../schemas').AddicTillProductRow[]} products
 * @param {Map<string, string>} mappings
 * @returns {{products: import('../schemas').AddicTillProductRow[], unmapped_products: string[]}}
 */
function annotateProductsWithMapping(products, mappings) {
  const unmapped = new Set();
  const annotated = products.map((product) => {
    const mokaKey = mappings.get(normalizeProductKey(product.product_name)) ?? null;
    if (!mokaKey) unmapped.add(product.product_name);
    return { ...product, mapping_status: mokaKey ? 'mapped' : 'unmapped', moka_product_key: mokaKey };
  });
  return { products: annotated, unmapped_products: Array.from(unmapped) };
}

module.exports = {
  DEFAULT_MAPPING_PATH,
  normalizeProductKey,
  loadProductMappings,
  annotateProductsWithMapping,
};
