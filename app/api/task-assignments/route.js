import {
  corsHeaders, queryDatabase, createPage, archivePage,
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
    // "tache" par défaut : les lignes créées avant l'ajout de Type (Sprint
    // "planning type") n'ont pas cette propriété renseignée.
    type: getSelect(p, "Type") || "tache",
    posteOverride: getSelect(p, "Poste_Override"),
  };
}

// GET ?staffId= — tâches personnelles assignées à un staff (/profil), les
// exceptions de planning en sont exclues (elles n'ont pas de Tache).
// GET ?from=&to= — toutes les exceptions de planning sur une période, tous
// staff confondus (mode "Modifier cette semaine" de /equipe).
export async function GET(req) {
  try {
    const dbId = getTaskAssignmentsDbId();
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staffId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let filter;
    if (staffId) {
      filter = { and: [
        { property: "Staff", relation: { contains: staffId } },
        { property: "Type", select: { does_not_equal: "planning_exception" } },
      ] };
    } else if (from && to) {
      filter = { and: [
        { property: "Date", date: { on_or_after: from } },
        { property: "Date", date: { on_or_before: to } },
        { property: "Type", select: { equals: "planning_exception" } },
      ] };
    } else {
      return Response.json({ error: "staffId ou from+to requis" }, { status: 400, headers: corsHeaders });
    }

    const pages = await queryDatabase(dbId, filter);
    return Response.json(pages.map(normalizeAssignment), { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    console.error(`[GET task-assignments] ${err.code || "ERROR"}: ${err.message}`);
    return Response.json({ error: err.message }, { status, headers: corsHeaders });
  }
}

// POST — deux usages partagent cette base (voir lib/planning/config.js) :
// 1. Assignation de tâche personnelle : { staffId, tacheId, date, ... }
// 2. Exception de planning (une case du tableau /equipe modifiée pour une
//    date précise sans toucher au planning type) :
//    { staffId, date, posteOverride, type: "planning_exception" }
export async function POST(req) {
  try {
    const dbId = getTaskAssignmentsDbId();
    const { staffId, staffName, tacheId, tacheNom, date, assignePar, note, type, posteOverride } = await req.json();

    if (type === "planning_exception") {
      if (!staffId || !date || !posteOverride) {
        return Response.json({ success: false, error: "staffId, date et posteOverride requis" }, { status: 400, headers: corsHeaders });
      }
      const page = await createPage(dbId, {
        Name: titleProp(`Exception — ${staffName || "Staff"} (${date})`),
        Staff: relationProp(staffId),
        Date: dateProp(date),
        Type: selectProp("planning_exception"),
        Poste_Override: selectProp(posteOverride),
      });
      return Response.json({ success: true, id: page.id, item: normalizeAssignment(page) }, { headers: corsHeaders });
    }

    if (!staffId || !tacheId || !date) {
      return Response.json({ success: false, error: "staffId, tacheId et date requis" }, { status: 400, headers: corsHeaders });
    }
    const page = await createPage(dbId, {
      Name: titleProp(`${tacheNom || "Tâche"} — ${staffName || "Staff"} (${date})`),
      Staff: relationProp(staffId),
      Tache: relationProp(tacheId),
      Date: dateProp(date),
      Statut: selectProp("À faire"),
      Type: selectProp("tache"),
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

// DELETE ?id= — retire une exception de planning (retour au planning type
// par défaut pour cette date). Archive plutôt que suppression réelle, voir
// archivePage.
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ success: false, error: "id requis" }, { status: 400, headers: corsHeaders });
    await archivePage(id);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error(`[DELETE task-assignments] ${err.message}`);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
