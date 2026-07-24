import {
  DB, corsHeaders,
  queryDatabase, createPage, updatePage, archivePage,
  getTitle, getText, getSelect, getNumber, getCheckbox,
  titleProp, textProp, selectProp, numberProp, checkboxProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeZone(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    emoji: getText(p, "Emoji"),
    responsablePoste: getSelect(p, "Responsable_Poste"),
    actif: getCheckbox(p, "Actif"),
    ordre: getNumber(p, "Ordre"),
    description: getText(p, "Description"),
  };
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.ZONES_PHYSIQUES, null, [
      { property: "Ordre", direction: "ascending" },
    ]);
    return Response.json(pages.map(normalizeZone), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET zones]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    const page = await createPage(DB.ZONES_PHYSIQUES, {
      Nom: titleProp(data.nom),
      Emoji: textProp(data.emoji),
      Responsable_Poste: selectProp(data.responsablePoste),
      Actif: checkboxProp(data.actif ?? true),
      Ordre: numberProp(data.ordre),
      Description: textProp(data.description),
    });
    return Response.json({ success: true, id: page.id, item: normalizeZone(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST zone] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });

    const properties = {};
    if ("nom" in data) properties.Nom = titleProp(data.nom);
    if ("emoji" in data) properties.Emoji = textProp(data.emoji);
    if ("responsablePoste" in data) properties.Responsable_Poste = selectProp(data.responsablePoste);
    if ("actif" in data) properties.Actif = checkboxProp(data.actif);
    if ("ordre" in data) properties.Ordre = numberProp(data.ordre);
    if ("description" in data) properties.Description = textProp(data.description);

    await updatePage(id, properties);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH zone] Exception:", err.message);
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
    console.error("[DELETE zone] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
