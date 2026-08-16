// Matching facture -> ingrédient (coût matière). Deux briques :
//   1. Auto-matching à l'écriture (POST /api/prix-ingredients) via la
//      mémoire d'apprentissage MOKA_Libelle_Fournisseur_Mapping.
//   2. Validation manuelle (PATCH /api/prix-ingredients) qui alimente cette
//      même mémoire pour la prochaine facture du même fournisseur.
//
// Jamais de matching approximatif/flou ici — seulement une correspondance
// exacte (fournisseur résolu + libellé normalisé) pour ne jamais laisser un
// coût faux mais silencieux polluer un calcul de marge derrière.

import {
  DB, queryDatabase, createPage, updatePage, resolveName,
  getTitle, getRelationIds,
  titleProp, textProp, numberProp, selectProp, dateProp, relationProp,
} from "./_notion";
import { getLastKnownPrice } from "./_ingredient_price";

// Même seuil que l'alerte "Évolution des prix" de /rapports (10%) — pas
// partagé via un module commun pour éviter de faire dépendre un composant
// client de ce fichier serveur (createPage/updatePage y importent _notion,
// qui lit des variables d'env serveur).
const PRICE_DEVIATION_ALERT_PERCENT = 10;

function normalizeLabel(s) {
  return String(s || "").trim().toLowerCase();
}

export async function resolveFournisseurId(fournisseurText) {
  const name = String(fournisseurText || "").trim();
  if (!name) return null;
  return resolveName(DB.FOURNISSEURS, "Fournisseur", name);
}

// Correspondance exacte (fournisseur + libellé normalisé) — jamais floue.
// Récupère toutes les entrées du fournisseur (base modeste) plutôt que de
// s'appuyer sur le filtre Notion "title equals" (sensible à la casse/aux
// espaces, donc plus fragile qu'une comparaison normalisée côté JS).
export async function findMappedIngredientId(fournisseurId, libelleBrut) {
  if (!fournisseurId || !libelleBrut) return null;
  const target = normalizeLabel(libelleBrut);
  if (!target) return null;

  const pages = await queryDatabase(DB.LIBELLE_FOURNISSEUR_MAPPING, {
    property: "Fournisseur",
    relation: { contains: fournisseurId },
  });

  const match = pages.find((page) => normalizeLabel(getTitle(page.properties, "Libelle_Brut")) === target);
  if (!match) return null;
  return getRelationIds(match.properties, "Ingredient")[0] || null;
}

// Mémorise (ou corrige) le rattachement libellé+fournisseur -> ingrédient
// pour que la prochaine facture du même fournisseur avec ce même libellé
// s'auto-matche sans repasser par la file de validation.
export async function upsertMapping({ fournisseurId, libelleBrut, ingredientId }) {
  if (!fournisseurId || !libelleBrut || !ingredientId) return null;
  const target = normalizeLabel(libelleBrut);

  const pages = await queryDatabase(DB.LIBELLE_FOURNISSEUR_MAPPING, {
    property: "Fournisseur",
    relation: { contains: fournisseurId },
  });
  const existing = pages.find((page) => normalizeLabel(getTitle(page.properties, "Libelle_Brut")) === target);

  if (existing) {
    await updatePage(existing.id, { Ingredient: relationProp(ingredientId) });
    return existing.id;
  }

  const page = await createPage(DB.LIBELLE_FOURNISSEUR_MAPPING, {
    Libelle_Brut: titleProp(libelleBrut),
    Fournisseur: relationProp(fournisseurId),
    Ingredient: relationProp(ingredientId),
  });
  return page.id;
}

// Écrit une ligne de prix avec matching automatique (voir ci-dessus) ET
// garde-fou écart de prix : même un ingrédient matché est renvoyé en "À
// valider" si son prix dévie de plus de PRICE_DEVIATION_ALERT_PERCENT% par
// rapport au dernier prix fiable connu (Auto-matché/Validé manuellement,
// jamais une ligne encore "À valider" elle-même) — sert autant un OCR qui a
// mal lu un chiffre qu'une vraie hausse/baisse fournisseur, dans les deux
// cas ça mérite un oeil humain avant d'entrer dans un calcul de marge.
// Utilisée par POST /api/prix-ingredients (flux manuel avec relecture) ET
// /api/invoice-scan (flux automatique sans relecture) — source unique.
export async function persistPriceLine(item) {
  const nom = String(item.nom || "").trim();
  if (!nom) return null;

  const fournisseurId = await resolveFournisseurId(item.fournisseur);
  const ingredientId = fournisseurId ? await findMappedIngredientId(fournisseurId, nom) : null;

  let statut = ingredientId ? "Auto-matché" : "À valider";

  if (ingredientId && item.prix_unitaire) {
    const last = await getLastKnownPrice(ingredientId);
    if (last?.prixUnitaire) {
      const variation = Math.abs((Number(item.prix_unitaire) - last.prixUnitaire) / last.prixUnitaire) * 100;
      if (variation > PRICE_DEVIATION_ALERT_PERCENT) statut = "À valider";
    }
  }

  const page = await createPage(DB.PRIX_INGREDIENTS, {
    Ingredient: titleProp(nom),
    Fournisseur: textProp(item.fournisseur || ""),
    Prix_Unitaire: numberProp(item.prix_unitaire),
    Quantite: numberProp(item.quantite),
    Unite: selectProp(item.unite || ""),
    Date: dateProp(item.date || new Date().toISOString().slice(0, 10)),
    Source: selectProp(item.source || "facture"),
    Statut_Matching: selectProp(statut),
    Numero_Facture: textProp(item.numero_facture || ""),
    Notes: textProp(item.notes || ""),
    ...(fournisseurId ? { Fournisseur_Rel: relationProp(fournisseurId) } : {}),
    ...(ingredientId ? { Ingredient_Master: relationProp(ingredientId) } : {}),
  });

  return page.id;
}
