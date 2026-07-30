import { DB, corsHeaders, queryDatabase, createPage, archivePage, getTitle, getText, getSelect, getNumber, getCheckbox, titleProp, textProp, selectProp, numberProp } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeFamille(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    emoji: getText(p, "Emoji"),
    zone: getSelect(p, "Zone"),
    ordre: getNumber(p, "Ordre"),
    actif: getCheckbox(p, "Actif"),
  };
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.RECETTES_FAMILLES, { property: "Actif", checkbox: { equals: true } }, [
      { property: "Ordre", direction: "ascending" },
    ]);
    return Response.json(pages.map(normalizeFamille), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET recettes/familles]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    if (!String(data.nom || "").trim()) {
      return Response.json({ success: false, error: "Nom requis" }, { status: 400, headers: corsHeaders });
    }
    const page = await createPage(DB.RECETTES_FAMILLES, {
      Nom: titleProp(data.nom),
      Emoji: textProp(data.emoji),
      Zone: selectProp(data.zone),
      Ordre: numberProp(data.ordre ?? 99),
    });
    return Response.json({ success: true, id: page.id, item: normalizeFamille(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST recettes/familles] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// Archive plutôt que suppression réelle (voir archivePage) — cohérent avec le
// reste de l'app Notion-backed, garde l'historique et reste réversible depuis
// Notion si une famille est retirée par erreur.
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ success: false, error: "id required" }, { status: 400, headers: corsHeaders });
    await archivePage(id);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[DELETE recettes/familles] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
