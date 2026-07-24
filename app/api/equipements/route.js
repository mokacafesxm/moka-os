import {
  DB, corsHeaders,
  queryDatabase, createPage, updatePage, archivePage,
  getTitle, getText, getSelect, getDate, getRelationIds,
  titleProp, textProp, selectProp, dateProp, relationProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeEquipement(page) {
  const p = page.properties;
  const zoneIds = getRelationIds(p, "Zone");
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    zoneId: zoneIds[0] || null,
    marque: getText(p, "Marque"),
    modele: getText(p, "Modele"),
    numeroSerie: getText(p, "Numero_Serie"),
    dateAchat: getDate(p, "Date_Achat"),
    statut: getSelect(p, "Statut"),
    criticite: getSelect(p, "Criticite"),
    dernierNettoyage: getDate(p, "Dernier_Nettoyage"),
    prochaineMaintenance: getDate(p, "Prochaine_Maintenance"),
    notes: getText(p, "Notes"),
  };
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.EQUIPEMENTS, null, [
      { property: "Nom", direction: "ascending" },
    ]);
    return Response.json(pages.map(normalizeEquipement), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET equipements]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    const page = await createPage(DB.EQUIPEMENTS, {
      Nom: titleProp(data.nom),
      Zone: relationProp(data.zoneId),
      Marque: textProp(data.marque),
      Modele: textProp(data.modele),
      Numero_Serie: textProp(data.numeroSerie),
      Date_Achat: dateProp(data.dateAchat),
      Statut: selectProp(data.statut || "Actif"),
      Criticite: selectProp(data.criticite),
      Dernier_Nettoyage: dateProp(data.dernierNettoyage),
      Prochaine_Maintenance: dateProp(data.prochaineMaintenance),
      Notes: textProp(data.notes),
    });
    return Response.json({ success: true, id: page.id, item: normalizeEquipement(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST equipement] Exception:", err.message);
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
    if ("marque" in data) properties.Marque = textProp(data.marque);
    if ("modele" in data) properties.Modele = textProp(data.modele);
    if ("numeroSerie" in data) properties.Numero_Serie = textProp(data.numeroSerie);
    if ("dateAchat" in data) properties.Date_Achat = dateProp(data.dateAchat);
    if ("statut" in data) properties.Statut = selectProp(data.statut);
    if ("criticite" in data) properties.Criticite = selectProp(data.criticite);
    if ("dernierNettoyage" in data) properties.Dernier_Nettoyage = dateProp(data.dernierNettoyage);
    if ("prochaineMaintenance" in data) properties.Prochaine_Maintenance = dateProp(data.prochaineMaintenance);
    if ("notes" in data) properties.Notes = textProp(data.notes);

    await updatePage(id, properties);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH equipement] Exception:", err.message);
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
    console.error("[DELETE equipement] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
