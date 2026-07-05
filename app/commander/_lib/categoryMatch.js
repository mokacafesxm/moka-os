// Legacy Shopify "Catégorie" values that predate the CATEGORIES_WEBSITE
// taxonomy and were never re-tagged into it (see migration-shopify/) — they
// don't match any real category, so they're grouped under a synthetic "FOOD"
// rail entry instead of becoming invisible in the category rail.
export const FOOD_CATEGORY_ID = "food-catchall";
const UNMAPPED_FOOD_CATEGORIES = new Set(["FOOD", "SIDES"]);

export function hasUnmappedCategory(products) {
  return products.some((p) => UNMAPPED_FOOD_CATEGORIES.has(p.categorie));
}

export function productsForCategory(products, category) {
  if (!category) return [];
  if (category.id === FOOD_CATEGORY_ID) {
    return products.filter((p) => UNMAPPED_FOOD_CATEGORIES.has(p.categorie));
  }
  return products.filter((p) => p.categorie === category.nom);
}
