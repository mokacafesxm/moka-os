import {
  corsHeaders, queryDatabase, createPage, updatePage, getPage,
  getText, getSelect, getRelationIds,
  titleProp, textProp, selectProp, relationProp,
} from "../../_notion";
import { getPlanningDbId } from "../../../../lib/planning/config";

// Sprint "planning type" — un planning habituel par staff (une seule ligne),
// avec un poste ET des horaires propres à CHAQUE jour (pas une plage unique
// partagée sur toute la semaine — un staff peut ouvrir un jour et fermer un
// autre). Les semaines qui dérogent au planning type (congé ponctuel,
// changement) vivent ailleurs, dans MOKA_Assignations_Taches (type
// "planning_exception"), jamais ici — voir /api/task-assignments.
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JOUR_PROP = {
  lundi: "Lundi", mardi: "Mardi", mercredi: "Mercredi", jeudi: "Jeudi",
  vendredi: "Vendredi", samedi: "Samedi", dimanche: "Dimanche",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeRow(page) {
  const p = page.properties;
  const jours = {};
  for (const j of JOURS) {
    const prop = JOUR_PROP[j];
    jours[j] = {
      poste: getSelect(p, prop) || "",
      debut: getText(p, `${prop}_Debut`),
      fin: getText(p, `${prop}_Fin`),
    };
  }
  return {
    id: page.id,
    staffId: getRelationIds(p, "Staff")[0] || null,
    jours,
  };
}

// GET [?staffId=] — sans staffId, tout le planning type (tableau admin
// /equipe) ; avec staffId, la ligne d'un seul staff ("Mon planning
// habituel" sur /profil).
export async function GET(req) {
  try {
    const dbId = getPlanningDbId();
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staffId");
    const filter = staffId ? { property: "Staff", relation: { contains: staffId } } : undefined;

    const pages = await queryDatabase(dbId, filter);
    const rows = pages.map(normalizeRow);
    return Response.json(staffId ? rows[0] || null : rows, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    console.error(`[GET equipe/planning] ${err.code || "ERROR"}: ${err.message}`);
    return Response.json({ error: err.message }, { status, headers: corsHeaders });
  }
}

// PATCH { staffId, staffName, jour, poste, debut?, fin? } — upsert
// instantané du poste + horaires d'UN jour du planning type d'un staff
// (case tapée dans le tableau /equipe). Crée la ligne si le staff n'en a
// encore aucune. Les autres jours déjà saisis ne sont jamais touchés.
export async function PATCH(req) {
  try {
    const dbId = getPlanningDbId();
    const { staffId, staffName, jour, poste, debut, fin } = await req.json();
    if (!staffId || !jour || !JOURS.includes(jour)) {
      return Response.json({ success: false, error: "staffId et jour (valide) requis" }, { status: 400, headers: corsHeaders });
    }

    const prop = JOUR_PROP[jour];
    const properties = {
      [prop]: selectProp(poste),
      [`${prop}_Debut`]: textProp(debut),
      [`${prop}_Fin`]: textProp(fin),
    };

    const existing = await queryDatabase(dbId, { property: "Staff", relation: { contains: staffId } }, null, 1);

    let page;
    if (existing[0]) {
      await updatePage(existing[0].id, properties);
      page = await getPage(existing[0].id);
    } else {
      page = await createPage(dbId, {
        Name: titleProp(staffName || "Staff"),
        Staff: relationProp(staffId),
        ...properties,
      });
    }

    return Response.json({ success: true, item: normalizeRow(page) }, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    console.error(`[PATCH equipe/planning] ${err.code || "ERROR"}: ${err.message}`);
    return Response.json({ success: false, error: err.message }, { status, headers: corsHeaders });
  }
}
