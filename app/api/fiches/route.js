import { DB, corsHeaders, queryDatabase, getTitle, getText, getSelect, getCheckbox } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeFiche(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    zone: getSelect(p, "Zone"),
    categorie: getSelect(p, "Categorie"),
    pdfUrl: getText(p, "PDF_URL"),
    photoUrl: getText(p, "Photo_URL"),
    actif: getCheckbox(p, "Actif"),
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const zone = searchParams.get("zone");

    const filter = zone
      ? { and: [{ property: "Actif", checkbox: { equals: true } }, { property: "Zone", select: { equals: zone } }] }
      : { property: "Actif", checkbox: { equals: true } };

    const pages = await queryDatabase(DB.FICHES_TECHNIQUES, filter, [
      { property: "Nom", direction: "ascending" },
    ]);
    return Response.json(pages.map(normalizeFiche), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET fiches]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
