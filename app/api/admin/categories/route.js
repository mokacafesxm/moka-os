import { DB, corsHeaders, queryDatabase, createPage, getTitle, getNumber, getFileUrl, titleProp, numberProp, filesProp } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export function normalizeCategory(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    photo: getFileUrl(p, "Photo"),
    ordre: getNumber(p, "Ordre"),
  };
}

export function buildCategoryProperties(data) {
  const props = {};
  if ("nom" in data) props.Nom = titleProp(data.nom);
  if ("photo" in data) props.Photo = filesProp(data.photo, data.nom || "categorie");
  if ("ordre" in data) props.Ordre = numberProp(data.ordre);
  return props;
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.CATEGORIES_WEBSITE, null, null, 100);
    const categories = pages.map(normalizeCategory).sort((a, b) => a.ordre - b.ordre);
    return Response.json(categories, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET admin/categories]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    if (!String(data.nom || "").trim()) {
      return Response.json({ success: false, error: "Nom requis" }, { status: 400, headers: corsHeaders });
    }
    const properties = buildCategoryProperties({ ordre: 0, ...data });
    const page = await createPage(DB.CATEGORIES_WEBSITE, properties);
    return Response.json({ success: true, id: page.id, item: normalizeCategory(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST admin/categories]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
