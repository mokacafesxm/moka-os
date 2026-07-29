import {
  corsHeaders, queryDatabase, createPage,
  getTitle, getText, getDate, getRelationIds,
  titleProp, textProp, dateProp, relationProp,
} from "../_notion";
import { getTaskAssignmentsDbId } from "../../../lib/planning/config";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeAssignment(page) {
  const p = page.properties;
  return {
    id: page.id,
    staffId: getRelationIds(p, "Staff")[0] || null,
    tacheId: getRelationIds(p, "Tache")[0] || null,
    nom: getText(p, "Nom_Tache") || getTitle(p, "Titre"),
    date: getDate(p, "Date"),
  };
}

export async function GET(req) {
  try {
    const dbId = getTaskAssignmentsDbId();
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staffId");
    if (!staffId) return Response.json({ error: "staffId requis" }, { status: 400, headers: corsHeaders });

    const pages = await queryDatabase(dbId, { property: "Staff", relation: { contains: staffId } });
    return Response.json(pages.map(normalizeAssignment), { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    return Response.json({ error: err.message }, { status, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const dbId = getTaskAssignmentsDbId();
    const { staffId, staffName, tacheId, tacheNom, date } = await req.json();
    if (!staffId || !tacheId || !date) {
      return Response.json({ success: false, error: "staffId, tacheId et date requis" }, { status: 400, headers: corsHeaders });
    }
    const page = await createPage(dbId, {
      Titre: titleProp(`${tacheNom || "Tâche"} — ${staffName || "Staff"} (${date})`),
      Staff: relationProp(staffId),
      Tache: relationProp(tacheId),
      Nom_Tache: textProp(tacheNom),
      Date: dateProp(date),
    });
    return Response.json({ success: true, id: page.id, item: normalizeAssignment(page) }, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    return Response.json({ success: false, error: err.message }, { status, headers: corsHeaders });
  }
}
