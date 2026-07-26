import {
  DB, corsHeaders,
  queryDatabase, createPage,
  getTitle, getText, getSelect, getDate, getRelationIds,
  titleProp, textProp, selectProp, relationProp, dateProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeIncident(page) {
  const p = page.properties;
  return {
    id: page.id,
    titre: getTitle(p, "Titre"),
    zoneId: getRelationIds(p, "Zone")[0] || null,
    categorie: getSelect(p, "Categorie"),
    criticite: getSelect(p, "Criticite"),
    statut: getSelect(p, "Statut"),
    declareParId: getRelationIds(p, "Declare_Par")[0] || null,
    description: getText(p, "Description"),
    dateHeure: getDate(p, "Date_Heure") || page.created_time || null,
  };
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.INCIDENTS, null, [
      { property: "Date_Heure", direction: "descending" },
    ]);
    return Response.json(pages.map(normalizeIncident), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET incidents]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    if (!String(data.titre || "").trim()) {
      return Response.json({ success: false, error: "Titre requis" }, { status: 400, headers: corsHeaders });
    }
    const page = await createPage(DB.INCIDENTS, {
      Titre: titleProp(data.titre),
      Zone: relationProp(data.zoneId),
      Categorie: selectProp(data.categorie),
      Criticite: selectProp(data.criticite),
      Description: textProp(data.description),
      Statut: selectProp(data.statut || "Ouvert"),
      Declare_Par: relationProp(data.declareParId),
      Date_Heure: dateProp(data.dateHeure || new Date().toISOString()),
    });
    return Response.json({ success: true, id: page.id, item: normalizeIncident(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST incident] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
