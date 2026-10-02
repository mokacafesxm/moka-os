import {
  DB,
  corsHeaders,
  queryDatabase,
  createPage,
  getTitle,
  getNumber,
  getCheckbox,
  getUrl,
  getFileUrl,
  titleProp,
  numberProp,
  checkboxProp,
  urlProp,
  filesProp,
} from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export function normalizePromo(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    image: getFileUrl(p, "Image"),
    lien: getUrl(p, "Lien"),
    actif: getCheckbox(p, "Actif"),
    ordre: getNumber(p, "Ordre"),
  };
}

export function buildPromoProperties(data) {
  const props = {};
  if ("nom" in data) props.Nom = titleProp(data.nom);
  if ("image" in data) props.Image = filesProp(data.image, data.nom || "promo");
  if ("lien" in data) props.Lien = urlProp(data.lien);
  if ("actif" in data) props.Actif = checkboxProp(data.actif);
  if ("ordre" in data) props.Ordre = numberProp(data.ordre);
  return props;
}

// Unfiltered (unlike getMenuData's public fetchPromos, which only returns
// Actif:true) — the admin view needs to see and toggle inactive promos too.
export async function GET() {
  try {
    const pages = await queryDatabase(DB.PROMOS, null, null, 100);
    const promos = pages.map(normalizePromo).sort((a, b) => a.ordre - b.ordre);
    return Response.json(promos, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET admin/promos]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    if (!String(data.nom || "").trim()) {
      return Response.json({ success: false, error: "Nom requis" }, { status: 400, headers: corsHeaders });
    }
    const properties = buildPromoProperties({ actif: false, ordre: 0, ...data });
    const page = await createPage(DB.PROMOS, properties);
    return Response.json({ success: true, id: page.id, item: normalizePromo(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST admin/promos]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
