import {
  corsHeaders, getPage, withNotionCache,
  getSelect, getDate, getText, getTitle, getRelationIds,
} from "../_notion";
import { getPosteStatus, instantiateFermeture } from "../_checklist";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function staffDisplayName(page) {
  const p = page.properties;
  return getText(p, "Prénom") || getTitle(p, "Nom");
}

async function normalizePosteStatus(page) {
  if (!page) return null;
  const p = page.properties;
  const ouvertParId = getRelationIds(p, "Ouvert_Par")[0] || null;
  const fermeParId = getRelationIds(p, "Ferme_Par")[0] || null;
  const [ouvertParPage, fermeParPage] = await Promise.all([
    ouvertParId ? getPage(ouvertParId) : null,
    fermeParId ? getPage(fermeParId) : null,
  ]);
  return {
    id: page.id,
    poste: getSelect(p, "Poste"),
    date: getDate(p, "Date"),
    statut: getSelect(p, "Statut"),
    ouvertParId,
    ouvertParNom: ouvertParPage ? staffDisplayName(ouvertParPage) : "",
    heureOuverture: getDate(p, "Heure_Ouverture"),
    fermeParId,
    fermeParNom: fermeParPage ? staffDisplayName(fermeParPage) : "",
    heureFermeture: getDate(p, "Heure_Fermeture"),
  };
}

// Statut Notion du poste (partagé entre tous les appareils — remplace le
// localStorage par-appareil de l'ancien posteStatus.js) — voir /poste.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const poste = searchParams.get("poste");
    if (!poste) return Response.json(null, { headers: corsHeaders });

    const result = await withNotionCache(`poste-status:${poste}`, 10000, async () => {
      const page = await getPosteStatus(poste);
      return normalizePosteStatus(page);
    });

    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET poste-status]", err.message);
    return Response.json(null, { status: 500, headers: corsHeaders });
  }
}

// Déclenche la fermeture volontaire d'un poste (bouton "Fermer le [poste]",
// jamais le clock-out) — instancie la checklist QUOTIDIEN-FERMETURE. Voir
// instantiateFermeture pour l'idempotence.
export async function POST(request) {
  try {
    const { poste, staffId } = await request.json();
    if (!poste || !staffId) {
      return Response.json({ error: "poste and staffId required" }, { status: 400, headers: corsHeaders });
    }
    const result = await instantiateFermeture(poste, staffId);
    return Response.json({ success: true, ...result }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST poste-status]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
