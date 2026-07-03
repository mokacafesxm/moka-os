#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { getDatabase, queryAll, createPage, buildPropertyValue, getPropertyType } = require("./lib/notion");

const PRODUCTS_FILE = path.join(__dirname, "data", "products.json");
const MAPPING_FILE = path.join(__dirname, "notion-mapping.json");
const STATS_FILE = path.join(__dirname, "data", "stats-migrate.json");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getTitlePropertyName(schema) {
  const entry = Object.entries(schema.properties).find(([, p]) => p.type === "title");
  return entry ? entry[0] : null;
}

function getPageTitle(page, titlePropName) {
  return page.properties[titlePropName]?.title?.[0]?.plain_text?.trim() || "";
}

function buildProperties(product, mapping, schema) {
  const values = {
    nom: product.title,
    description: product.description,
    prix: product.price,
    variantes: JSON.stringify(product.variants, null, 2),
    categorie: product.category,
    photo: product.blobImageUrl || product.imageUrl,
    disponible: product.available,
  };

  const properties = {};
  for (const [key, propName] of Object.entries(mapping)) {
    if (key.startsWith("_") || !propName) continue;
    const value = values[key];
    if (value === null || value === undefined || value === "") continue;

    const type = getPropertyType(schema, propName);
    if (!type) {
      console.log(`  ⚠️  propriété "${propName}" (${key}) introuvable dans la base Notion — ignorée`);
      continue;
    }
    const built = buildPropertyValue(type, value);
    if (built) properties[propName] = built;
  }
  return properties;
}

async function main() {
  const dbId = process.env.NOTION_PRODUCTS_DB_ID;
  if (!dbId) {
    console.error("❌ NOTION_PRODUCTS_DB_ID manquant");
    process.exit(1);
  }
  if (!fs.existsSync(PRODUCTS_FILE)) {
    console.error(`❌ ${PRODUCTS_FILE} introuvable — lance d'abord 01-fetch-shopify.js et 02-upload-images.js`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf-8"));
  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, "utf-8"));

  console.log("📋 Lecture du schema de la base Notion Produits...");
  const schema = await getDatabase(dbId);
  const titlePropName = getTitlePropertyName(schema);
  if (!titlePropName) throw new Error("Impossible de trouver la propriété titre de la base Notion");

  console.log("📖 Chargement des pages existantes (déduplication)...");
  const existingPages = await queryAll(dbId);
  const existingTitles = new Set(existingPages.map((p) => getPageTitle(p, titlePropName).toLowerCase()));
  console.log(`✅ ${existingTitles.size} pages déjà présentes\n`);

  let created = 0;
  let skippedExisting = 0;
  let noImage = 0;
  const errors = [];

  for (const product of products) {
    if (existingTitles.has(product.title.toLowerCase())) {
      console.log(`  ⏭️  ${product.title}: déjà migré`);
      skippedExisting++;
      continue;
    }
    if (!product.blobImageUrl && !product.imageUrl) noImage++;

    try {
      const properties = buildProperties(product, mapping, schema);
      const result = await createPage(dbId, properties);
      if (result.object === "error") throw new Error(result.message);
      console.log(`  ✅ ${product.title}`);
      created++;
    } catch (err) {
      errors.push({ title: product.title, error: err.message });
      console.log(`  ❌ ${product.title}: ${err.message}`);
    }
    await sleep(350);
  }

  const stats = { created, skippedExisting, noImage, errors, total: products.length };
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ ${created} produits migrés`);
  console.log(`⏭️  ${skippedExisting} déjà présents (ignorés)`);
  console.log(`⚠️  ${noImage} sans image`);
  console.log(`❌ ${errors.length} erreurs`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
