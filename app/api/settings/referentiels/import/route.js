import { corsHeaders, notionFetch, queryDatabase, createPage } from "../../../_notion";

const INGREDIENTS_DB    = "3699512cf66a808fb9fdf39666926abb";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST() {
  try {
    // 1. Lire le schéma pour récupérer les options des selects
    const dbRes = await notionFetch(`/databases/${INGREDIENTS_DB}`);
    if (!dbRes.ok) throw new Error(`Notion databases GET failed: ${dbRes.status}`);
    const db = await dbRes.json();

    const categorieOptions    = db.properties["Categorie"]?.select?.options?.map((o) => o.name) || [];
    const sousCategorieOptions = db.properties["Sous-categorie"]?.select?.options?.map((o) => o.name) || [];
    const zoneOptions          = db.properties["Zone_stockage"]?.select?.options?.map((o) => o.name) || [];
    const uniteOptions         = [
      ...new Set([
        ...(db.properties["Unite_stock"]?.select?.options?.map((o) => o.name) || []),
        ...(db.properties["Unite_commande"]?.select?.options?.map((o) => o.name) || []),
      ]),
    ];

    console.log("[import] options lues — cats:", categorieOptions.length, "sous:", sousCategorieOptions.length, "zones:", zoneOptions.length, "unites:", uniteOptions.length);

    // 2. Lire les référentiels existants pour éviter les doublons
    const [existCats, existSousCats, existZones, existUnites] = await Promise.all([
      queryDatabase(process.env.NOTION_CATEGORIES_DB_ID,     null, null, 200),
      queryDatabase(process.env.NOTION_SOUSCATEGORIES_DB_ID, null, null, 200),
      queryDatabase(process.env.NOTION_ZONES_DB_ID,          null, null, 200),
      queryDatabase(process.env.NOTION_UNITES_DB_ID,         null, null, 200),
    ]);

    const existingNames = (pages) =>
      new Set(pages.map((p) => (p.properties.Nom?.title?.[0]?.plain_text || "").trim().toLowerCase()));

    const eCats      = existingNames(existCats);
    const eSousCats  = existingNames(existSousCats);
    const eZones     = existingNames(existZones);
    const eUnites    = existingNames(existUnites);

    // 3. Filtrer les entrées manquantes
    const toCreate = {
      categories:     categorieOptions.filter((n) => n && !eCats.has(n.trim().toLowerCase())),
      sousCategories: sousCategorieOptions.filter((n) => n && !eSousCats.has(n.trim().toLowerCase())),
      zones:          zoneOptions.filter((n) => n && !eZones.has(n.trim().toLowerCase())),
      unites:         uniteOptions.filter((n) => n && !eUnites.has(n.trim().toLowerCase())),
    };

    console.log("[import] à créer — cats:", toCreate.categories, "sous:", toCreate.sousCategories.length, "zones:", toCreate.zones.length, "unites:", toCreate.unites.length);

    // 4. Créer séquentiellement par batch avec pause pour le rate limit Notion
    const createBatch = async (dbId, items, buildProps) => {
      for (const nom of items) {
        await createPage(dbId, buildProps(nom));
        await new Promise((r) => setTimeout(r, 350));
      }
    };

    await Promise.all([
      createBatch(process.env.NOTION_CATEGORIES_DB_ID, toCreate.categories, (nom) => ({
        Nom:   { title:     [{ text: { content: nom } }] },
        Emoji: { rich_text: [{ text: { content: "" } }] },
        Ordre: { number: 99 },
        Actif: { checkbox: true },
      })),
      createBatch(process.env.NOTION_SOUSCATEGORIES_DB_ID, toCreate.sousCategories, (nom) => ({
        Nom:       { title:     [{ text: { content: nom } }] },
        Categorie: { rich_text: [{ text: { content: "" } }] },
        Ordre:     { number: 99 },
        Actif:     { checkbox: true },
      })),
      createBatch(process.env.NOTION_ZONES_DB_ID, toCreate.zones, (nom) => ({
        Nom:   { title:     [{ text: { content: nom } }] },
        Emoji: { rich_text: [{ text: { content: "" } }] },
        Actif: { checkbox: true },
      })),
      createBatch(process.env.NOTION_UNITES_DB_ID, toCreate.unites, (nom) => ({
        Nom:         { title:     [{ text: { content: nom } }] },
        Abreviation: { rich_text: [{ text: { content: nom } }] },
        Actif:       { checkbox: true },
      })),
    ]);

    return Response.json({
      success: true,
      imported: {
        categories:     toCreate.categories.length,
        sousCategories: toCreate.sousCategories.length,
        zones:          toCreate.zones.length,
        unites:         toCreate.unites.length,
      },
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[import referentiels] erreur:", err);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
