import {
  DB, corsHeaders, queryDatabase, createPage,
  getTitle, getText, getSelect, getMultiSelect, getNumber, getDate, getFormula, getRelationIds,
  titleProp, textProp, selectProp, multiSelectProp, numberProp, dateProp, relationProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export function normalizeBoissonSpeciale(page) {
  const p = page.properties;
  return {
    id: page.id,
    nomProvisoire: getTitle(p, "Nom_Provisoire"),
    moisId: getRelationIds(p, "Mois")[0] || null,
    evenementId: getRelationIds(p, "Evenement")[0] || null,
    posteConcerne: getSelect(p, "Poste_Concerne"),
    objectifClient: getText(p, "Objectif_Client"),
    inspirationTendance: getText(p, "Inspiration_Tendance"),
    coutMatiereEstime: getNumber(p, "Cout_Matiere_Estime"),
    prixCible: getNumber(p, "Prix_Cible"),
    margeEstimee: getFormula(p, "Marge_Estimee"),
    tempsCibleProduction: getNumber(p, "Temps_Cible_Production"),
    nombreGestes: getNumber(p, "Nombre_Gestes"),
    materielNecessaire: getText(p, "Materiel_Necessaire"),
    compatibiliteLaitVegetal: getSelect(p, "Compatibilite_Lait_Vegetal"),
    allergenesHaccp: getMultiSelect(p, "Allergenes_HACCP"),
    visuelDescription: getText(p, "Visuel_Description"),
    statutPipeline: getSelect(p, "Statut_Pipeline"),
    test1Resultat: getText(p, "Test_1_Resultat"),
    test2Resultat: getText(p, "Test_2_Resultat"),
    avisManon: getText(p, "Avis_Manon"),
    avisThibault: getText(p, "Avis_Thibault"),
    decision: getSelect(p, "Decision"),
    dateLancement: getDate(p, "Date_Lancement"),
    bilanVentes30j: getText(p, "Bilan_Ventes_30j"),
    bilanMarge30j: getText(p, "Bilan_Marge_30j"),
    bilanRetours30j: getText(p, "Bilan_Retours_30j"),
    bilanDecisionFinale: getText(p, "Bilan_Decision_Finale"),
  };
}

// 'partial' — un champ n'est écrit que si la clé est présente dans data,
// même convention que lib/ops/ingredients-service.js. Visuel_Photo (files)
// volontairement absent : pas d'hébergement cloud configuré dans ce repo
// pour l'instant (voir InvoiceScanPrompt/FactureScanModal, même limite) —
// éditable directement dans Notion en attendant.
export function buildBoissonSpecialeProperties(data) {
  const props = {};
  if ("nomProvisoire" in data) props.Nom_Provisoire = titleProp(data.nomProvisoire);
  if ("moisId" in data) props.Mois = relationProp(data.moisId);
  if ("evenementId" in data) props.Evenement = relationProp(data.evenementId);
  if ("posteConcerne" in data) props.Poste_Concerne = selectProp(data.posteConcerne);
  if ("objectifClient" in data) props.Objectif_Client = textProp(data.objectifClient);
  if ("inspirationTendance" in data) props.Inspiration_Tendance = textProp(data.inspirationTendance);
  if ("coutMatiereEstime" in data) props.Cout_Matiere_Estime = numberProp(data.coutMatiereEstime);
  if ("prixCible" in data) props.Prix_Cible = numberProp(data.prixCible);
  if ("tempsCibleProduction" in data) props.Temps_Cible_Production = numberProp(data.tempsCibleProduction);
  if ("nombreGestes" in data) props.Nombre_Gestes = numberProp(data.nombreGestes);
  if ("materielNecessaire" in data) props.Materiel_Necessaire = textProp(data.materielNecessaire);
  if ("compatibiliteLaitVegetal" in data) props.Compatibilite_Lait_Vegetal = selectProp(data.compatibiliteLaitVegetal);
  if ("allergenesHaccp" in data) props.Allergenes_HACCP = multiSelectProp(data.allergenesHaccp);
  if ("visuelDescription" in data) props.Visuel_Description = textProp(data.visuelDescription);
  if ("statutPipeline" in data) props.Statut_Pipeline = selectProp(data.statutPipeline);
  if ("test1Resultat" in data) props.Test_1_Resultat = textProp(data.test1Resultat);
  if ("test2Resultat" in data) props.Test_2_Resultat = textProp(data.test2Resultat);
  if ("avisManon" in data) props.Avis_Manon = textProp(data.avisManon);
  if ("avisThibault" in data) props.Avis_Thibault = textProp(data.avisThibault);
  if ("decision" in data) props.Decision = selectProp(data.decision);
  if ("dateLancement" in data) props.Date_Lancement = dateProp(data.dateLancement);
  if ("bilanVentes30j" in data) props.Bilan_Ventes_30j = textProp(data.bilanVentes30j);
  if ("bilanMarge30j" in data) props.Bilan_Marge_30j = textProp(data.bilanMarge30j);
  if ("bilanRetours30j" in data) props.Bilan_Retours_30j = textProp(data.bilanRetours30j);
  if ("bilanDecisionFinale" in data) props.Bilan_Decision_Finale = textProp(data.bilanDecisionFinale);
  return props;
}

// GET — vue admin uniquement (voir /specials, gate isAdmin côté client comme
// /rapports) : toutes les fiches, tous statuts. La vue bar passe par
// /api/specials/bar (PR2), jamais celle-ci filtrée côté client.
export async function GET() {
  try {
    const pages = await queryDatabase(DB.BOISSON_SPECIALE, null, null, 200);
    return Response.json(pages.map(normalizeBoissonSpeciale), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET specials]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    if (!String(data.nomProvisoire || "").trim()) {
      return Response.json({ success: false, error: "nomProvisoire requis" }, { status: 400, headers: corsHeaders });
    }
    const properties = buildBoissonSpecialeProperties({ statutPipeline: "Piste", ...data });
    const page = await createPage(DB.BOISSON_SPECIALE, properties);
    return Response.json({ success: true, id: page.id, item: normalizeBoissonSpeciale(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST specials]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
