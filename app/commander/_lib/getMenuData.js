import {
  DB,
  queryDatabase,
  getTitle,
  getText,
  getSelect,
  getNumber,
  getCheckbox,
  getFileUrl,
  getMultiSelect,
} from "../../api/_notion";
import { parseVariants, hasRealOptions, priceFrom } from "./variants";
import { FOOD_CATEGORY_ID, hasUnmappedCategory } from "./categoryMatch";

// Public menu changes rarely (new products/photos) — cache for 2 minutes so a
// burst of visitors doesn't hammer the Notion API (3 req/s limit).
const CACHE = { next: { revalidate: 120 } };

async function fetchCategories() {
  const pages = await queryDatabase(DB.CATEGORIES_WEBSITE, null, null, 100, CACHE);
  return pages
    .map((p) => ({
      id: p.id,
      nom: getTitle(p.properties, "Nom"),
      photo: getFileUrl(p.properties, "Photo"),
      ordre: getNumber(p.properties, "Ordre"),
    }))
    .filter((c) => c.nom)
    .sort((a, b) => a.ordre - b.ordre);
}

async function fetchPromos() {
  const pages = await queryDatabase(
    DB.PROMOS,
    { property: "Actif", checkbox: { equals: true } },
    null,
    100,
    CACHE
  );
  return pages
    .map((p) => ({
      id: p.id,
      image: getFileUrl(p.properties, "Image"),
      lien: getText(p.properties, "Lien"),
      ordre: getNumber(p.properties, "Ordre"),
    }))
    .filter((promo) => promo.image)
    .sort((a, b) => a.ordre - b.ordre);
}

async function fetchProducts() {
  const pages = await queryDatabase(DB.WEBSITE_PRODUCTS, null, null, 200, CACHE);
  return pages.map((p) => {
    const props = p.properties;
    const variants = parseVariants(props["Variantes"]);
    const prix = getNumber(props, "Prix");
    return {
      id: p.id,
      nom: getTitle(props, "Name"),
      description: getText(props, "Description"),
      prix,
      variants,
      hasVariants: hasRealOptions(variants),
      priceFrom: priceFrom(variants, prix),
      photo: getFileUrl(props, "Photo"),
      categorie: getSelect(props, "Catégorie"),
      tags: getMultiSelect(props, "Tags"),
      disponible: getCheckbox(props, "Disponible"),
      populaire: getCheckbox(props, "Populaire"),
    };
  });
}

export async function getMenuData() {
  const [categories, promos, products] = await Promise.all([
    fetchCategories(),
    fetchPromos(),
    fetchProducts(),
  ]);

  // Pin the FOOD catch-all last so it reads as a fallback, not a primary category.
  const allCategories = hasUnmappedCategory(products)
    ? [...categories, { id: FOOD_CATEGORY_ID, nom: "FOOD", photo: "", ordre: Infinity }]
    : categories;

  return {
    categories: allCategories,
    promos,
    products,
    generatedAt: Date.now(),
  };
}
