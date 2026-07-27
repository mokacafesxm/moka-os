'use strict';

// Canonical writer/reader for the Sold Product Catalogue — Recipe Catalogue
// foundation, target architecture domain A. This is a NEW database (see
// docs/ARCHITECTURE.md "Recipe Catalogue foundation" — the old MENU_DB is
// not safely reusable as-is). Not a competing catalogue to WEBSITE_PRODUCTS:
// this one exists to connect POS sales (via `product_key`, the same string
// space as PRODUCT_SALES.moka_product_key) to recipe composition; a Website
// Product relation is optional metadata, never the join key.
//
// `recipe_status` is deliberately NOT a stored/trusted field here — it's
// always computed fresh from the actual recipe lines (see
// computeRecipeStatus below and recipes-service.js), so it can never go
// stale relative to the real data the way a manually-maintained flag would.

function titleProp(v) { return { title: [{ text: { content: String(v ?? '').trim() } }] }; }
function textProp(v) { return { rich_text: [{ text: { content: String(v ?? '') } }] }; }
function selectProp(v) { return v ? { select: { name: String(v) } } : { select: null }; }
function checkboxProp(v) { return { checkbox: Boolean(v) }; }
function relationProp(...ids) { return { relation: ids.filter(Boolean).map((id) => ({ id })) }; }

function getText(page, propName) {
  const prop = page.properties?.[propName];
  if (prop?.type === 'rich_text' && prop.rich_text?.length) return prop.rich_text[0].plain_text || '';
  if (prop?.type === 'title' && prop.title?.length) return prop.title[0].plain_text || '';
  return '';
}
function getRelationId(page, propName) {
  const prop = page.properties?.[propName];
  return prop?.type === 'relation' && prop.relation?.length ? prop.relation[0].id : null;
}
function getCheckbox(page, propName, fallback = true) {
  const prop = page.properties?.[propName];
  return prop?.type === 'checkbox' ? prop.checkbox : fallback;
}
function getSelectName(page, propName) {
  const prop = page.properties?.[propName];
  return prop?.type === 'select' && prop.select?.name ? prop.select.name : '';
}

function parseAliases(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function mapPage(page) {
  return {
    id: page.id,
    name: getText(page, 'Name') || getText(page, 'name'),
    productKey: getText(page, 'product_key'),
    posAliases: parseAliases(getText(page, 'pos_aliases')),
    websiteProductId: getRelationId(page, 'website_product'),
    active: getCheckbox(page, 'active', true),
    category: getSelectName(page, 'category'),
    requiresRecipe: getCheckbox(page, 'requires_recipe', true),
    yieldUnit: getText(page, 'yield_unit'),
  };
}

function normalizeKey(key) {
  return String(key || '').trim().toLowerCase();
}

function buildProperties(data) {
  const props = {
    Name: titleProp(data?.name),
    product_key: textProp(data?.productKey),
    active: checkboxProp(data?.active ?? true),
    requires_recipe: checkboxProp(data?.requiresRecipe ?? true),
  };
  if (data?.posAliases) props.pos_aliases = textProp(JSON.stringify(data.posAliases));
  if (data?.category) props.category = selectProp(data.category);
  if (data?.yieldUnit) props.yield_unit = textProp(data.yieldUnit);
  if (data?.websiteProductId) props.website_product = relationProp(data.websiteProductId);
  return props;
}

async function listSoldProducts({ soldProductsDbId, notion }) {
  const pages = await notion.queryDatabase(soldProductsDbId, null, null, 300);
  return pages.map(mapPage);
}

async function findSoldProductByKey(productKey, { soldProductsDbId, notion }) {
  const clean = normalizeKey(productKey);
  if (!clean) return null;
  const pages = await notion.queryDatabase(soldProductsDbId, null, null, 300);
  const found = pages.find((p) => normalizeKey(getText(p, 'product_key')) === clean);
  return found ? mapPage(found) : null;
}

async function createSoldProduct(data, { soldProductsDbId, notion }) {
  const name = String(data?.name || '').trim();
  const productKey = String(data?.productKey || '').trim();
  if (!name) throw new Error('Nom du produit requis');
  if (!productKey) throw new Error('product_key requis');

  const existing = await findSoldProductByKey(productKey, { soldProductsDbId, notion });
  if (existing) throw new Error(`product_key "${productKey}" existe déjà (id: ${existing.id})`);

  const page = await notion.createPage(soldProductsDbId, buildProperties(data));
  return { id: page.id };
}

/** Partial update — fields not provided keep their current value (fetched first), never silently reset to a default. */
async function updateSoldProduct(id, data, { notion }) {
  if (!id) throw new Error('id required');
  const existingPage = await notion.getPage(id);
  const existing = mapPage(existingPage);
  const merged = {
    name: data?.name ?? existing.name,
    productKey: data?.productKey ?? existing.productKey,
    posAliases: data?.posAliases ?? existing.posAliases,
    websiteProductId: data?.websiteProductId ?? existing.websiteProductId,
    active: data?.active ?? existing.active,
    category: data?.category ?? existing.category,
    requiresRecipe: data?.requiresRecipe ?? existing.requiresRecipe,
    yieldUnit: data?.yieldUnit ?? existing.yieldUnit,
  };
  await notion.updatePage(id, buildProperties(merged));
  return { success: true };
}

async function archiveSoldProduct(id, { notion }) {
  if (!id) throw new Error('id required');
  await notion.archivePage(id);
  return { success: true };
}

/**
 * Computed, never stored — always derived from real recipe lines so it can
 * never drift from the actual data.
 * @param {{requiresRecipe:boolean}} soldProduct
 * @param {Array<{active:boolean, valid:boolean}>} recipeLines - lines for this product only
 * @returns {'complete'|'incomplete'|'not_required'|'unmapped'}
 */
function computeRecipeStatus(soldProduct, recipeLines) {
  if (soldProduct.requiresRecipe === false) return 'not_required';
  const activeLines = (recipeLines || []).filter((l) => l.active);
  if (activeLines.length === 0) return 'unmapped';
  return activeLines.every((l) => l.valid) ? 'complete' : 'incomplete';
}

module.exports = {
  mapPage,
  buildProperties,
  normalizeKey,
  parseAliases,
  listSoldProducts,
  findSoldProductByKey,
  createSoldProduct,
  updateSoldProduct,
  archiveSoldProduct,
  computeRecipeStatus,
};
