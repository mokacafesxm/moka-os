import {
  DB, corsHeaders, queryDatabase, createPage, updatePage,
  getTitle, getNumber, getSelect, getCheckbox, getRelationIds,
  titleProp, numberProp, selectProp, checkboxProp, relationProp,
} from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export function normalizeLigne(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    boissonSpecialeId: getRelationIds(p, "Boisson_Speciale")[0] || null,
    ingredientId: getRelationIds(p, "Ingredient")[0] || null,
    quantite: getNumber(p, "Quantite"),
    unite: getSelect(p, "Unite"),
    actif: getCheckbox(p, "Actif"),
  };
}

// GET ?boissonSpecialeId= — lignes ingrédients d'une fiche (table
// intermédiaire, même schéma que RECIPE_LINES — voir _notion.js).
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const boissonSpecialeId = searchParams.get("boissonSpecialeId");
    if (!boissonSpecialeId) {
      return Response.json({ error: "boissonSpecialeId requis" }, { status: 400, headers: corsHeaders });
    }
    const pages = await queryDatabase(DB.BOISSON_SPECIALE_LIGNES, {
      property: "Boisson_Speciale",
      relation: { contains: boissonSpecialeId },
    });
    return Response.json(pages.map(normalizeLigne), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET specials/lignes]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST { boissonSpecialeId, ingredientId, ingredientNom, quantite, unite }
export async function POST(req) {
  try {
    const { boissonSpecialeId, ingredientId, ingredientNom, quantite, unite } = await req.json();
    if (!boissonSpecialeId || !ingredientId) {
      return Response.json({ success: false, error: "boissonSpecialeId and ingredientId required" }, { status: 400, headers: corsHeaders });
    }
    const page = await createPage(DB.BOISSON_SPECIALE_LIGNES, {
      Nom: titleProp(ingredientNom || "Ligne"),
      Boisson_Speciale: relationProp(boissonSpecialeId),
      Ingredient: relationProp(ingredientId),
      Quantite: numberProp(quantite),
      Unite: selectProp(unite || ""),
      Actif: checkboxProp(true),
    });
    return Response.json({ success: true, id: page.id, item: normalizeLigne(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST specials/lignes]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// PATCH { id, quantite?, unite?, actif? } — 'actif:false' = retrait souple
// (garde la ligne pour historique, exclue du calcul de coût).
export async function PATCH(req) {
  try {
    const { id, quantite, unite, actif } = await req.json();
    if (!id) return Response.json({ success: false, error: "id required" }, { status: 400, headers: corsHeaders });

    const properties = {};
    if (quantite !== undefined) properties.Quantite = numberProp(quantite);
    if (unite !== undefined) properties.Unite = selectProp(unite);
    if (actif !== undefined) properties.Actif = checkboxProp(actif);

    await updatePage(id, properties);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH specials/lignes]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
