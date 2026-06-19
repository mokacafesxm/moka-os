import { corsHeaders, queryDatabase, createPage, notionFetch } from "../../_notion";

const CATEGORIES_DB     = () => process.env.NOTION_CATEGORIES_DB_ID;
const SOUSCATEGORIES_DB = () => process.env.NOTION_SOUSCATEGORIES_DB_ID;
const UNITES_DB         = () => process.env.NOTION_UNITES_DB_ID;
const ZONES_DB          = () => process.env.NOTION_ZONES_DB_ID;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const [cats, sousCats, unites, zones] = await Promise.all([
      queryDatabase(CATEGORIES_DB(),     null, [{ property: "Ordre", direction: "ascending" }], 200),
      queryDatabase(SOUSCATEGORIES_DB(), null, [{ property: "Ordre", direction: "ascending" }], 200),
      queryDatabase(UNITES_DB(),         null, null, 200),
      queryDatabase(ZONES_DB(),          null, null, 200),
    ]);

    return Response.json({
      categories: cats
        .map((p) => ({
          id: p.id,
          nom: p.properties.Nom?.title?.[0]?.plain_text || "",
          emoji: p.properties.Emoji?.rich_text?.[0]?.plain_text || "",
          ordre: p.properties.Ordre?.number ?? 99,
          actif: p.properties.Actif?.checkbox ?? true,
        }))
        .filter((i) => i.actif && i.nom),

      sousCategories: sousCats
        .map((p) => ({
          id: p.id,
          nom: p.properties.Nom?.title?.[0]?.plain_text || "",
          categorie: p.properties.Categorie?.rich_text?.[0]?.plain_text || "",
          ordre: p.properties.Ordre?.number ?? 99,
          actif: p.properties.Actif?.checkbox ?? true,
        }))
        .filter((i) => i.actif && i.nom),

      unites: unites
        .map((p) => ({
          id: p.id,
          nom: p.properties.Nom?.title?.[0]?.plain_text || "",
          abreviation: p.properties.Abreviation?.rich_text?.[0]?.plain_text || "",
          uniteType: p.properties.Type?.select?.name || "",
          actif: p.properties.Actif?.checkbox ?? true,
        }))
        .filter((i) => i.actif && i.nom),

      zones: zones
        .map((p) => ({
          id: p.id,
          nom: p.properties.Nom?.title?.[0]?.plain_text || "",
          emoji: p.properties.Emoji?.rich_text?.[0]?.plain_text || "",
          temperature: p.properties.Temperature?.select?.name || "",
          actif: p.properties.Actif?.checkbox ?? true,
        }))
        .filter((i) => i.actif && i.nom),
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("Erreur GET referentiels:", err);
    return Response.json({ categories: [], sousCategories: [], unites: [], zones: [] }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const { type, nom, emoji, abreviation, categorie, temperature, uniteType, ordre } = await req.json();

    const dbMap = {
      categories:     CATEGORIES_DB(),
      sousCategories: SOUSCATEGORIES_DB(),
      unites:         UNITES_DB(),
      zones:          ZONES_DB(),
    };

    const propsMap = {
      categories: {
        Nom:   { title:     [{ text: { content: String(nom || "") } }] },
        Emoji: { rich_text: [{ text: { content: String(emoji || "") } }] },
        Ordre: { number: Number(ordre) || 99 },
        Actif: { checkbox: true },
      },
      sousCategories: {
        Nom:       { title:     [{ text: { content: String(nom || "") } }] },
        Categorie: { rich_text: [{ text: { content: String(categorie || "") } }] },
        Ordre:     { number: Number(ordre) || 99 },
        Actif:     { checkbox: true },
      },
      unites: {
        Nom:         { title:     [{ text: { content: String(nom || "") } }] },
        Abreviation: { rich_text: [{ text: { content: String(abreviation || "") } }] },
        Type:        { select: uniteType ? { name: String(uniteType) } : null },
        Actif:       { checkbox: true },
      },
      zones: {
        Nom:         { title:     [{ text: { content: String(nom || "") } }] },
        Emoji:       { rich_text: [{ text: { content: String(emoji || "") } }] },
        Temperature: { select: temperature ? { name: String(temperature) } : null },
        Actif:       { checkbox: true },
      },
    };

    if (!dbMap[type] || !propsMap[type]) {
      return Response.json({ success: false, error: "Type inconnu" }, { status: 400, headers: corsHeaders });
    }

    const props = propsMap[type];
    if (type === "unites"  && !uniteType)   delete props.Type;
    if (type === "zones"   && !temperature) delete props.Temperature;

    console.log("[POST referentiel] type:", type, "props:", JSON.stringify(props));

    await createPage(dbMap[type], props);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("Erreur POST referentiel:", err);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    await notionFetch(`/pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("Erreur DELETE referentiel:", err);
    return Response.json({ success: false }, { status: 500, headers: corsHeaders });
  }
}
