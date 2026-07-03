import {
  DB,
  queryDatabase,
  getTitle,
  getText,
  getSelect,
  getNumber,
  getCheckbox,
  getFileUrl,
} from "../../api/_notion";
import { parseVariants, hasRealOptions, priceFrom } from "./variants";

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
      disponible: getCheckbox(props, "Disponible"),
      populaire: getCheckbox(props, "Populaire"),
    };
  });
}

// Groups products into: "Popular" (Populaire=true), one section per Notion
// category (only categories that actually have products, in Ordre), and
// "Autres" for products whose Catégorie doesn't match any known category
// (empty, or not yet imported — see migration-shopify/06-check-category-consistency.js).
export async function getMenuData() {
  const [categories, promos, products] = await Promise.all([
    fetchCategories(),
    fetchPromos(),
    fetchProducts(),
  ]);

  const categoryNames = new Set(categories.map((c) => c.nom));
  const byCategory = new Map(categories.map((c) => [c.nom, []]));
  const autres = [];

  for (const product of products) {
    if (product.categorie && categoryNames.has(product.categorie)) {
      byCategory.get(product.categorie).push(product);
    } else {
      autres.push(product);
    }
  }

  const sections = categories
    .map((c) => ({ id: c.id, nom: c.nom, photo: c.photo, produits: byCategory.get(c.nom) }))
    .filter((s) => s.produits.length > 0);

  const popular = products.filter((p) => p.populaire && p.disponible);

  return { categories: sections.map(({ id, nom, photo }) => ({ id, nom, photo })), sections, popular, autres, promos };
}
