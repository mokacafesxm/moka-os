'use strict';

// Canonical writer for BESOINS (Supplier Orders) — Architecture cleanup Phase 1.
// Before this module existed, two independent routes (POST /api/supplier-orders
// and POST /api/orders/send) each implemented their own property mapping and
// id-resolution logic for the same database, and had already drifted: the
// orders/send path wrote the number of distinct cart items into "Quantité
// suggérée" instead of the real ordered quantity. Both routes now delegate here,
// so a given source+items payload produces identical BESOINS properties
// regardless of which route it arrived through.
//
// Business-rule note (preserved exactly, not changed by this consolidation):
// "Quantité suggérée"/"Unité" are only meaningful for a single, ungrouped item.
// A grouped multi-supplier compose order (source "Commandes"/"Composer") never
// set them, even for a single item — that rule is keyed by SOURCE, not by item
// count, exactly as the original /api/supplier-orders code did. The bug fix is
// narrowly scoped to the ungrouped case: it now uses the real item quantity
// instead of the group's item count.

const UUID_RE = /^[0-9a-f-]{36}$/i;
const GROUPED_SOURCES = new Set(['Commandes', 'Composer']);

function titleProp(v) { return { title: [{ text: { content: String(v ?? '') } }] }; }
function textProp(v) { return { rich_text: [{ text: { content: String(v ?? '') } }] }; }
function selectProp(v) { return v ? { select: { name: String(v) } } : { select: null }; }
function numberProp(v) { return { number: v !== undefined && v !== null && v !== '' ? Number(v) : null }; }
function dateProp(v) { return v ? { date: { start: v } } : { date: null }; }
function relationProp(...ids) { return { relation: ids.filter(Boolean).map((id) => ({ id })) }; }

/**
 * "Now" in the café's own timezone (SXM, UTC-4 year-round, no DST) — both
 * original routes computed this identically; kept as one shared function
 * rather than duplicated. A plain `new Date().toISOString()` would record
 * UTC and silently shift "Date création"/"Date envoi" by several hours.
 */
function nowInSXM() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Puerto_Rico' }).replace(' ', 'T') + '-04:00';
}

/** Exact same title rule as the original /api/supplier-orders `buildBesoinTitle`. */
function buildBesoinTitle(source, staffName, fournisseur, produit) {
  if (GROUPED_SOURCES.has(source)) return `Order composée — ${fournisseur || 'Fournisseur'}`;
  if (source === 'Prépas') return `Prépa : ${produit || 'Préparation'}`;
  return `NEW ORDER : ${staffName || 'Staff'}`;
}

function getPageTitle(page, titleKey) {
  const prop = page.properties?.[titleKey];
  return prop?.type === 'title' && prop.title?.length ? prop.title[0].plain_text || '' : '';
}

/** Builds a lowercased-name -> page-id map for a database, for id resolution by display name. */
async function buildNameToIdMap(dbId, titleKey, notion) {
  const pages = await notion.queryDatabase(dbId, null, null, 200);
  const map = {};
  for (const page of pages) {
    const name = getPageTitle(page, titleKey);
    if (name) map[name.trim().toLowerCase()] = page.id;
  }
  return map;
}

function resolveIdFromMap(explicitId, name, map) {
  if (explicitId && UUID_RE.test(String(explicitId))) return explicitId;
  if (!name) return null;
  return map[String(name).trim().toLowerCase()] || null;
}

/**
 * Resolves each item's Ingredients-catalog page id (explicit id/produitId if
 * already a valid uuid, else looked up by name), returning items annotated
 * with `resolvedId`. Only queries Notion once, and only if at least one item
 * actually needs a name-based lookup.
 */
async function resolveOrderItemIds(items, { ingredientsDbId, notion }) {
  const needsLookup = items.some((i) => !UUID_RE.test(String(i.id || i.produitId || '')));
  const map = needsLookup ? await buildNameToIdMap(ingredientsDbId, 'Ingredient', notion) : {};
  return items.map((i) => ({ ...i, resolvedId: resolveIdFromMap(i.id || i.produitId, i.name, map) }));
}

async function resolveSupplierId(explicitId, name, { fournisseursDbId, notion }) {
  if (explicitId && UUID_RE.test(String(explicitId))) return explicitId;
  if (!name) return null;
  const map = await buildNameToIdMap(fournisseursDbId, 'Fournisseur', notion);
  return resolveIdFromMap(null, name, map);
}

async function resolveStaffId(explicitId, name, { staffDbId, notion }) {
  if (explicitId && UUID_RE.test(String(explicitId))) return explicitId;
  if (!name) return null;
  // Staff title property is "Nom" in the live schema (see lib/ops/staff-service.js),
  // but historically some callers matched on whichever title-typed property existed;
  // buildNameToIdMap only needs the resolved title text, not the property name.
  const map = await buildNameToIdMap(staffDbId, 'Nom', notion);
  return resolveIdFromMap(null, name, map);
}

/**
 * Creates ONE BESOINS page representing a single supplier order (one or more
 * items already resolved via resolveOrderItemIds).
 *
 * @param {object} params
 * @param {string} params.source - "OrderPad" | "Commandes" | "Composer" | "Prépas" | other
 * @param {string} [params.staffName]
 * @param {string|null} [params.staffId]
 * @param {string} [params.fournisseur] - display name, used in grouped titles
 * @param {string|null} [params.fournisseurId]
 * @param {string} [params.statut] - default "À commander"
 * @param {string} [params.message]
 * @param {string} [params.dateEnvoi] - ISO string; used for "Date envoi" when statut is "Envoyé"
 * @param {Array<{name:string, quantite?:number, unite?:string, resolvedId?:string|null}>} params.items
 * @param {string} params.besoinsDbId
 * @param {{createPage:Function}} params.notion
 * @param {string} [params.nowIso] - injectable override for tests; defaults to the real SXM "now"
 */
async function createSupplierOrder({
  source, staffName, staffId, fournisseur, fournisseurId,
  statut, message, dateEnvoi, items, besoinsDbId, notion, nowIso,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('createSupplierOrder: items (non-empty array) required');
  }
  if (!besoinsDbId) throw new Error('createSupplierOrder: besoinsDbId required');

  const isGrouped = GROUPED_SOURCES.has(source);
  const singleItem = items.length === 1 ? items[0] : null;
  const title = buildBesoinTitle(source, staffName, fournisseur, singleItem?.name);
  const now = nowIso || nowInSXM();
  const finalStatut = statut || 'À commander';

  const properties = {
    Besoin: titleProp(title),
    Statut: selectProp(finalStatut),
    Source: selectProp(source || 'Commandes'),
    'Date création': dateProp(now),
  };

  if (!isGrouped && singleItem) {
    if (singleItem.quantite != null) properties['Quantité suggérée'] = numberProp(singleItem.quantite);
    if (singleItem.unite) properties['Unité'] = selectProp(singleItem.unite);
  }

  if (finalStatut === 'Envoyé') properties['Date envoi'] = dateProp(dateEnvoi || now);
  if (message) properties['Message envoyé'] = textProp(message);
  // Both live entry points (grouped "Commandes"/"Composer" compose, and the
  // per-supplier "OrderPad" cart submission) always set this, regardless of
  // item count — matches both routes' actual pre-consolidation behavior.
  properties['ID Produit'] = textProp(items.map((i) => i.name).join(', '));

  const relationIds = items.map((i) => i.resolvedId).filter(Boolean);
  if (relationIds.length) properties['Produit'] = relationProp(...relationIds);
  if (fournisseurId) properties['Fournisseur'] = relationProp(fournisseurId);
  if (staffId) properties['Staff'] = relationProp(staffId);

  const page = await notion.createPage(besoinsDbId, properties);
  return { id: page.id };
}

/** Status-only transition (used by both the PATCH endpoint and the legacy bulk "updateStatus" action). */
async function updateSupplierOrderStatus({ id, statut, dateEnvoi, dateLivraisonPrevue, message, notion }) {
  if (!id) throw new Error('updateSupplierOrderStatus: id required');
  const properties = {};
  if (statut) properties.Statut = selectProp(statut);
  if (dateEnvoi) properties['Date envoi'] = dateProp(dateEnvoi);
  if (dateLivraisonPrevue) properties['Date_Livraison_Prevue'] = dateProp(dateLivraisonPrevue);
  if (message) properties['Message envoyé'] = textProp(message);
  await notion.updatePage(id, properties);
  return { success: true };
}

/** Groups a flat cart-item array by supplier display name — used by the /api/orders/send adapter. */
function groupItemsBySupplier(items, { defaultStaffName } = {}) {
  const grouped = {};
  for (const item of items || []) {
    const supplierName = item.Fournisseur || item.fournisseur || 'Sans fournisseur';
    if (!grouped[supplierName]) grouped[supplierName] = { items: [], staffName: item.StaffName || defaultStaffName || 'Staff' };
    grouped[supplierName].items.push(item);
  }
  return grouped;
}

/** Same WhatsApp-style message template the orders/send route always used, kept verbatim. */
function buildOrderPadMessage(supplierName, items, dateStr) {
  const lines = items.map((p) => `- ${p.Produit} — ${p['Quantité']} ${p.Unite || ''}`.trim()).join('\n');
  return `Bonjour ${supplierName} 👋\n\nCommande du ${dateStr} :\n\n${lines}\n\nMerci 🙏\n— Équipe MÖKA`;
}

/** Human-readable French date (SXM timezone) used inside the message body — same format as before. */
function buildOrderPadDateStr() {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Puerto_Rico',
  });
}

module.exports = {
  GROUPED_SOURCES,
  buildBesoinTitle,
  buildNameToIdMap,
  resolveOrderItemIds,
  resolveSupplierId,
  resolveStaffId,
  createSupplierOrder,
  updateSupplierOrderStatus,
  groupItemsBySupplier,
  buildOrderPadMessage,
  buildOrderPadDateStr,
  nowInSXM,
};
