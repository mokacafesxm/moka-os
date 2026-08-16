import {
  DB, corsHeaders, queryDatabase, getPage, updatePage,
  getTitle, getText, getNumber, getSelect, getDate, getRelationIds,
  numberProp, selectProp, relationProp,
} from "../_notion";
import { resolveFournisseurId, upsertMapping, persistPriceLine } from "../_ingredient_matching";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalize(page) {
  const p = page.properties;
  return {
    id: page.id,
    // Ingredient/fournisseur (texte brut) — LECTURE SEULE désormais, jamais
    // écrits par autre chose que le scan/la saisie d'origine. Le matching
    // fiable passe par ingredientMasterId/fournisseurRelId ci-dessous.
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

// GET [?ingredient=nom] [?statut=À valider] — triée par date décroissante.
// Sans filtre, renvoie tout (base de taille modeste, comme /api/products) :
// le sélecteur d'ingrédient du dashboard "Évolution des prix" (/rapports)
// dérive sa propre liste d'ingrédients distincts de ce même résultat plutôt
// que d'appeler une route dédiée. ?statut= alimente la file "Factures à
// valider" (même page).
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ingredient = searchParams.get("ingredient");
    const statut = searchParams.get("statut");

    const conditions = [];
    if (ingredient) conditions.push({ property: "Ingredient", title: { equals: ingredient } });
    if (statut) conditions.push({ property: "Statut_Matching", select: { equals: statut } });
    const filter = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : { and: conditions };

    const pages = await queryDatabase(DB.PRIX_INGREDIENTS, filter, [{ property: "Date", direction: "descending" }], 500);

    return Response.json(pages.map(normalize), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET prix-ingredients]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST { produits: [{ nom, fournisseur, prix_unitaire, quantite, unite, date, source, numero_facture, notes }] }
// Persiste les lignes de prix (édition/vérification côté client déjà faite
// avant l'appel — voir /api/scan-facture pour l'extraction manuelle, ou
// /api/invoice-scan pour le flux automatique sans relecture). N'écrit jamais
// dans le Stock.
//
// Matching + garde-fou écart de prix à l'écriture : voir
// persistPriceLine dans _ingredient_matching.js (source unique, partagée
// avec /api/invoice-scan).
export async function POST(req) {
  try {
    const { produits } = await req.json();
    if (!Array.isArray(produits) || produits.length === 0) {
      return Response.json({ success: false, error: "produits (array) requis" }, { status: 400, headers: corsHeaders });
    }

    const created = [];
    for (const item of produits) {
      const id = await persistPriceLine(item);
      if (id) created.push(id);
    }

    return Response.json({ success: true, count: created.length }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST prix-ingredients]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// PATCH { id, ingredientMasterId } — rattachement manuel d'une ligne non
// matchée depuis la file "Factures à valider" (/rapports). Alimente
// automatiquement Libelle_Fournisseur_Mapping pour que la prochaine facture
// du même fournisseur avec ce même libellé s'auto-matche (voir POST
// ci-dessus).
//
// PATCH { id, confirmPrice: true, prixUnitaire? } — confirme une ligne déjà
// matchée mais renvoyée "À valider" pour écart de prix (voir
// persistPriceLine) : ne touche jamais Ingredient_Master/le mapping, juste
// le statut (et corrige Prix_Unitaire si l'OCR avait mal lu le chiffre).
export async function PATCH(req) {
  try {
    const { id, ingredientMasterId, confirmPrice, prixUnitaire } = await req.json();
    if (!id) {
      return Response.json({ success: false, error: "id required" }, { status: 400, headers: corsHeaders });
    }

    if (confirmPrice) {
      await updatePage(id, {
        Statut_Matching: selectProp("Validé manuellement"),
        ...(prixUnitaire !== undefined ? { Prix_Unitaire: numberProp(prixUnitaire) } : {}),
      });
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (!ingredientMasterId) {
      return Response.json({ success: false, error: "ingredientMasterId or confirmPrice required" }, { status: 400, headers: corsHeaders });
    }

    const page = await getPage(id);
    const libelleBrut = getTitle(page.properties, "Ingredient");
    const fournisseurText = getText(page.properties, "Fournisseur");
    const existingFournisseurId = getRelationIds(page.properties, "Fournisseur_Rel")[0] || null;
    const fournisseurId = existingFournisseurId || await resolveFournisseurId(fournisseurText);

    await updatePage(id, {
      Ingredient_Master: relationProp(ingredientMasterId),
      Statut_Matching: selectProp("Validé manuellement"),
      ...(fournisseurId ? { Fournisseur_Rel: relationProp(fournisseurId) } : {}),
    });

    // Mémorisation best-effort : sans fournisseur résolu, pas de clé
    // (fournisseur + libellé) fiable pour la mémoire d'apprentissage — la
    // ligne reste validée quand même, juste sans alimenter le mapping.
    if (fournisseurId) {
      await upsertMapping({ fournisseurId, libelleBrut, ingredientId: ingredientMasterId });
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH prix-ingredients]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
