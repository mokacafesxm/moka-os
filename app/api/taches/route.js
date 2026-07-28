import {
  DB, corsHeaders,
  queryDatabase, createPage, updatePage, archivePage,
  getTitle, getText, getSelect, getCheckbox, getRelationIds,
  titleProp, textProp, selectProp, checkboxProp, relationProp, urlProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeTache(page) {
  const p = page.properties;
  const zoneIds = getRelationIds(p, "Zone");
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    zoneId: zoneIds[0] || null,
    poste: getSelect(p, "Poste"),
    frequence: getSelect(p, "Frequence"),
    moment: getSelect(p, "Moment"),
    priorite: getSelect(p, "Priorite"),
    necessitePhoto: getCheckbox(p, "Necessite_Photo"),
    necessiteTemperature: getCheckbox(p, "Necessite_Temperature"),
    description: getText(p, "Description"),
    sopLien: getText(p, "SOP_Lien"),
    actif: getCheckbox(p, "Actif"),
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const zone = searchParams.get("zone");
    const moment = searchParams.get("moment");

    const conditions = [];
    if (zone) conditions.push({ property: "Zone", relation: { contains: zone } });
    if (moment) conditions.push({ property: "Moment", select: { equals: moment } });
    const filter = conditions.length === 0 ? null : conditions.length === 1 ? conditions[0] : { and: conditions };

    const pages = await queryDatabase(DB.TACHES, filter, [
      { property: "Nom", direction: "ascending" },
    ]);
    return Response.json(pages.map(normalizeTache), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET taches]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    const page = await createPage(DB.TACHES, {
      Nom: titleProp(data.nom),
      Zone: relationProp(data.zoneId),
      Poste: selectProp(data.poste),
      Frequence: selectProp(data.frequence),
      Moment: selectProp(data.moment),
      Priorite: selectProp(data.priorite || "Normale"),
      Necessite_Photo: checkboxProp(data.necessitePhoto),
      Necessite_Temperature: checkboxProp(data.necessiteTemperature),
      Description: textProp(data.description),
      SOP_Lien: urlProp(data.sopLien),
      Actif: checkboxProp(data.actif ?? true),
    });
    return Response.json({ success: true, id: page.id, item: normalizeTache(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST tache] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });

    const properties = {};
    if ("nom" in data) properties.Nom = titleProp(data.nom);
    if ("zoneId" in data) properties.Zone = relationProp(data.zoneId);
    if ("poste" in data) properties.Poste = selectProp(data.poste);
    if ("frequence" in data) properties.Frequence = selectProp(data.frequence);
    if ("moment" in data) properties.Moment = selectProp(data.moment);
    if ("priorite" in data) properties.Priorite = selectProp(data.priorite);
    if ("necessitePhoto" in data) properties.Necessite_Photo = checkboxProp(data.necessitePhoto);
    if ("necessiteTemperature" in data) properties.Necessite_Temperature = checkboxProp(data.necessiteTemperature);
    if ("description" in data) properties.Description = textProp(data.description);
    if ("sopLien" in data) properties.SOP_Lien = urlProp(data.sopLien);
    if ("actif" in data) properties.Actif = checkboxProp(data.actif);

    await updatePage(id, properties);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH tache] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    await archivePage(id);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[DELETE tache] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
