'use strict';

// Canonical writer for STAFF — Architecture cleanup Phase 1. Consolidates
// app/api/settings/staff (the only implementation actually reachable from
// the live UI) and the dead resource=staff branch inside app/api/settings
// (which assumed a WRONG schema — "Rôle" as a select and "Téléphone" as
// rich_text — and would have failed with a Notion 400 if it had ever been
// invoked for real; this module uses the real, confirmed-by-introspection
// schema below, so that dead branch is now not just delegated but actually
// correct too).
//
// Real schema (per the original route's own comment, confirmed live):
//   Nom (title, required), Prénom (rich_text), Rôle (rich_text — not a
//   select), Téléphone (phone_number), Email (email), Actif (checkbox).

function mapPage(page) {
  const p = page.properties;
  const prenom = p['Prénom']?.rich_text?.[0]?.plain_text || '';
  const nom = p['Nom']?.title?.[0]?.plain_text || '';
  const display = prenom || nom;
  return {
    id: page.id,
    nom: display,
    name: display,
    prenom,
    role: p['Rôle']?.rich_text?.[0]?.plain_text || '',
    categorie: p['Rôle']?.rich_text?.[0]?.plain_text || '',
    telephone: p['Téléphone']?.phone_number || '',
    email: p['Email']?.email || '',
    actif: p['Actif']?.checkbox ?? true,
  };
}

function buildStaffProperties(data) {
  const prenom = data?.nom || data?.name || data?.prenom || '';
  const props = {
    Nom: { title: [{ text: { content: prenom } }] },
    Prénom: { rich_text: [{ text: { content: prenom } }] },
    Rôle: { rich_text: [{ text: { content: data?.categorie || data?.role || '' } }] },
    Actif: { checkbox: data?.actif !== false },
  };
  const tel = data?.telephone || '';
  const email = data?.email || '';
  if (tel) props['Téléphone'] = { phone_number: tel };
  if (email) props['Email'] = { email };
  return props;
}

async function listStaff({ staffDbId, notion }) {
  const pages = await notion.queryDatabase(staffDbId, null, null, 200);
  return pages.map(mapPage);
}

async function createStaff(data, { staffDbId, notion }) {
  const properties = buildStaffProperties(data);
  const page = await notion.createPage(staffDbId, properties);
  return { id: page.id, item: mapPage({ id: page.id, properties: page.properties }) };
}

async function updateStaff(id, data, { notion }) {
  if (!id) throw new Error('id required');
  await notion.updatePage(id, buildStaffProperties(data));
  return { success: true };
}

/** Real archive (page removed from active views) — matches the live route's DELETE, not the dead generic route's soft "Actif=false" disable. */
async function archiveStaff(id, { notion }) {
  if (!id) throw new Error('id required');
  await notion.archivePage(id);
  return { success: true };
}

module.exports = { mapPage, buildStaffProperties, listStaff, createStaff, updateStaff, archiveStaff };
