import {
  corsHeaders, queryDatabase, createPage,
  getTitle, getText, getDate, getSelect, getRelationIds,
  titleProp, textProp, dateProp, selectProp, relationProp,
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
    assignePar: getRelationIds(p, "Assigné_Par")[0] || null,
    // Le titre embarque déjà "tâche — staff (date)" à la création (voir POST) —
    // pas besoin d'un aller-retour Notion supplémentaire pour résoudre Tache.
    nom: getTitle(p, "Name"),
    date: getDate(p, "Date"),
    statut: getSelect(p, "Statut") || "À faire",
    note: getText(p, "Note"),
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
    console.error(`[GET task-assignments] ${err.code || "ERROR"}: ${err.message}`);
    return Response.json({ error: err.message }, { status, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const dbId = getTaskAssignmentsDbId();
    const { staffId, staffName, tacheId, tacheNom, date, assignePar, note } = await req.json();
    if (!staffId || !tacheId || !date) {
      return Response.json({ success: false, error: "staffId, tacheId et date requis" }, { status: 400, headers: corsHeaders });
    }
    const page = await createPage(dbId, {
      Name: titleProp(`${tacheNom || "Tâche"} — ${staffName || "Staff"} (${date})`),
      Staff: relationProp(staffId),
      Tache: relationProp(tacheId),
      Date: dateProp(date),
      Statut: selectProp("À faire"),
      Note: textProp(note),
      Assigné_Par: relationProp(assignePar),
    });
    return Response.json({ success: true, id: page.id, item: normalizeAssignment(page) }, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    console.error(`[POST task-assignments] ${err.code || "ERROR"}: ${err.message}`);
    return Response.json({ success: false, error: err.message }, { status, headers: corsHeaders });
  }
}
