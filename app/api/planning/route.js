import {
  corsHeaders, queryDatabase, createPage, updatePage, getPage,
  getDate, getSelect, getRelationIds,
  titleProp, dateProp, selectProp, relationProp,
} from "../_notion";
import { getPlanningDbId } from "../../../lib/planning/config";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JOUR_PROP = { lundi: "Lundi", mardi: "Mardi", mercredi: "Mercredi", jeudi: "Jeudi", vendredi: "Vendredi", samedi: "Samedi", dimanche: "Dimanche" };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeRow(page) {
  const p = page.properties;
  const row = {
    id: page.id,
    staffId: getRelationIds(p, "Staff")[0] || null,
    semaine: (getDate(p, "Semaine") || "").slice(0, 10),
  };
  for (const jour of JOURS) row[jour] = getSelect(p, JOUR_PROP[jour]) || "";
  return row;
}

export async function GET(req) {
  try {
    const dbId = getPlanningDbId();
    const { searchParams } = new URL(req.url);
    const semaine = searchParams.get("semaine");
    if (!semaine) return Response.json({ error: "semaine requise" }, { status: 400, headers: corsHeaders });

    const pages = await queryDatabase(dbId, { property: "Semaine", date: { equals: semaine } });
    return Response.json(pages.map(normalizeRow), { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    return Response.json({ error: err.message }, { status, headers: corsHeaders });
  }
}

// Upsert une seule case (staffId, semaine, jour) — trouve la ligne staff+semaine
// si elle existe déjà, la crée sinon, puis met à jour uniquement ce jour-là.
export async function POST(req) {
  try {
    const dbId = getPlanningDbId();
    const { staffId, staffName, semaine, jour, valeur } = await req.json();
    if (!staffId || !semaine || !jour) {
      return Response.json({ success: false, error: "staffId, semaine et jour requis" }, { status: 400, headers: corsHeaders });
    }
    if (!JOURS.includes(jour)) {
      return Response.json({ success: false, error: "jour invalide" }, { status: 400, headers: corsHeaders });
    }

    const existing = await queryDatabase(dbId, {
      and: [
        { property: "Semaine", date: { equals: semaine } },
        { property: "Staff", relation: { contains: staffId } },
      ],
    });

    let page;
    if (existing[0]) {
      await updatePage(existing[0].id, { [JOUR_PROP[jour]]: selectProp(valeur) });
      // Re-fetch plutôt que muter existing[0] en mémoire : un objet propriété
      // select construit à la main sans son `type: "select"` fait échouer
      // getSelect() silencieusement (retourne "") — piégé en test live avant
      // ce fix, la case venait de s'écrire correctement côté Notion mais la
      // réponse de l'API renvoyait quand même l'ancienne valeur vide.
      page = await getPage(existing[0].id);
    } else {
      page = await createPage(dbId, {
        Name: titleProp(`${staffName || "Staff"} — ${semaine}`),
        Staff: relationProp(staffId),
        Semaine: dateProp(semaine),
        [JOUR_PROP[jour]]: selectProp(valeur),
      });
    }

    return Response.json({ success: true, item: normalizeRow(page) }, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    return Response.json({ success: false, error: err.message }, { status, headers: corsHeaders });
  }
}
