#!/usr/bin/env node
const { queryAll } = require("./lib/notion");

async function main() {
  const productsDbId = process.env.NOTION_PRODUCTS_DB_ID;
  const categoriesDbId = process.env.NOTION_CATEGORIES_DB_ID;
  if (!productsDbId) {
    console.error("❌ NOTION_PRODUCTS_DB_ID manquant");
    process.exit(1);
  }
  if (!categoriesDbId) {
    console.error("❌ NOTION_CATEGORIES_DB_ID manquant");
    process.exit(1);
  }

  console.log("📖 Chargement des catégories (Catégories Website)...");
  const categoryPages = await queryAll(categoriesDbId);
  const categoryNames = new Set(
    categoryPages.map((p) => p.properties["Nom"]?.title?.[0]?.plain_text?.trim()).filter(Boolean)
  );
  console.log(`✅ ${categoryNames.size} catégories : ${[...categoryNames].join(", ")}\n`);

  console.log("📖 Chargement des produits (website-product)...");
  const productPages = await queryAll(productsDbId);
  console.log(`✅ ${productPages.length} produits\n`);

  let matched = 0;
  const missingCategory = [];
  const mismatched = [];

  for (const page of productPages) {
    const title = page.properties["Name"]?.title?.[0]?.plain_text?.trim() || "(sans nom)";
    const category = page.properties["Catégorie"]?.select?.name || null;

    if (!category) {
      missingCategory.push(title);
      continue;
    }
    if (!categoryNames.has(category.trim())) {
      mismatched.push({ title, category });
      continue;
    }
    matched++;
  }

  console.log(`${"=".repeat(50)}`);
  console.log("📊 Cohérence des catégories produits ↔ Catégories Website");
  console.log("=".repeat(50));
  console.log(`✅ ${matched} produits avec une catégorie valide`);

  console.log(`\n⚠️  ${missingCategory.length} produits sans catégorie :`);
  for (const title of missingCategory) console.log(`     - ${title}`);

  console.log(`\n❌ ${mismatched.length} produits avec une catégorie qui ne correspond à aucune entrée Catégories Website :`);
  for (const { title, category } of mismatched) console.log(`     - ${title} → "${category}"`);

  console.log("\n(Aucune correction automatique effectuée.)");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
