import { DB, corsHeaders, queryDatabase, withNotionCache, getTitle, getText, getNumber, getRelationIds } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalizeMois(page) {
  const p = page.properties;
  return {
    id: page.id,
    mois: getTitle(p, "Mois"),
    ordre: getNumber(p, "Ordre"),
    angle: getText(p, "Angle"),
    objectif: getText(p, "Objectif"),
  };
}

function normalizeEvenement(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom_Evenement"),
    moisIds: getRelationIds(p, "Mois"),
    notes: getText(p, "Notes"),
  };
}

// Données de référence pour les sélecteurs de la vue admin /specials — base
// modeste (12 mois fixes + événements), tout renvoyé sans filtre.
export async function GET() {
  try {
    const [mois, evenements] = await withNotionCache("specials-reference", 60000, async () => {
      const [moisPages, evenementsPages] = await Promise.all([
        queryDatabase(DB.SAISONNALITE_GENERIQUE, null, [{ property: "Ordre", direction: "ascending" }], 20),
        queryDatabase(DB.EVENEMENTS, null, null, 200),
      ]);
      return [moisPages.map(normalizeMois), evenementsPages.map(normalizeEvenement)];
    });

    return Response.json({ mois, evenements }, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET specials/reference]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
