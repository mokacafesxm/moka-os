const NOTION_BASE = "https://api.notion.com/v1";

export const DB = {
  STAFF:        "36b9512c-f66a-8069-b4b3-f0dcf9752892",
  POINTAGES:    "36d9512c-f66a-80e0-b73b-cf0a07e47e35",
  INGREDIENTS:  "3699512c-f66a-808f-b9fd-f39666926abb",
  STOCK:        "3689512c-f66a-80aa-8c43-eb4f85347f8e",
  PREPS:        "3689512c-f66a-80a1-a067-c2a0288d2cb9",
  BESOINS:      "3689512c-f66a-80dc-a439-f3955cc30001",
  FOURNISSEURS: "3689512c-f66a-805e-8330-fe73f781d1a5",
  // Catalogue /commander (importé depuis Shopify — voir migration-shopify/)
  WEBSITE_PRODUCTS:  "3929512c-f66a-816b-88d4-d29604b3ef54",
  CATEGORIES_WEBSITE: "3929512c-f66a-81d9-ace3-e387b4c4a16f",
  PROMOS:             "3929512c-f66a-813c-af85-c34263c0eea7",
  COMMANDES_CLIENTS:  "3939512c-f66a-8136-a28c-f16c3d92a7f6",
  ROUE_CHANCE:        "3949512c-f66a-81dc-89fc-f4f493e4c846",
  CLIENTS:            "3959512c-f66a-81ea-be0f-f614915dbdd1",
  SPINS_ANONYMES:     "3959512c-f66a-8105-a0f8-f068f1f58df0",
  CARTES_ENREGISTREES: "3959512c-f66a-811c-bdb8-f9b714eb6545",
};

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };
}

// Notion enforces ~3 req/s per integration and answers 429 when exceeded — a
// real risk during `next build`, where several DB queries fire at once. A 429
// means the request was *rejected*, never processed, so retrying is always safe
// even for POST/PATCH mutations (unlike 5xx, which we deliberately don't retry).
// Notion's guidance: wait and retry rather than fail. Honor Retry-After, else
// exponential backoff with jitter.
const NOTION_MAX_RETRIES = 5;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function notionFetch(path, options = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${NOTION_BASE}${path}`, {
      ...options,
      headers: { ...notionHeaders(), ...(options.headers || {}) },
    });

    if (res.status !== 429 || attempt >= NOTION_MAX_RETRIES) return res;

    const retryAfter = Number(res.headers.get("retry-after"));
    const backoffMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(1000 * 2 ** attempt, 15000);
    const waitMs = backoffMs + Math.floor(Math.random() * 250);
    // Drain the body so the socket is released before we wait/retry.
    await res.arrayBuffer().catch(() => {});
    console.warn(`[notion] 429 on ${path} — retry ${attempt + 1}/${NOTION_MAX_RETRIES} in ${waitMs}ms`);
    await sleep(waitMs);
  }
}

export async function queryDatabase(dbId, filter, sorts, pageSize = 100, fetchOptions) {
  const allPages = [];
  let cursor = undefined;

  do {
    const body = { page_size: pageSize };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (cursor) body.start_cursor = cursor;

    const res = await notionFetch(`/databases/${dbId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
      ...fetchOptions,
    });
    if (!res.ok) throw new Error(`Notion query ${dbId} failed: ${res.status}`);
    const data = await res.json();

    allPages.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return allPages;
}

export async function getPage(pageId) {
  const res = await notionFetch(`/pages/${pageId}`);
  if (!res.ok) throw new Error(`Notion getPage ${pageId} failed: ${res.status}`);
  return res.json();
}

export async function createPage(dbId, properties) {
  const res = await notionFetch("/pages", {
    method: "POST",
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  if (!res.ok) throw new Error(`Notion create failed: ${res.status}`);
  return res.json();
}

export async function updatePage(pageId, properties) {
  const res = await notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Notion update ${pageId} failed: ${res.status}`, body);
    throw new Error(`Notion update ${pageId} failed: ${res.status} — ${body.slice(0, 300)}`);
  }
  return res.json();
}

export async function archivePage(pageId) {
  const res = await notionFetch(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
  if (!res.ok) throw new Error(`Notion archive ${pageId} failed: ${res.status}`);
  return res.json();
}

// Find a page in dbId where titleProp exactly equals name; returns page id or null
export async function resolveName(dbId, titleProp, name) {
  if (!name) return null;
  const results = await queryDatabase(dbId, {
    property: titleProp,
    title: { equals: name },
  }, null, 1);
  return results[0]?.id || null;
}

// ── Property extractors ──────────────────────────────────────────────────────

export function getTitle(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (!p) continue;
    if (p.type === "title" && p.title?.length) return (p.title[0].plain_text || "").trim();
    if (p.type === "rich_text" && p.rich_text?.length) return (p.rich_text[0].plain_text || "").trim();
  }
  return "";
}

export function getText(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (!p) continue;
    if (p.type === "rich_text" && p.rich_text?.length) return (p.rich_text[0].plain_text || "").trim();
    if (p.type === "title" && p.title?.length) return (p.title[0].plain_text || "").trim();
    if (p.type === "email") return (p.email || "").trim();
    if (p.type === "phone_number") return (p.phone_number || "").trim();
    if (p.type === "url") return (p.url || "").trim();
  }
  return "";
}

export function getFormula(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === "formula") {
      const f = p.formula;
      if (f?.string !== undefined && f.string !== null) return String(f.string).trim();
      if (f?.number !== undefined && f.number !== null) return f.number;
      if (f?.boolean !== undefined && f.boolean !== null) return f.boolean;
      if (f?.date?.start) return f.date.start;
    }
  }
  return "";
}

export function getSelect(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === "select" && p.select?.name) return p.select.name.trim();
    if (p?.type === "formula") return (p.formula?.string || "").trim();
  }
  return "";
}

export function getNumber(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === "number" && p.number !== null && p.number !== undefined) return p.number;
    if (p?.type === "formula" && p.formula?.number !== undefined) return p.formula.number;
  }
  return 0;
}

export function getCheckbox(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === "checkbox") return !!p.checkbox;
    if (p?.type === "formula") return !!p.formula?.boolean;
  }
  return false;
}

export function getDate(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === "date" && p.date?.start) return p.date.start;
  }
  return null;
}

export function getMultiSelect(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === "multi_select" && p.multi_select?.length) return p.multi_select.map((o) => o.name);
  }
  return [];
}

export function getFileUrl(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    const file = p?.type === "files" ? p.files?.[0] : null;
    if (file) return file.file?.url || file.external?.url || "";
  }
  return "";
}

export function getRelationIds(props, ...keys) {
  for (const k of keys) {
    const p = props?.[k];
    if (p?.type === "relation" && p.relation?.length) return p.relation.map((r) => r.id);
  }
  return [];
}

// ── Property builders ────────────────────────────────────────────────────────

export const titleProp  = (v) => ({ title:     [{ text: { content: String(v ?? "") } }] });
export const textProp   = (v) => ({ rich_text: [{ text: { content: String(v ?? "") } }] });
export const selectProp = (v) => (v ? { select: { name: String(v) } } : { select: null });
export const numberProp = (v) => ({ number: v !== undefined && v !== null && v !== "" ? Number(v) : null });
export const checkboxProp = (v) => ({ checkbox: Boolean(v) });
export const dateProp   = (v) => (v ? { date: { start: v } } : { date: null });
export const relationProp = (...ids) => ({ relation: ids.filter(Boolean).map((id) => ({ id })) });
