import {
  corsHeaders, queryDatabase, createPage, updatePage, getPage,
  getText, getSelect, getRelationIds,
  titleProp, textProp, selectProp, relationProp,
} from "../../_notion";
import { getPlanningDbId } from "../../../../lib/planning/config";

// Sprint "planning type" — remplace le modèle par semaine (une ligne
// staff+semaine, horaires en JSON) par UN planning habituel par staff : une
// seule ligne, 7 colonnes select (une par jour) + une plage horaire unique.
// Les semaines qui dérogent au planning type (congé ponctuel, changement)
// vivent ailleurs, dans MOKA_Assignations_Taches (type "planning_exception"),
// jamais ici — voir /api/task-assignments.
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
  for (const j of JOURS) jours[j] = getSelect(p, JOUR_PROP[j]) || "";
  return {
    id: page.id,
    staffId: getRelationIds(p, "Staff")[0] || null,
    jours,
    horaireDebut: getText(p, "Horaire_Debut"),
    horaireFin: getText(p, "Horaire_Fin"),
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

// PATCH { staffId, staffName, jour?, poste?, horaireDebut?, horaireFin? } —
// upsert instantané d'un seul champ du planning type d'un staff (case tapée
// dans le tableau /equipe). Crée la ligne si le staff n'en a encore aucune.
export async function PATCH(req) {
  try {
    const dbId = getPlanningDbId();
    const { staffId, staffName, jour, poste, horaireDebut, horaireFin } = await req.json();
    if (!staffId) {
      return Response.json({ success: false, error: "staffId requis" }, { status: 400, headers: corsHeaders });
    }
    if (jour && !JOURS.includes(jour)) {
      return Response.json({ success: false, error: "jour invalide" }, { status: 400, headers: corsHeaders });
    }

    const properties = {};
    if (jour) properties[JOUR_PROP[jour]] = selectProp(poste);
    if (horaireDebut !== undefined) properties.Horaire_Debut = textProp(horaireDebut);
    if (horaireFin !== undefined) properties.Horaire_Fin = textProp(horaireFin);

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
