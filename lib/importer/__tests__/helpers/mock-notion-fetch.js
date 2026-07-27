'use strict';

/**
 * In-memory fake Notion REST API for tests (PR4) — no real Notion API
 * call is ever made through this helper. Supports exactly the endpoints
 * lib/importer/notion/notion-client.js uses: GET /databases/{id},
 * POST /databases/{id}/query, POST /pages, PATCH /pages/{id}.
 *
 * Property values are stored/returned in the same "read shape" (with a
 * `type` discriminant) that the real Notion API returns, converted from
 * whatever "write shape" (titleProp/textProp/etc. — see notion-client.js)
 * a create/update call sent — mirroring what Notion itself does.
 */

/**
 * @param {Record<string, object>} writeProps - e.g. { Name: { title: [...] }, ... }
 * @returns {Record<string, object>} the same properties with a `type` field added, as Notion would return them
 */
function toReadShape(writeProps) {
  const out = {};
  for (const [key, val] of Object.entries(writeProps)) {
    if ('title' in val) out[key] = { type: 'title', title: val.title.map((t) => ({ plain_text: t.text.content })) };
    else if ('rich_text' in val)
      out[key] = { type: 'rich_text', rich_text: val.rich_text.map((t) => ({ plain_text: t.text.content })) };
    else if ('select' in val) out[key] = { type: 'select', select: val.select ? { name: val.select.name } : null };
    else if ('number' in val) out[key] = { type: 'number', number: val.number };
    else if ('date' in val) out[key] = { type: 'date', date: val.date ? { start: val.date.start } : null };
    else if ('relation' in val) out[key] = { type: 'relation', relation: val.relation };
    else out[key] = val;
  }
  return out;
}

/**
 * @param {{schemas?: Record<string, Record<string, {type: string}>>}} [options]
 *   `schemas`: dbId -> Notion-shaped properties map, returned by GET /databases/{id}.
 * @returns {{
 *   fetch: typeof fetch,
 *   calls: {url: string, method: string, body: object|null}[],
 *   pages: Map<string, {id: string, properties: object}>,
 *   seedPage: (dbId: string, properties: object) => {id: string, properties: object},
 *   queueResponse: (matcher: (url: string, opts: object) => boolean, response: object) => void,
 * }}
 */
function createMockNotion({ schemas = {} } = {}) {
  const pages = new Map();
  const calls = [];
  let idCounter = 0;
  /** @type {{matcher: Function, response: object, remaining: number}[]} */
  const queuedResponses = [];

  /** Registers a one-time (or N-time) response override for requests matching `matcher`, e.g. to simulate a 429 or a 500. */
  function queueResponse(matcher, response, times = 1) {
    queuedResponses.push({ matcher, response, remaining: times });
  }

  /** Directly inserts a page into the fake database, bypassing createPage — useful for pre-seeding "already committed" state. */
  function seedPage(dbId, properties) {
    idCounter += 1;
    const id = `page-${idCounter}`;
    const page = { id, dbId, properties: toReadShape(properties) };
    pages.set(id, page);
    return page;
  }

  async function fetchImpl(url, opts = {}) {
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url, method, body });

    for (const queued of queuedResponses) {
      if (queued.remaining > 0 && queued.matcher(url, opts)) {
        queued.remaining -= 1;
        return queued.response;
      }
    }

    if (method === 'GET' && url.includes('/databases/') && !url.includes('/query')) {
      const dbId = url.split('/databases/')[1];
      const properties = schemas[dbId];
      if (!properties) {
        return { ok: false, status: 404, text: async () => 'Not Found', headers: new Map() };
      }
      return { ok: true, status: 200, json: async () => ({ id: dbId, properties }) };
    }

    if (method === 'POST' && url.includes('/query')) {
      const dbId = url.split('/databases/')[1].split('/query')[0];
      const filter = body?.filter;
      let results = Array.from(pages.values()).filter((p) => p.dbId === dbId);
      if (filter?.property && filter?.rich_text?.equals !== undefined) {
        const prop = filter.property;
        const wanted = filter.rich_text.equals;
        results = results.filter((p) => {
          const v = p.properties?.[prop];
          return v?.type === 'rich_text' && v.rich_text?.[0]?.plain_text === wanted;
        });
      }
      return { ok: true, status: 200, json: async () => ({ results: results.slice(0, 100) }) };
    }

    if (method === 'POST' && url.endsWith('/pages')) {
      const dbId = body?.parent?.database_id;
      idCounter += 1;
      const id = `page-${idCounter}`;
      const readProps = toReadShape(body.properties);
      pages.set(id, { id, dbId, properties: readProps });
      return { ok: true, status: 200, json: async () => ({ id, properties: readProps }) };
    }

    if (method === 'PATCH' && url.includes('/pages/')) {
      const id = url.split('/pages/')[1];
      const existing = pages.get(id) || { id, properties: {} };
      existing.properties = { ...existing.properties, ...toReadShape(body.properties) };
      pages.set(id, existing);
      return { ok: true, status: 200, json: async () => existing };
    }

    throw new Error(`mock-notion-fetch: unhandled request ${method} ${url}`);
  }

  return { fetch: fetchImpl, calls, pages, seedPage, queueResponse };
}

module.exports = { createMockNotion, toReadShape };
