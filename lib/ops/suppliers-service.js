'use strict';

// Canonical writer for FOURNISSEURS (Suppliers) — Architecture cleanup Phase 1.
// Consolidates app/api/settings/suppliers (the only implementation actually
// reachable from the live UI) and the dead resource=suppliers branch inside
// app/api/settings.
//
// Real schema (per the original route's own comment):
//   Fournisseur (title), Catégorie (select), Contact principal (rich_text),
//   Méthode contact (select: WhatsApp|Email), WhatsApp (phone_number),
//   Email (email), Actif (checkbox), Notes (rich_text).

function mapPage(page) {
  const p = page.properties;
  const nom = p['Fournisseur']?.title?.[0]?.plain_text || '';
  return {
    id: page.id,
    nom,
    name: nom,
    fournisseur: nom,
    categorie: p['Catégorie']?.select?.name || '',
    contact: p['Contact principal']?.rich_text?.[0]?.plain_text || '',
    methodeContact: p['Méthode contact']?.select?.name || '',
    telephone: p['WhatsApp']?.phone_number || '',
    whatsapp: p['WhatsApp']?.phone_number || '',
    email: p['Email']?.email || '',
    actif: p['Actif']?.checkbox ?? true,
  };
}

function buildSupplierProperties(data) {
  const props = {
    Fournisseur: { title: [{ text: { content: data?.nom || data?.name || '' } }] },
    Actif: { checkbox: data?.actif !== false },
  };
  if (data?.categorie) props['Catégorie'] = { select: { name: data.categorie } };
  if (data?.contact !== undefined) props['Contact principal'] = { rich_text: [{ text: { content: data.contact || '' } }] };
  if (data?.methodeContact && ['WhatsApp', 'Email'].includes(data.methodeContact)) {
    props['Méthode contact'] = { select: { name: data.methodeContact } };
  }
  const tel = data?.telephone || data?.whatsapp || '';
  if (tel) props['WhatsApp'] = { phone_number: tel };
  const email = data?.email || '';
  if (email) props['Email'] = { email };
  return props;
}

async function listSuppliers({ fournisseursDbId, notion }) {
  const pages = await notion.queryDatabase(fournisseursDbId, null, null, 200);
  return pages.map(mapPage);
}

async function createSupplier(data, { fournisseursDbId, notion }) {
  const properties = buildSupplierProperties(data);
  const page = await notion.createPage(fournisseursDbId, properties);
  return { id: page.id, item: mapPage({ id: page.id, properties: page.properties }) };
}

async function updateSupplier(id, data, { notion }) {
  if (!id) throw new Error('id required');
  await notion.updatePage(id, buildSupplierProperties(data));
  return { success: true };
}

async function archiveSupplier(id, { notion }) {
  if (!id) throw new Error('id required');
  await notion.archivePage(id);
  return { success: true };
}

module.exports = { mapPage, buildSupplierProperties, listSuppliers, createSupplier, updateSupplier, archiveSupplier };
