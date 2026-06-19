import { corsHeaders } from "../../../_notion";

const NOTION_KEY = () => process.env.NOTION_API_KEY;
const NOTION_VER = "2022-06-28";
const notionHeaders = () => ({
  "Authorization": `Bearer ${NOTION_KEY()}`,
  "Notion-Version": NOTION_VER,
  "Content-Type": "application/json",
});

const INGREDIENTS_DB = "3699512cf66a808fb9fdf39666926abb";
const DB = {
  categories:     "0a29512cf66a83ceb71c81efada3e727",
  sousCategories: "b779512cf66a82e982f2014644271ff3",
  zones:          "f599512cf66a83989b38015c1e7ef19a",
  unites:         "1779512cf66a82e7afa38148234b9d33",
};

async function readExisting(dbId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify({ page_size: 200 }),
  });
  const data = await res.json();
  return (data.results || []).map((p) => p.properties.Nom?.title?.[0]?.plain_text || "").filter(Boolean);
}

async function createEntry(dbId, props) {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify({ parent: { database_id: dbId }, properties: props }),
  });
  const data = await res.json();
  if (!res.ok) console.error("[import] createEntry failed:", data.message);
  await new Promise((r) => setTimeout(r, 350));
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST() {
  try {
    // 1. Lire le schéma de MOKA_Ingredients_Master
    const schemaRes = await fetch(`https://api.notion.com/v1/databases/${INGREDIENTS_DB}`, {
      headers: notionHeaders(),
    });
    if (!schemaRes.ok) throw new Error(`Schema fetch failed: ${schemaRes.status}`);
    const schema = await schemaRes.json();

    const categorieOptions   = schema.properties["Categorie"]?.select?.options?.map((o) => o.name).filter(Boolean) || [];
    const sousCatOptions     = schema.properties["Sous-categorie"]?.select?.options?.map((o) => o.name).filter(Boolean) || [];
    const zoneOptions        = schema.properties["Zone_stockage"]?.select?.options?.map((o) => o.name).filter(Boolean) || [];
    const uniteStockOptions  = schema.properties["Unite_stock"]?.select?.options?.map((o) => o.name).filter(Boolean) || [];
    const uniteCmdOptions    = schema.properties["Unite_commande"]?.select?.options?.map((o) => o.name).filter(Boolean) || [];
    const uniteOptions       = [...new Set([...uniteStockOptions, ...uniteCmdOptions])];

    console.log("[import] lus — cats:", categorieOptions.length, "sous:", sousCatOptions.length, "zones:", zoneOptions.length, "unites:", uniteOptions.length);

    // 2. Lire les entrées existantes dans chaque base
    const [existingCats, existingSousCats, existingZones, existingUnites] = await Promise.all([
      readExisting(DB.categories),
      readExisting(DB.sousCategories),
      readExisting(DB.zones),
      readExisting(DB.unites),
    ]);

    const toCreate = {
      categories:     categorieOptions.filter((n) => !existingCats.includes(n)),
      sousCategories: sousCatOptions.filter((n) => !existingSousCats.includes(n)),
      zones:          zoneOptions.filter((n) => !existingZones.includes(n)),
      unites:         uniteOptions.filter((n) => !existingUnites.includes(n)),
    };

    console.log("[import] à créer — cats:", toCreate.categories.length, "sous:", toCreate.sousCategories.length, "zones:", toCreate.zones.length, "unites:", toCreate.unites.length);

    // 3. Créer séquentiellement pour respecter le rate limit Notion
    for (const nom of toCreate.categories) {
      await createEntry(DB.categories, {
        Nom:   { title:     [{ text: { content: nom } }] },
        Emoji: { rich_text: [{ text: { content: "" } }] },
        Ordre: { number: 99 },
        Actif: { checkbox: true },
      });
    }
    for (const nom of toCreate.sousCategories) {
      await createEntry(DB.sousCategories, {
        Nom:       { title:     [{ text: { content: nom } }] },
        Categorie: { rich_text: [{ text: { content: "" } }] },
        Ordre:     { number: 99 },
        Actif:     { checkbox: true },
      });
    }
    for (const nom of toCreate.zones) {
      await createEntry(DB.zones, {
        Nom:   { title:     [{ text: { content: nom } }] },
        Emoji: { rich_text: [{ text: { content: "" } }] },
        Actif: { checkbox: true },
      });
    }
    for (const nom of toCreate.unites) {
      await createEntry(DB.unites, {
        Nom:         { title:     [{ text: { content: nom } }] },
        Abreviation: { rich_text: [{ text: { content: nom } }] },
        Actif:       { checkbox: true },
      });
    }

    return Response.json({
      success: true,
      imported: {
        categories:     toCreate.categories.length,
        sousCategories: toCreate.sousCategories.length,
        zones:          toCreate.zones.length,
        unites:         toCreate.unites.length,
      },
      detail: toCreate,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[import referentiels]", err);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
