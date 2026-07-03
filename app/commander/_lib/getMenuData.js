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

// Public menu changes rarely (new products/photos) — cache for 2 minutes so a
// burst of visitors doesn't hammer the Notion API (3 req/s limit).
const CACHE = { next: { revalidate: 120 } };

// Shopify collection names (product "Catégorie") classified as food, as opposed
// to drinks — used to build the "All The Food" section.
const FOOD_CATEGORIES = new Set(["FOOD", "SMALL BITES", "BIG BITES", "BOWLS", "SWEETS", "SIDES"]);

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

// Homepage flow (fixed order): category nav -> promos -> Popular -> Matcha
// Lovers -> Coffee Addict -> All The Food -> Refreshers -> Autres (safety net
// for products with neither a category nor a tag). Each section is dropped
// entirely when empty — never rendered as a blank block.
export async function getMenuData() {
  const [categories, promos, products] = await Promise.all([
    fetchCategories(),
    fetchPromos(),
    fetchProducts(),
  ]);

  const isMatcha = (p) => p.tags.includes("matcha");
  const isCoffee = (p) => p.tags.includes("coffee");
  const isTagged = (p) => isMatcha(p) || isCoffee(p);
  const isFood = (p) => FOOD_CATEGORIES.has(p.categorie) && !isTagged(p);

  const popular = products.filter((p) => p.populaire && p.disponible);
  const matchaLovers = products.filter(isMatcha);
  const coffeeAddict = products.filter(isCoffee);
  const allTheFood = products.filter(isFood);
  const refreshers = products.filter((p) => p.categorie && !isTagged(p) && !isFood(p));
  const autres = products.filter((p) => !p.categorie && !isTagged(p));

  return { categories, promos, popular, matchaLovers, coffeeAddict, allTheFood, refreshers, autres };
}
