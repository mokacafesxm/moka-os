// Matching facture -> ingrédient (coût matière). Deux briques :
//   1. Auto-matching à l'écriture (POST /api/prix-ingredients) via la
//      mémoire d'apprentissage MOKA_Libelle_Fournisseur_Mapping.
//   2. Validation manuelle (PATCH /api/prix-ingredients) qui alimente cette
//      même mémoire pour la prochaine facture du même fournisseur.
//
// Jamais de matching approximatif/flou ici — seulement une correspondance
// exacte (fournisseur résolu + libellé normalisé) pour ne jamais laisser un
// coût faux mais silencieux polluer un calcul de marge derrière.

import { DB, queryDatabase, createPage, updatePage, resolveName, getTitle, getRelationIds, titleProp, relationProp } from "./_notion";

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
