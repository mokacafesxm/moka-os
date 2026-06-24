const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_VERSION = "2022-06-28";
const INGREDIENTS_DB = "3699512cf66a808fb9fdf39666926abb";
const STOCK_DB = "3689512cf66a80aa8c43eb4f85347f8e";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const notionHeaders = () => ({
  Authorization: `Bearer ${NOTION_API_KEY}`,
  "Notion-Version": NOTION_VERSION,
  "Content-Type": "application/json",
});

const queryDatabase = async (dbId, pageSize = 200) => {
  const results = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify({ page_size: pageSize, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    const data = await res.json();
    results.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return results;
};

const createPage = async (dbId, properties) => {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  return res.json();
};

function getTitle(props, key) {
  const p = props?.[key];
  if (!p) return "";
  if (p.type === "title" && p.title?.length) return p.title[0].plain_text || "";
  return "";
}

function getSelect(props, key) {
  const p = props?.[key];
  if (p?.type === "select" && p.select?.name) return p.select.name;
  return "";
}

function getRelationIds(props, key) {
  const p = props?.[key];
  if (p?.type === "relation" && p.relation?.length) return p.relation.map((r) => r.id);
  return [];
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// GET → compares MOKA_Ingredients_Master vs MOKA_Stock_Produits_Notion,
//        creates a stock entry (qty 0) for every ingredient that has none.
export async function GET() {
  try {
    const [ingredientPages, stockPages] = await Promise.all([
      queryDatabase(INGREDIENTS_DB, 300),
      queryDatabase(STOCK_DB, 300),
    ]);

    // Build set of ingredient IDs already linked to a stock entry
    const linkedIngredientIds = new Set();
    for (const page of stockPages) {
      const ids = getRelationIds(page.properties, "MOKA_Ingredients_Master");
      if (ids[0]) linkedIngredientIds.add(ids[0]);
    }

    const created = [];
    const alreadyExist = [];
    const errors = [];

    for (const page of ingredientPages) {
      const name = getTitle(page.properties, "Ingredient");
      if (!name) continue;

      if (linkedIngredientIds.has(page.id)) {
        alreadyExist.push(name);
        continue;
      }

      // Missing — create stock entry with qty 0
      try {
        const unite = getSelect(page.properties, "Unite_stock");
        const properties = {
          Produit: { title: [{ text: { content: name } }] },
          Quantite_stock: { number: 0 },
          MOKA_Ingredients_Master: { relation: [{ id: page.id }] },
        };
        if (unite) properties.Unite_stock = { select: { name: unite } };

        await createPage(STOCK_DB, properties);
        created.push(name);
        console.log("[sync-stock] créé :", name);
      } catch (err) {
        console.error("[sync-stock] erreur pour", name, ":", err.message);
        errors.push({ name, error: err.message });
      }
    }

    return Response.json({
      success: true,
      createdCount: created.length,
      alreadyExistCount: alreadyExist.length,
      errorCount: errors.length,
      created,
      alreadyExist,
      errors,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[sync-stock]", err);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
