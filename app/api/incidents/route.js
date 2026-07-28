import {
  DB, corsHeaders,
  queryDatabase, createPage, updatePage,
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
    actionsPrises: getText(p, "Actions_Prises"),
    resolution: getText(p, "Resolution"),
    dateResolution: getDate(p, "Date_Resolution"),
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

// Statut transitions ("Prendre en charge" → "En cours", "Résoudre" →
// "Résolu" + note) — Date_Resolution is stamped server-side, never trusted
// from the client, so it always reflects when the resolve actually happened.
export async function PATCH(req) {
  try {
    const { id, statut, resolution } = await req.json();
    if (!id) return Response.json({ success: false, error: "id requis" }, { status: 400, headers: corsHeaders });

    const properties = {};
    if (statut) properties.Statut = selectProp(statut);
    if (resolution !== undefined) properties.Resolution = textProp(resolution);
    if (statut === "Résolu") properties.Date_Resolution = dateProp(new Date().toISOString());

    await updatePage(id, properties);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH incident] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
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
