const NOTION_VERSION = process.env.NOTION_VERSION || "2022-06-28";

function token() {
  return process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
}

function headers() {
  const t = token();
  if (!t) throw new Error("NOTION_TOKEN manquant");
  return {
    Authorization: `Bearer ${t}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function getDatabase(dbId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
    headers: headers(),
  });
  const data = await res.json();
  if (data.object === "error") throw new Error(`Notion error: ${data.message}`);
  return data;
}

async function queryAll(dbId) {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.object === "error") throw new Error(`Notion error: ${data.message}`);
    pages.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

async function createPage(dbId, properties) {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  return res.json();
}

async function updatePage(pageId, properties) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ properties }),
  });
  return res.json();
}

function chunkText(str, size = 1999) {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) chunks.push(str.slice(i, i + size));
  return chunks.length ? chunks : [""];
}

function richText(str) {
  return chunkText(String(str ?? "")).map((chunk) => ({ text: { content: chunk } }));
}

// Builds a Notion property value adapted to the property's actual type,
// so the mapping config only needs to name the property, not guess its shape.
function buildPropertyValue(type, value) {
  if (value === null || value === undefined) return undefined;

  switch (type) {
    case "title":
      return { title: richText(value) };
    case "rich_text":
      return { rich_text: richText(value) };
    case "number": {
      const n = typeof value === "number" ? value : parseFloat(value);
      return Number.isFinite(n) ? { number: n } : undefined;
    }
    case "checkbox":
      return { checkbox: Boolean(value) };
    case "url":
      return { url: String(value) };
    case "select":
      return { select: { name: String(value) } };
    case "multi_select": {
      const values = Array.isArray(value) ? value : [value];
      return { multi_select: values.filter(Boolean).map((name) => ({ name: String(name) })) };
    }
    case "files":
      return {
        files: [
          {
            type: "external",
            name: "photo",
            external: { url: String(value) },
          },
        ],
      };
    case "date":
      return { date: { start: String(value) } };
    default:
      return undefined;
  }
}

function getPropertyType(schema, propName) {
  return schema.properties?.[propName]?.type;
}

module.exports = {
  getDatabase,
  queryAll,
  createPage,
  updatePage,
  richText,
  chunkText,
  buildPropertyValue,
  getPropertyType,
};
