import {
  DB, corsHeaders, queryDatabase, createPage, updatePage,
  getTitle, getUrl, getSelect, getCheckbox,
  titleProp, urlProp, selectProp, checkboxProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Renommée depuis /api/fiches (même base Notion MOKA_Fiches_Techniques,
// jamais renommée côté Notion — elle avait déjà exactement le schéma requis
// ici : Nom/Zone/Photo_URL/PDF_URL/Actif) pour matcher le nommage attendu
// par le dashboard Recettes. "Zone" est la propriété Notion historique mais
// sert de "Famille" — voir FAMILLES_PAR_POSTE pour le mapping Mon Poste.
function normalizeRecette(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    famille: getSelect(p, "Zone"),
    categorie: getSelect(p, "Categorie"),
    pdfUrl: getUrl(p, "PDF_URL"),
    photoUrl: getUrl(p, "Photo_URL"),
    actif: getCheckbox(p, "Actif"),
  };
}

const FAMILLES_PAR_POSTE = {
  Bar: ["Bar", "Basics", "Toutes"],
  Cuisine: ["Cuisine", "Desserts", "Basics", "Toutes"],
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const zone = searchParams.get("zone");
    const familles = zone ? (FAMILLES_PAR_POSTE[zone] || [zone]) : null;

    // Filtre "Zone" appliqué côté JS, pas dans la requête Notion : un
    // `select.equals` sur une valeur qui n'existe pas encore comme option
    // réelle sur la propriété (ex. "Toutes", jamais écrite sur aucune ligne)
    // fait échouer la requête avec une 400 validation_error — piégé en
    // testant ce endpoint en direct. Filtrer après coup évite ce piège
    // pour toute famille future qui n'a pas encore de ligne.
    const pages = await queryDatabase(DB.FICHES_TECHNIQUES, { property: "Actif", checkbox: { equals: true } }, [
      { property: "Nom", direction: "ascending" },
    ]);
    let items = pages.map(normalizeRecette);
    if (familles) items = items.filter((r) => familles.includes(r.famille));
    return Response.json(items, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET recettes]", err.message);
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
    return Response.json({ success: true, id: page.id, item: normalizeRecette(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST recettes] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return Response.json({ success: false, error: "id required" }, { status: 400, headers: corsHeaders });

    const properties = {};
    if ("nom" in data) properties.Nom = titleProp(data.nom);
    if ("famille" in data) properties.Zone = selectProp(data.famille);
    if ("pdfUrl" in data) properties.PDF_URL = urlProp(data.pdfUrl);
    if ("photoUrl" in data) properties.Photo_URL = urlProp(data.photoUrl);
    if ("actif" in data) properties.Actif = checkboxProp(data.actif);

    await updatePage(id, properties);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH recettes] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
