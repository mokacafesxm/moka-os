#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { rehostImage } = require("./lib/blob");

const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");
const STATS_FILE = path.join(__dirname, "data", "stats-images.json");

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("❌ BLOB_READ_WRITE_TOKEN manquant");
    process.exit(1);
  }
  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error(`❌ ${PRODUCTS_FILE} introuvable — lance d'abord 01-fetch-shopify.js`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
  let uploaded = 0;
  let noImage = 0;
  const errors = [];

  console.log(`🖼️  Ré-hébergement de ${products.length} images vers Vercel Blob...`);

  for (const product of products) {
    if (!product.imageUrl) {
      noImage++;
      console.log(`  ⚠️  ${product.title}: pas d'image`);
      continue;
    }
    try {
      product.blobImageUrl = await rehostImage(product.imageUrl, {
        folder: "produits",
        name: product.handle || product.title,
      });
      uploaded++;
      console.log(`  ✅ ${product.title}`);
    } catch (err) {
      errors.push({ title: product.title, error: err.message });
      console.log(`  ❌ ${product.title}: ${err.message}`);
    }
  }

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));

  const stats = { uploaded, noImage, errors };
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

  console.log(`\n✅ ${uploaded} images uploadées`);
  if (noImage) console.log(`⚠️  ${noImage} produits sans image`);
  if (errors.length) console.log(`❌ ${errors.length} erreurs`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
