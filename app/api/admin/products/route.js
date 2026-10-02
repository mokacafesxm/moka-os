import {
  DB,
  corsHeaders,
  queryDatabase,
  createPage,
  getTitle,
  getText,
  getNumber,
  getSelect,
  getMultiSelect,
  getCheckbox,
  getFileUrl,
  titleProp,
  richTextProp,
  numberProp,
  selectProp,
  multiSelectProp,
  checkboxProp,
  filesProp,
} from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export function normalizeProduct(page) {
  const p = page.properties;
  let variantes = [];
  let extras = [];
  try {
    variantes = JSON.parse(getText(p, "Variantes") || "[]");
  } catch {
    // Malformed JSON shouldn't be possible (only ever written by this
    // editor or the migration script), but a 500 on a stray row is worse
    // than showing it with no variants.
  }
  try {
    extras = JSON.parse(getText(p, "Extras") || "[]");
  } catch {
    // Same reasoning as above.
  }
  return {
    id: page.id,
    nom: getTitle(p, "Name"),
    description: getText(p, "Description"),
    prix: getNumber(p, "Prix"),
    categorie: getSelect(p, "Catégorie"),
    tags: getMultiSelect(p, "Tags"),
    disponible: getCheckbox(p, "Disponible"),
    populaire: getCheckbox(p, "Populaire"),
    photo: getFileUrl(p, "Photo"),
    variantes,
    extras,
  };
}

// Partial-update by key presence — same convention as specials/route.js
// (buildBoissonSpecialeProperties) and lib/ops/ingredients-service.js: a key
// absent from `data` leaves that Notion property untouched, so PATCH can
// send only what changed.
export function buildProductProperties(data) {
  const props = {};
  if ("nom" in data) props.Name = titleProp(data.nom);
  if ("description" in data) props.Description = richTextProp(data.description);
  if ("prix" in data) props.Prix = numberProp(data.prix);
  if ("categorie" in data) props.Catégorie = selectProp(data.categorie);
  if ("tags" in data) props.Tags = multiSelectProp(data.tags);
  if ("disponible" in data) props.Disponible = checkboxProp(data.disponible);
  if ("populaire" in data) props.Populaire = checkboxProp(data.populaire);
  if ("photo" in data) props.Photo = filesProp(data.photo, data.nom || "photo");
  if ("variantes" in data) props.Variantes = richTextProp(JSON.stringify(data.variantes || []));
  if ("extras" in data) props.Extras = richTextProp(JSON.stringify(data.extras || []));
  return props;
}

// Full catalogue, unfiltered — same convention as /api/specials: the admin
// page does its own category-tab/search filtering client-side over one
// fetch, rather than the server re-querying Notion per filter change (the
// whole catalogue is ~60 rows, cheap to fetch whole).
export async function GET() {
  try {
    const pages = await queryDatabase(DB.WEBSITE_PRODUCTS, null, null, 200);
    return Response.json(pages.map(normalizeProduct), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET admin/products]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    if (!String(data.nom || "").trim()) {
      return Response.json({ success: false, error: "Nom requis" }, { status: 400, headers: corsHeaders });
    }
    const properties = buildProductProperties({ disponible: true, ...data });
    const page = await createPage(DB.WEBSITE_PRODUCTS, properties);
    return Response.json({ success: true, id: page.id, item: normalizeProduct(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST admin/products]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
