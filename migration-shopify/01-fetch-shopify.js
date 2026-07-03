#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { fetchAllActiveProducts } = require("./lib/shopify");

const OUT_FILE = path.join(__dirname, "data", "products.json");
const STATS_FILE = path.join(__dirname, "data", "stats-fetch.json");

async function main() {
  console.log("🛍️  Récupération des produits actifs depuis Shopify...");

  const products = await fetchAllActiveProducts({
    onPage: (page, total) => console.log(`  ...${total} produits récupérés`),
  });

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(products, null, 2));

  const withoutImage = products.filter((p) => !p.imageUrl).length;
  const stats = { total: products.length, withoutImage };
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

  console.log(`\n✅ ${products.length} produits actifs écrits dans ${path.relative(process.cwd(), OUT_FILE)}`);
  if (withoutImage) console.log(`⚠️  ${withoutImage} produits sans image sur Shopify`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
