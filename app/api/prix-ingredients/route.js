import {
  DB, corsHeaders, queryDatabase, createPage,
  getTitle, getText, getNumber, getSelect, getDate, getRelationIds,
  titleProp, textProp, numberProp, selectProp, dateProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalize(page) {
  const p = page.properties;
  return {
    id: page.id,
    // Ingredient/fournisseur (texte brut) — LECTURE SEULE désormais, jamais
    // écrits par autre chose que le scan/la saisie d'origine. Le matching
    // fiable passe par ingredientMasterId/fournisseurRelId ci-dessous (vide
    // tant que PR2 — matching/apprentissage — n'est pas branché).
    ingredient: getTitle(p, "Ingredient"),
    fournisseur: getText(p, "Fournisseur"),
    ingredientMasterId: getRelationIds(p, "Ingredient_Master")[0] || null,
    fournisseurRelId: getRelationIds(p, "Fournisseur_Rel")[0] || null,
    prixUnitaire: getNumber(p, "Prix_Unitaire"),
    quantite: getNumber(p, "Quantite"),
    unite: getSelect(p, "Unite"),
    date: getDate(p, "Date"),
    source: getSelect(p, "Source"),
    statutMatching: getSelect(p, "Statut_Matching"),
    numeroFacture: getText(p, "Numero_Facture"),
    notes: getText(p, "Notes"),
  };
}

// GET [?ingredient=nom] — liste triée par date décroissante. Sans filtre,
// renvoie tout (base de taille modeste, comme /api/products) : le sélecteur
// d'ingrédient du dashboard "Évolution des prix" (/rapports) dérive sa
// propre liste d'ingrédients distincts de ce même résultat plutôt que
// d'appeler une route dédiée.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ingredient = searchParams.get("ingredient");

    const filter = ingredient ? { property: "Ingredient", title: { equals: ingredient } } : undefined;
    const pages = await queryDatabase(DB.PRIX_INGREDIENTS, filter, [{ property: "Date", direction: "descending" }], 500);

    return Response.json(pages.map(normalize), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET prix-ingredients]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST { produits: [{ nom, fournisseur, prix_unitaire, quantite, unite, date, source, numero_facture, notes }] }
// Persiste les lignes de prix (édition/vérification côté client déjà faite
// avant l'appel — voir /api/scan-facture pour l'extraction). N'écrit jamais
// dans le Stock.
//
// Statut_Matching est toujours "À valider" ici : le matching automatique
// (lookup Libelle_Fournisseur_Mapping, écriture d'Ingredient_Master/
// Fournisseur_Rel) arrive en PR2, pas encore branché sur cette route. Tant
// que ce n'est pas le cas, Ingredient/Fournisseur (texte brut) restent les
// seules valeurs écrites — ne jamais les traiter comme la source de vérité
// une fois PR2 en place, voir leur description Notion.
export async function POST(req) {
  try {
    const { produits } = await req.json();
    if (!Array.isArray(produits) || produits.length === 0) {
      return Response.json({ success: false, error: "produits (array) requis" }, { status: 400, headers: corsHeaders });
    }

    const created = [];
    for (const item of produits) {
      const nom = String(item.nom || "").trim();
      if (!nom) continue;
      const page = await createPage(DB.PRIX_INGREDIENTS, {
        Ingredient: titleProp(nom),
        Fournisseur: textProp(item.fournisseur || ""),
        Prix_Unitaire: numberProp(item.prix_unitaire),
        Quantite: numberProp(item.quantite),
        Unite: selectProp(item.unite || ""),
        Date: dateProp(item.date || new Date().toISOString().slice(0, 10)),
        Source: selectProp(item.source || "facture"),
        Statut_Matching: selectProp("À valider"),
        Numero_Facture: textProp(item.numero_facture || ""),
        Notes: textProp(item.notes || ""),
      });
      created.push(page.id);
    }

    return Response.json({ success: true, count: created.length }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST prix-ingredients]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
