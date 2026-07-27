'use strict';

// In-memory fake of the app/api/_notion.js CRUD/query surface used by lib/ops
// and lib/stock services. Never touches the network.

function normalizeProperty(raw) {
  if (raw == null) return raw;
  if ('number' in raw) return { type: 'number', number: raw.number };
  if ('rich_text' in raw) {
    return { type: 'rich_text', rich_text: raw.rich_text.map((t) => ({ plain_text: t.text?.content ?? '', text: t.text })) };
  }
  if ('title' in raw) {
    return { type: 'title', title: raw.title.map((t) => ({ plain_text: t.text?.content ?? '', text: t.text })) };
  }
  if ('select' in raw) return { type: 'select', select: raw.select };
  if ('relation' in raw) return { type: 'relation', relation: raw.relation };
  if ('checkbox' in raw) return { type: 'checkbox', checkbox: raw.checkbox };
  if ('date' in raw) return { type: 'date', date: raw.date };
  if ('phone_number' in raw) return { type: 'phone_number', phone_number: raw.phone_number };
  if ('email' in raw) return { type: 'email', email: raw.email };
  return raw;
}

function normalizeProperties(rawProperties) {
  const out = {};
  for (const [key, value] of Object.entries(rawProperties || {})) out[key] = normalizeProperty(value);
  return out;
}

function createFakeNotion(seedPages = {}) {
  const pages = new Map();
  for (const [id, page] of Object.entries(seedPages)) {
    pages.set(id, { id, dbId: page.dbId, properties: normalizeProperties(page.properties || {}) });
  }
  let counter = 0;
  const calls = { getPage: 0, updatePage: 0, createPage: 0, resolveName: 0, queryDatabase: 0, archivePage: 0 };

  async function getPage(id) {
    calls.getPage += 1;
    const page = pages.get(id);
    if (!page) throw new Error(`fake notion: page not found ${id}`);
    return JSON.parse(JSON.stringify(page));
  }

  async function updatePage(id, properties) {
    calls.updatePage += 1;
    const page = pages.get(id);
    if (!page) throw new Error(`fake notion: page not found ${id}`);
    page.properties = { ...page.properties, ...normalizeProperties(properties) };
    return JSON.parse(JSON.stringify(page));
  }

  async function createPage(dbId, properties) {
    calls.createPage += 1;
    counter += 1;
    const id = `fake-${dbId}-${counter}`;
    const page = { id, dbId, properties: normalizeProperties(properties) };
    pages.set(id, page);
    return JSON.parse(JSON.stringify(page));
  }

  async function resolveName(dbId, titleProp, name) {
    calls.resolveName += 1;
    const target = String(name).trim().toLowerCase();
    for (const page of pages.values()) {
      if (page.dbId && page.dbId !== dbId) continue;
      const prop = page.properties?.[titleProp];
      const title = prop?.title?.[0]?.plain_text;
      if (title && String(title).trim().toLowerCase() === target) return page.id;
    }
    return null;
  }

  async function queryDatabase(dbId) {
    calls.queryDatabase += 1;
    return Array.from(pages.values())
      .filter((p) => !p.dbId || p.dbId === dbId)
      .map((p) => JSON.parse(JSON.stringify(p)));
  }

  async function archivePage(id) {
    calls.archivePage += 1;
    const page = pages.get(id);
    if (!page) throw new Error(`fake notion: page not found ${id}`);
    page.archived = true;
    return JSON.parse(JSON.stringify(page));
  }

  return { getPage, updatePage, createPage, resolveName, queryDatabase, archivePage, _pages: pages, _calls: calls };
}

module.exports = { createFakeNotion };
