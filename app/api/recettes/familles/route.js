import { DB, corsHeaders, queryDatabase, createPage, getTitle, getText, getSelect, getNumber, titleProp, textProp, selectProp, numberProp } from "../../_notion";

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
  };
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.RECETTES_FAMILLES, null, [
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
