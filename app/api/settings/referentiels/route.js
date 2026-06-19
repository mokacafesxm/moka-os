import { corsHeaders, notionFetch } from "../../_notion";

const NOTION_KEY = () => process.env.NOTION_API_KEY;
const NOTION_VER = "2022-06-28";
const notionHeaders = () => ({
  "Authorization": `Bearer ${NOTION_KEY()}`,
  "Notion-Version": NOTION_VER,
  "Content-Type": "application/json",
});

const DB = {
  categories:     "0a29512cf66a83ceb71c81efada3e727",
  sousCategories: "b779512cf66a82e982f2014644271ff3",
  unites:         "1779512cf66a82e7afa38148234b9d33",
  zones:          "f599512cf66a83989b38015c1e7ef19a",
};

async function queryAll(dbId) {
  const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
    method: "POST",
    headers: notionHeaders(),
    body: JSON.stringify({ page_size: 200 }),
  });
  if (!res.ok) throw new Error(`Notion query ${dbId}: ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const [cats, sousCats, unites, zones] = await Promise.all([
      queryAll(DB.categories),
      queryAll(DB.sousCategories),
      queryAll(DB.unites),
      queryAll(DB.zones),
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
    const body = await req.json();
    const { type, nom, emoji, abreviation, categorie, uniteType, temperature, ordre } = body;

    if (!DB[type]) return Response.json({ error: "Type inconnu" }, { status: 400, headers: corsHeaders });
    if (!nom?.trim()) return Response.json({ error: "Nom requis" }, { status: 400, headers: corsHeaders });

    const propsMap = {
      categories: {
        Nom:   { title:     [{ text: { content: nom.trim() } }] },
        Emoji: { rich_text: [{ text: { content: emoji?.trim() || "" } }] },
        Ordre: { number: Number(ordre) || 99 },
        Actif: { checkbox: true },
      },
      sousCategories: {
        Nom:       { title:     [{ text: { content: nom.trim() } }] },
        Categorie: { rich_text: [{ text: { content: categorie?.trim() || "" } }] },
        Ordre:     { number: Number(ordre) || 99 },
        Actif:     { checkbox: true },
      },
      unites: {
        Nom:         { title:     [{ text: { content: nom.trim() } }] },
        Abreviation: { rich_text: [{ text: { content: abreviation?.trim() || nom.trim() } }] },
        Actif:       { checkbox: true },
        ...(uniteType ? { Type: { select: { name: uniteType } } } : {}),
      },
      zones: {
        Nom:   { title:     [{ text: { content: nom.trim() } }] },
        Emoji: { rich_text: [{ text: { content: emoji?.trim() || "" } }] },
        Actif: { checkbox: true },
        ...(temperature ? { Temperature: { select: { name: temperature } } } : {}),
      },
    };

    console.log("[POST referentiel]", type, JSON.stringify(propsMap[type]));

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: DB[type] },
        properties: propsMap[type],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[POST referentiel] Erreur Notion:", JSON.stringify(data));
      return Response.json({ error: data.message || "Erreur Notion" }, { status: 500, headers: corsHeaders });
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST referentiel] Exception:", err);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    const res = await notionFetch(`/pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    if (!res.ok) throw new Error(`Notion archive ${id}: ${res.status}`);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("Erreur DELETE referentiel:", err);
    return Response.json({ success: false }, { status: 500, headers: corsHeaders });
  }
}
