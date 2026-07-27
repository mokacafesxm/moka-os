'use strict';

/**
 * Self-contained Notion REST client for the importer's pilotage writes
 * (PR4). Deliberately NOT a re-export of `app/api/_notion.js` — that file
 * uses ESM `export` syntax and is only ever loaded through Next.js's
 * bundler (webpack/SWC), which handles module-format interop transparently.
 * `scripts/import.js` (the CLI) runs under plain `node`, which cannot
 * `require()` ESM-syntax files without either an `engines` pin on a
 * `require(esm)`-capable Node version (this repo has none — confirmed no
 * `engines` field, no `.nvmrc`) or converting `_notion.js` itself to CJS
 * (rejected: that file is the live production Notion integration for 15+
 * Kamo AI routes — out of scope to touch, per explicit PR4 constraints).
 *
 * This module ports the exact same proven numbers and shapes from
 * `app/api/_notion.js` (throttle gap, retry policy, property JSON shapes)
 * rather than reinventing them — see docs/ARCHITECTURE.md "PR4" for the
 * full rationale. The `app/api/imports` route handlers (preflight, commit)
 * also use THIS module (not `_notion.js`) so the importer has exactly one
 * Notion access path regardless of whether it runs via CLI or via the web UI.
 *
 * This client only ever receives pilotage database IDs (resolved via
 * lib/importer/config/pilotage-targets.js) — it has no knowledge of the
 * Kamo AI `DB` map and must never be pointed at it.
 */

const NOTION_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28'; // matches app/api/_notion.js — see docs/ARCHITECTURE.md "PR4" API-version decision

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Same rationale and same number as app/api/_notion.js: Notion allows
// ~3 req/s per integration; gate every outgoing request through a single
// in-process queue spaced ~340ms apart rather than absorb 429s after the
// fact. Per-process gate (CLI: whole run; API route: one invocation).
const NOTION_MIN_GAP_MS = 340;
let notionGate = Promise.resolve();
let notionLastDispatch = 0;
function notionThrottle() {
  notionGate = notionGate.then(async () => {
    const wait = notionLastDispatch + NOTION_MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    notionLastDispatch = Date.now();
  });
  return notionGate;
}

// Same policy as app/api/_notion.js: only 429 is safe to retry (the
// request never processed); 5xx is deliberately never retried. 3 attempts,
// backoff from Retry-After or exponential, capped at 4s, plus jitter.
const NOTION_MAX_RETRIES = 3;

/**
 * @param {string} path - e.g. "/databases/{id}/query"
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
async function notionFetch(path, options = {}) {
  for (let attempt = 0; ; attempt += 1) {
    await notionThrottle();
    const res = await fetch(`${NOTION_BASE}${path}`, {
      ...options,
      headers: { ...notionHeaders(), ...(options.headers || {}) },
    });

    if (res.status !== 429 || attempt >= NOTION_MAX_RETRIES) return res;

    const retryAfter = Number(res.headers.get('retry-after'));
    const backoffMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 4000)
        : Math.min(1000 * 2 ** attempt, 4000);
    const waitMs = backoffMs + Math.floor(Math.random() * 250);
    await res.arrayBuffer().catch(() => {});
    console.warn(`[notion-client] 429 on ${path} — retry ${attempt + 1}/${NOTION_MAX_RETRIES} in ${waitMs}ms`);
    await sleep(waitMs);
  }
}

/**
 * GET /v1/databases/{id} — schema introspection. Not present in
 * app/api/_notion.js (never needed there); required for PR4's read-only
 * schema-check/validation, never used to create or modify anything.
 * @param {string} dbId
 * @returns {Promise<{id: string, title: unknown, properties: Record<string, {type: string, [k: string]: unknown}>}>}
 */
async function getDatabase(dbId) {
  const res = await notionFetch(`/databases/${dbId}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Notion getDatabase ${dbId} failed: ${res.status} — ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * @param {string} dbId
 * @param {object} [filter]
 * @param {object} [sorts]
 * @param {number} [pageSize]
 * @returns {Promise<object[]>} flattened, auto-paginated results
 */
async function queryDatabase(dbId, filter, sorts, pageSize = 100) {
  const allPages = [];
  let cursor;

  do {
    const body = { page_size: pageSize };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (cursor) body.start_cursor = cursor;

    const res = await notionFetch(`/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const responseBody = await res.text().catch(() => '');
      throw new Error(`Notion query ${dbId} failed: ${res.status} — ${responseBody.slice(0, 300)}`);
    }
    const data = await res.json();
    allPages.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return allPages;
}

/** @param {string} pageId */
async function getPage(pageId) {
  const res = await notionFetch(`/pages/${pageId}`);
  if (!res.ok) throw new Error(`Notion getPage ${pageId} failed: ${res.status}`);
  return res.json();
}

/**
 * @param {string} dbId
 * @param {object} properties
 */
async function createPage(dbId, properties) {
  const res = await notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Notion create failed: ${res.status} — ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * @param {string} pageId
 * @param {object} properties
 */
async function updatePage(pageId, properties) {
  const res = await notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[notion-client] update ${pageId} failed: ${res.status}`, body.slice(0, 300));
    throw new Error(`Notion update ${pageId} failed: ${res.status} — ${body.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Finds a page in `dbId` whose `keyProperty` (a rich_text property) exactly
 * equals `keyValue` — the generic analogue of app/api/_notion.js's
 * `resolveName` (which matches on a title property), used here to look up
 * pilotage rows by their deterministic `import_key`.
 * @param {string} dbId
 * @param {string} keyProperty
 * @param {string} keyValue
 * @returns {Promise<{id: string, properties: object}|null>}
 */
async function resolveByKey(dbId, keyProperty, keyValue) {
  if (!keyValue) return null;
  const results = await queryDatabase(
    dbId,
    { property: keyProperty, rich_text: { equals: keyValue } },
    null,
    1
  );
  return results[0] ?? null;
}

// ── Property extractors (only what PR4's skip-if-identical comparison needs) ──

function getTitle(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (!p) continue;
    if (p.type === 'title' && p.title?.length) return (p.title[0].plain_text || '').trim();
  }
  return '';
}

function getText(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (!p) continue;
    if (p.type === 'rich_text' && p.rich_text?.length) return (p.rich_text[0].plain_text || '').trim();
  }
  return '';
}

function getSelect(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === 'select' && p.select?.name) return p.select.name.trim();
  }
  return '';
}

function getNumber(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === 'number' && p.number !== null && p.number !== undefined) return p.number;
  }
  return null;
}

function getDate(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === 'date' && p.date?.start) return p.date.start;
  }
  return null;
}

function getRelationIds(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === 'relation' && p.relation?.length) return p.relation.map((r) => r.id);
  }
  return [];
}

// ── Property builders (identical JSON shapes to app/api/_notion.js) ──────────

const titleProp = (v) => ({ title: [{ text: { content: String(v ?? '') } }] });
const textProp = (v) => ({ rich_text: [{ text: { content: String(v ?? '') } }] });
const selectProp = (v) => (v ? { select: { name: String(v) } } : { select: null });
const numberProp = (v) => ({ number: v !== undefined && v !== null && v !== '' ? Number(v) : null });
const dateProp = (v) => (v ? { date: { start: v } } : { date: null });
const relationProp = (...ids) => ({ relation: ids.filter(Boolean).map((id) => ({ id })) });

module.exports = {
  NOTION_VERSION,
  notionFetch,
  getDatabase,
  queryDatabase,
  getPage,
  createPage,
  updatePage,
  resolveByKey,
  getTitle,
  getText,
  getSelect,
  getNumber,
  getDate,
  getRelationIds,
  titleProp,
  textProp,
  selectProp,
  numberProp,
  dateProp,
  relationProp,
};
