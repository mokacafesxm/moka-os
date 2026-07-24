import {
  DB, corsHeaders,
  queryDatabase, createPage,
  getTitle, getSelect, getNumber, getDate, getRelationIds,
  titleProp, selectProp, numberProp, dateProp, textProp, relationProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function getSXMDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function normalizeExecution(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    tacheId: getRelationIds(p, "Tache")[0] || null,
    staffId: getRelationIds(p, "Staff")[0] || null,
    dateHeure: getDate(p, "Date_Heure"),
    statut: getSelect(p, "Statut"),
    valeurTemperature: getNumber(p, "Valeur_Temperature"),
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || getSXMDateString();

    const pages = await queryDatabase(DB.EXECUTIONS_TACHES, {
      property: "Date_Heure",
      date: { on_or_after: `${date}T00:00:00-04:00` },
    }, null, 200);

    return Response.json(pages.map(normalizeExecution), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET executions-taches]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    if (!data.tacheId) return Response.json({ error: "tacheId required" }, { status: 400, headers: corsHeaders });

    const page = await createPage(DB.EXECUTIONS_TACHES, {
      Nom: titleProp(data.nom || `Tâche — ${new Date().toISOString()}`),
      Tache: relationProp(data.tacheId),
      Staff: relationProp(data.staffId),
      Date_Heure: dateProp(data.dateHeure || new Date().toISOString()),
      Statut: selectProp(data.statut || "Fait"),
      Valeur_Temperature: numberProp(data.valeurTemperature),
      Notes: textProp(data.notes),
    });

    return Response.json({ success: true, id: page.id, item: normalizeExecution(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST execution-tache] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
