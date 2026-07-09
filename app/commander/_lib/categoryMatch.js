export function productsForCategory(products, category) {
  if (!category) return [];
  return products.filter((p) => p.categorie === category.nom);
}
