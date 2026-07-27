'use strict';

// Canonical writer for INGREDIENTS (Ingredient Catalogue) — Architecture
// cleanup Phase 1. Before this module existed, ingredient create/update was
// implemented three times independently (app/api/settings/products — the
// only one actually reachable from the live UI —, app/api/products/create,
// app/api/products/update), plus a fourth dead branch inside
// app/api/settings (resource=products). All four now delegate here.
//
// The three routes had genuinely different update semantics, preserved
// explicitly via the `mode` option rather than silently unified:
//   - 'partial' (settings/products' actual live behavior): a field is only
//     included in the write if the corresponding input is present/truthy —
//     omitted fields are left untouched on the existing page.
//   - 'full' (products/update's original behavior, never reachable from the
//     current UI but kept working): every field is written, and an
//     unresolved default supplier explicitly clears the relation.
// Stock-row bootstrap on create delegates to lib/stock/ensure-stock-row.js
// (the shared "ensure a Stock row exists" primitive) instead of duplicating
// that logic here — kept best-effort/non-blocking, exactly as before.

const { ensureStockRowForIngredient } = require('../stock/ensure-stock-row');

function titleProp(v) { return { title: [{ text: { content: String(v ?? '').trim() } }] }; }
function selectProp(v) { return v ? { select: { name: String(v) } } : { select: null }; }
function numberProp(v) { return { number: v !== undefined && v !== null && v !== '' ? Number(v) : null }; }
function checkboxProp(v) { return { checkbox: Boolean(v) }; }
function textProp(v) { return { rich_text: [{ text: { content: String(v ?? '') } }] }; }
function relationProp(...ids) { return { relation: ids.filter(Boolean).map((id) => ({ id })) }; }

function getPageTitleText(page, propName) {
  const prop = page.properties?.[propName];
  return prop?.type === 'title' && prop.title?.length ? prop.title[0].plain_text || '' : '';
}

async function resolveSupplierByName(name, { fournisseursDbId, notion }) {
  if (!name) return null;
  try {
    const pages = await notion.queryDatabase(fournisseursDbId, null, null, 200);
    const clean = String(name).trim().toLowerCase();
    const found = pages.find((p) => getPageTitleText(p, 'Fournisseur').trim().toLowerCase() === clean);
    return found?.id || null;
  } catch {
    return null;
  }
}

/**
 * @param {object} data
 * @param {{mode?: 'partial'|'full'}} [options]
 */
function buildIngredientProperties(data, { mode = 'partial' } = {}) {
  const {
    ingredient, name, visibleOrderPad,
    categorie, sousCategorie, zoneStockage, methodeSuivi,
    quantiteCommandeSuggeree, quantiteCommandee, uniteStock, uniteCommande,
    seuilAlerte, seuilCritique, portionGrammes, portion, notes,
  } = data || {};

  const ingredientName = ingredient || name;
  const suggestedQty = quantiteCommandeSuggeree ?? quantiteCommandee;
  const portionValue = portionGrammes ?? portion;

  if (mode === 'full') {
    return {
      Ingredient: titleProp(ingredientName),
      Categorie: selectProp(categorie),
      'Sous-categorie': selectProp(sousCategorie),
      Visible_OrderPad: checkboxProp(visibleOrderPad),
      Zone_stockage: selectProp(zoneStockage),
      Quantite_commande_suggeree: numberProp(suggestedQty),
      Unite_stock: selectProp(uniteStock),
      Unite_commande: selectProp(uniteCommande),
      '1 Portion (g)': numberProp(portionValue),
      Seuil_alerte: numberProp(seuilAlerte),
      Seuil_critique: numberProp(seuilCritique),
    };
  }

  // 'partial' — matches settings/products' original buildProps exactly,
  // including its one quirk: Ingredient/Visible_OrderPad are always included
  // (Visible_OrderPad defaulting to true when not specified), everything
  // else only when provided.
  const props = {
    Ingredient: titleProp(ingredientName),
    Visible_OrderPad: checkboxProp(visibleOrderPad ?? true),
  };
  if (categorie) props.Categorie = selectProp(categorie);
  if (sousCategorie) props['Sous-categorie'] = selectProp(sousCategorie);
  if (zoneStockage) props.Zone_stockage = selectProp(zoneStockage);
  if (methodeSuivi) props.Methode_suivi = selectProp(methodeSuivi);
  if (uniteStock) props.Unite_stock = selectProp(uniteStock);
  if (uniteCommande) props.Unite_commande = selectProp(uniteCommande);
  if (seuilAlerte != null) props.Seuil_alerte = numberProp(seuilAlerte);
  if (seuilCritique != null) props.Seuil_critique = numberProp(seuilCritique);
  if (suggestedQty != null) props.Quantite_commande_suggeree = numberProp(suggestedQty);
  if (portionValue != null) props['1 Portion (g)'] = numberProp(portionValue);
  if (notes) props.Notes = textProp(notes);
  return props;
}

/**
 * @param {object} data
 * @param {{ingredientsDbId:string, fournisseursDbId:string, stockDbId?:string, notion:object, bootstrapStockRow?:boolean, mode?:'partial'|'full'}} ctx
 */
async function createIngredient(data, { ingredientsDbId, fournisseursDbId, stockDbId, notion, bootstrapStockRow = true, mode = 'partial' }) {
  const ingredientName = String(data?.ingredient || data?.name || '').trim();
  if (!ingredientName) throw new Error('Nom ingrédient requis');

  const properties = buildIngredientProperties(data, { mode });
  const supplierId = data?.fournisseurId || await resolveSupplierByName(data?.fournisseurDefaut, { fournisseursDbId, notion });
  if (supplierId) properties['Fournisseur par defaut'] = relationProp(supplierId);

  const page = await notion.createPage(ingredientsDbId, properties);

  if (bootstrapStockRow && stockDbId) {
    // Best-effort, non-blocking — matches the original settings/products
    // behavior of not failing ingredient creation if the stock-row bootstrap
    // has a transient issue.
    try {
      await ensureStockRowForIngredient({
        ingredientId: page.id,
        ingredientName,
        uniteStock: data?.uniteStock,
        stockDbId,
        notion,
      });
    } catch (err) {
      console.error('[ingredients-service] stock row bootstrap failed (non-blocking):', err.message);
    }
  }

  return { id: page.id };
}

/**
 * @param {string} id
 * @param {object} data
 * @param {{ingredientsDbId?:string, fournisseursDbId:string, notion:object, mode?:'partial'|'full'}} ctx
 */
async function updateIngredient(id, data, { fournisseursDbId, notion, mode = 'partial' }) {
  if (!id) throw new Error('id required');

  const properties = buildIngredientProperties(data, { mode });
  const supplierId = data?.fournisseurId || await resolveSupplierByName(data?.fournisseurDefaut, { fournisseursDbId, notion });
  if (supplierId) {
    properties['Fournisseur par defaut'] = relationProp(supplierId);
  } else if (mode === 'full') {
    // Matches products/update's original explicit-clear behavior — 'partial'
    // mode never clears a relation it wasn't asked to set.
    properties['Fournisseur par defaut'] = { relation: [] };
  }

  await notion.updatePage(id, properties);
  return { success: true };
}

async function archiveIngredient(id, { notion }) {
  if (!id) throw new Error('id required');
  await notion.archivePage(id);
  return { success: true };
}

module.exports = {
  buildIngredientProperties,
  resolveSupplierByName,
  createIngredient,
  updateIngredient,
  archiveIngredient,
};
