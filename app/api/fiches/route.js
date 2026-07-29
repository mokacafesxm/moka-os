import { DB, corsHeaders, queryDatabase, createPage, getTitle, getUrl, getSelect, getCheckbox, titleProp, urlProp, selectProp, checkboxProp } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeFiche(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    // "Zone" est le nom de propriété Notion historique (Bar/Cuisine) mais
    // sert désormais de "Famille" à 4 valeurs (+ Desserts/Basics) — voir
    // FAMILLES_PAR_POSTE ci-dessous pour le mapping utilisé par Mon Poste.
    famille: getSelect(p, "Zone"),
    categorie: getSelect(p, "Categorie"),
    pdfUrl: getUrl(p, "PDF_URL"),
    photoUrl: getUrl(p, "Photo_URL"),
    actif: getCheckbox(p, "Actif"),
  };
}

// Mon Poste appelle /api/fiches?zone=Bar|Cuisine et doit voir, en plus de sa
// propre famille, les fiches "Basics" (communes) et — pour Cuisine —
// "Desserts". Bar ne voit jamais Desserts (pas son rayon).
const FAMILLES_PAR_POSTE = {
  Bar: ["Bar", "Basics"],
  Cuisine: ["Cuisine", "Desserts", "Basics"],
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const zone = searchParams.get("zone");
    const familles = zone ? (FAMILLES_PAR_POSTE[zone] || [zone]) : null;

    const filter = familles
      ? { and: [{ property: "Actif", checkbox: { equals: true } }, { or: familles.map((f) => ({ property: "Zone", select: { equals: f } })) }] }
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

export async function POST(req) {
  try {
    const data = await req.json();
    if (!String(data.nom || "").trim()) {
      return Response.json({ success: false, error: "Nom requis" }, { status: 400, headers: corsHeaders });
    }
    const page = await createPage(DB.FICHES_TECHNIQUES, {
      Nom: titleProp(data.nom),
      Zone: selectProp(data.famille),
      PDF_URL: urlProp(data.pdfUrl),
      Photo_URL: urlProp(data.photoUrl),
      Actif: checkboxProp(true),
    });
    return Response.json({ success: true, id: page.id, item: normalizeFiche(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST fiches] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
