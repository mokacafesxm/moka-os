'use strict';

// Canonical writer/reader for Recipe Lines — Recipe Catalogue foundation,
// target architecture domain B/C. A recipe is simply the set of active
// lines sharing a sold_product relation — deliberately relational (one
// Notion row per ingredient line), never one JSON blob, so Notion's own
// relations/queries stay usable and each line is independently validatable/
// auditable. INGREDIENTS remains the sole source of truth for ingredients —
// this module only ever READS it (via getPage) to validate a line; it never
// creates or modifies an ingredient record.

const { validateRecipeLine } = require('./validation');
const { findSoldProductByKey } = require('./sold-products-service');

function titleProp(v) { return { title: [{ text: { content: String(v ?? '').trim() } }] }; }
function textProp(v) { return { rich_text: [{ text: { content: String(v ?? '') } }] }; }
function selectProp(v) { return v ? { select: { name: String(v) } } : { select: null }; }
function numberProp(v) { return { number: v !== undefined && v !== null && v !== '' ? Number(v) : null }; }
function checkboxProp(v) { return { checkbox: Boolean(v) }; }
function relationProp(...ids) { return { relation: ids.filter(Boolean).map((id) => ({ id })) }; }

function getText(page, propName) {
  const prop = page.properties?.[propName];
  if (prop?.type === 'rich_text' && prop.rich_text?.length) return prop.rich_text[0].plain_text || '';
  if (prop?.type === 'title' && prop.title?.length) return prop.title[0].plain_text || '';
  return '';
}
function getNumber(page, propName) {
  const prop = page.properties?.[propName];
  return prop?.type === 'number' && typeof prop.number === 'number' ? prop.number : null;
}
function getSelectName(page, propName) {
  const prop = page.properties?.[propName];
  return prop?.type === 'select' && prop.select?.name ? prop.select.name : '';
}
function getCheckbox(page, propName, fallback = true) {
  const prop = page.properties?.[propName];
  return prop?.type === 'checkbox' ? prop.checkbox : fallback;
}
function getRelationId(page, propName) {
  const prop = page.properties?.[propName];
  return prop?.type === 'relation' && prop.relation?.length ? prop.relation[0].id : null;
}

function businessKey(soldProductId, ingredientId) {
  return `${soldProductId}:${ingredientId}`;
}

function mapPage(page) {
  return {
    id: page.id,
    soldProductId: getRelationId(page, 'sold_product'),
    ingredientId: getRelationId(page, 'ingredient'),
    quantity: getNumber(page, 'quantity'),
    unit: getSelectName(page, 'unit'),
    yieldFactor: getNumber(page, 'yield_factor') ?? 1,
    active: getCheckbox(page, 'active', true),
    notes: getText(page, 'notes'),
    businessKey: getText(page, 'business_key'),
  };
}

function buildProperties({ title, soldProductId, ingredientId, quantity, unit, yieldFactor, active, notes }) {
  const props = {
    Name: titleProp(title),
    sold_product: relationProp(soldProductId),
    ingredient: relationProp(ingredientId),
    quantity: numberProp(quantity),
    unit: selectProp(unit),
    yield_factor: numberProp(yieldFactor ?? 1),
    active: checkboxProp(active ?? true),
    business_key: textProp(businessKey(soldProductId, ingredientId)),
  };
  if (notes) props.notes = textProp(notes);
  return props;
}

/** Resolves a sold product from either an explicit id or a product_key — never both required. */
async function resolveSoldProduct({ soldProductId, soldProductKey, soldProductsDbId, notion }) {
  if (soldProductId) {
    try {
      const page = await notion.getPage(soldProductId);
      if (page.archived) return null;
      return { id: page.id, name: getText(page, 'Name') };
    } catch {
      return null;
    }
  }
  if (soldProductKey) {
    const found = await findSoldProductByKey(soldProductKey, { soldProductsDbId, notion });
    return found ? { id: found.id, name: found.name } : null;
  }
  return null;
}

/** Resolves an ingredient for validation purposes — read-only, never creates/modifies INGREDIENTS. */
async function resolveIngredientForValidation(ingredientId, { notion }) {
  if (!ingredientId) return null;
  try {
    const page = await notion.getPage(ingredientId);
    return {
      id: page.id,
      name: getText(page, 'Ingredient'),
      active: !page.archived,
      uniteStock: getSelectName(page, 'Unite_stock'),
    };
  } catch {
    return null;
  }
}

async function listRecipeLines({ recipeLinesDbId, notion, soldProductId }) {
  const pages = await notion.queryDatabase(recipeLinesDbId, null, null, 300);
  const lines = pages.map(mapPage);
  return soldProductId ? lines.filter((l) => l.soldProductId === soldProductId) : lines;
}

/**
 * @param {object} data - { soldProductId?, soldProductKey?, ingredientId, quantity, unit, yieldFactor?, active?, notes? }
 * @param {{soldProductsDbId:string, recipeLinesDbId:string, notion:object}} ctx
 * @returns {Promise<{success:true, id:string} | {success:false, errors:string[], warnings:string[]}>}
 */
async function createRecipeLine(data, { soldProductsDbId, recipeLinesDbId, notion }) {
  const soldProduct = await resolveSoldProduct({
    soldProductId: data?.soldProductId, soldProductKey: data?.soldProductKey, soldProductsDbId, notion,
  });
  const ingredient = await resolveIngredientForValidation(data?.ingredientId, { notion });
  const existingActiveLines = soldProduct
    ? await listRecipeLines({ recipeLinesDbId, notion, soldProductId: soldProduct.id })
    : [];

  const result = validateRecipeLine({
    soldProduct, ingredient, quantity: data?.quantity, unit: data?.unit, existingActiveLines,
  });
  if (!result.valid) return { success: false, errors: result.errors, warnings: result.warnings };

  const page = await notion.createPage(recipeLinesDbId, buildProperties({
    title: `${soldProduct.name} — ${ingredient.name}`,
    soldProductId: soldProduct.id,
    ingredientId: ingredient.id,
    quantity: data.quantity,
    unit: data.unit,
    yieldFactor: data.yieldFactor,
    active: data.active,
    notes: data.notes,
  }));
  return { success: true, id: page.id, warnings: result.warnings };
}

/**
 * @returns {Promise<{success:true} | {success:false, errors:string[], warnings:string[]}>}
 */
async function updateRecipeLine(id, data, { soldProductsDbId, recipeLinesDbId, notion }) {
  if (!id) throw new Error('id required');
  const existingPage = await notion.getPage(id);
  const existing = mapPage(existingPage);

  const soldProductId = data?.soldProductId ?? existing.soldProductId;
  const soldProduct = await resolveSoldProduct({ soldProductId, soldProductsDbId, notion });
  const ingredientId = data?.ingredientId ?? existing.ingredientId;
  const ingredient = await resolveIngredientForValidation(ingredientId, { notion });

  const existingActiveLines = soldProduct
    ? await listRecipeLines({ recipeLinesDbId, notion, soldProductId: soldProduct.id })
    : [];

  const quantity = data?.quantity ?? existing.quantity;
  const unit = data?.unit ?? existing.unit;
  const active = data?.active ?? existing.active;

  const result = validateRecipeLine({
    soldProduct, ingredient, quantity, unit, existingActiveLines, excludeLineId: id,
  });
  if (!result.valid) return { success: false, errors: result.errors, warnings: result.warnings };

  await notion.updatePage(id, buildProperties({
    title: `${soldProduct.name} — ${ingredient.name}`,
    soldProductId: soldProduct.id,
    ingredientId: ingredient.id,
    quantity,
    unit,
    yieldFactor: data?.yieldFactor ?? existing.yieldFactor,
    active,
    notes: data?.notes ?? existing.notes,
  }));
  return { success: true, warnings: result.warnings };
}

async function archiveRecipeLine(id, { notion }) {
  if (!id) throw new Error('id required');
  await notion.archivePage(id);
  return { success: true };
}

module.exports = {
  businessKey,
  mapPage,
  buildProperties,
  resolveSoldProduct,
  resolveIngredientForValidation,
  listRecipeLines,
  createRecipeLine,
  updateRecipeLine,
  archiveRecipeLine,
};
