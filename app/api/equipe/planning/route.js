import {
  corsHeaders, queryDatabase, createPage, updatePage, getPage,
  getDate, getText, getRelationIds,
  titleProp, dateProp, textProp, relationProp,
} from "../../_notion";
import { getPlanningDbId } from "../../../../lib/planning/config";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function parseHoraires(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRow(page) {
  const p = page.properties;
  return {
    id: page.id,
    staffId: getRelationIds(p, "Staff")[0] || null,
    semaine: (getDate(p, "Semaine") || "").slice(0, 10),
    // { lundi: { poste, debut, fin }, ... } — stocké en JSON dans une seule
    // propriété rich_text "Horaires" plutôt que 14 colonnes séparées
    // (Lundi_Debut/Lundi_Fin/...) : plus simple à faire évoluer, un seul
    // champ à lire/écrire par jour au lieu de trois.
    horaires: parseHoraires(getText(p, "Horaires")),
  };
}

// GET ?semaine=YYYY-MM-DD (obligatoire) [&staffId=] — sans staffId, renvoie
// tout le planning de la semaine (vue admin /equipe) ; avec staffId, la
// ligne d'un seul staff (vue /profil "Mon planning").
export async function GET(req) {
  try {
    const dbId = getPlanningDbId();
    const { searchParams } = new URL(req.url);
    const semaine = searchParams.get("semaine");
    const staffId = searchParams.get("staffId");
    if (!semaine) return Response.json({ error: "semaine requise" }, { status: 400, headers: corsHeaders });

    const semaineFilter = { property: "Semaine", date: { equals: semaine } };
    const filter = staffId ? { and: [semaineFilter, { property: "Staff", relation: { contains: staffId } }] } : semaineFilter;

    const pages = await queryDatabase(dbId, filter);
    return Response.json(pages.map(normalizeRow), { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    console.error(`[GET equipe/planning] ${err.code || "ERROR"}: ${err.message}`);
    return Response.json({ error: err.message }, { status, headers: corsHeaders });
  }
}

// POST { staffId, staffName, semaine, jour, poste, debut, fin } — upsert un
// seul jour : trouve la ligne staff+semaine si elle existe, la crée sinon,
// fusionne le JSON Horaires existant avec la nouvelle entrée du jour (ne
// touche jamais les autres jours déjà saisis sur la même ligne).
export async function POST(req) {
  try {
    const dbId = getPlanningDbId();
    const { staffId, staffName, semaine, jour, poste, debut, fin } = await req.json();
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

    const entry = { poste: poste || "", debut: debut || "", fin: fin || "" };
    let page;
    if (existing[0]) {
      const current = parseHoraires(getText(existing[0].properties, "Horaires"));
      current[jour] = entry;
      await updatePage(existing[0].id, { Horaires: textProp(JSON.stringify(current)) });
      // Re-fetch plutôt que muter existing[0] en mémoire (voir /api/planning
      // pour le même piège déjà rencontré : un objet propriété construit à
      // la main sans son `type` fait échouer les lecteurs silencieusement).
      page = await getPage(existing[0].id);
    } else {
      page = await createPage(dbId, {
        Name: titleProp(`${staffName || "Staff"} — ${semaine}`),
        Staff: relationProp(staffId),
        Semaine: dateProp(semaine),
        Horaires: textProp(JSON.stringify({ [jour]: entry })),
      });
    }

    return Response.json({ success: true, item: normalizeRow(page) }, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    console.error(`[POST equipe/planning] ${err.code || "ERROR"}: ${err.message}`);
    return Response.json({ success: false, error: err.message }, { status, headers: corsHeaders });
  }
}
