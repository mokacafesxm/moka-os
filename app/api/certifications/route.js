import { DB, corsHeaders, queryDatabase, getTitle, getSelect, getDate, getRelationIds } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeCertification(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    staffId: getRelationIds(p, "Staff")[0] || null,
    competence: getSelect(p, "Competence"),
    statut: getSelect(p, "Statut"),
    dateValidation: getDate(p, "Date_Validation"),
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staffId");
    if (!staffId) return Response.json({ error: "staffId requis" }, { status: 400, headers: corsHeaders });

    const pages = await queryDatabase(DB.CERTIFICATIONS, { property: "Staff", relation: { contains: staffId } });
    return Response.json(pages.map(normalizeCertification), { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
