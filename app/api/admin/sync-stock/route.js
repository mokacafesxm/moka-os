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

const queryDatabase = async (dbId, pageSize = 300) => {
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

const createStockEntry = async (page) => {
  const name = page.properties?.Ingredient?.title?.[0]?.plain_text || "";
  if (!name) return null;
  const unite = page.properties?.Unite_stock?.select?.name || "";
  const properties = {
    Produit: { title: [{ text: { content: name } }] },
    Quantite_stock: { number: 0 },
    MOKA_Ingredients_Master: { relation: [{ id: page.id }] },
  };
  if (unite) properties.Unite_stock = { select: { name: unite } };
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify({ parent: { database_id: STOCK_DB }, properties }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Notion ${res.status}`);
  return name;
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// GET → load both DBs in parallel, identify missing entries by relation ID,
//        create them in batches of 5.
export async function GET() {
  try {
    const [ingredientPages, stockPages] = await Promise.all([
      queryDatabase(INGREDIENTS_DB),
      queryDatabase(STOCK_DB),
    ]);

    // Set of ingredient IDs already linked to a stock entry via relation
    const linkedIngredientIds = new Set();
    for (const page of stockPages) {
      const rel = page.properties?.MOKA_Ingredients_Master?.relation || [];
      if (rel[0]?.id) linkedIngredientIds.add(rel[0].id);
    }

    const missing = ingredientPages.filter(p => !linkedIngredientIds.has(p.id));

    const created = [];
    const errors = [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(createStockEntry));
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) created.push(r.value);
        else if (r.status === "rejected") errors.push(r.reason?.message || "erreur inconnue");
      }
      // Rate-limit pause between batches only (not after last batch)
      if (i + BATCH_SIZE < missing.length) {
        await new Promise(r => setTimeout(r, 400));
      }
    }

    return Response.json({
      success: true,
      createdCount: created.length,
      alreadyExistCount: ingredientPages.length - missing.length,
      errorCount: errors.length,
      created,
      errors,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[sync-stock]", err);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
