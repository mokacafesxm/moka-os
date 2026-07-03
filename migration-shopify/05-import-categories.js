#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { fetchAllCollections } = require("./lib/shopify");
const { rehostImage } = require("./lib/blob");
const { queryAll, createPage, updatePage, getDatabase, getPropertyType } = require("./lib/notion");

const STATS_FILE = path.join(__dirname, "data", "stats-categories.json");

// Shopify's automatically-generated catch-all collections, and internal/POS-only
// groupings, aren't real customer-facing menu categories.
const EXCLUDED_TITLES = new Set([
  "home page",
  "frontpage",
  "home",
  "accueil",
  "all",
  "all products",
  "tous les produits",
  "catalog",
  "catalogue",
  "pos cafe - modifiers",
  "simmer: möka café",
]);

function isExcluded(title) {
  return EXCLUDED_TITLES.has(String(title).trim().toLowerCase());
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const dbId = process.env.NOTION_CATEGORIES_DB_ID;
  if (!dbId) {
    console.error("❌ NOTION_CATEGORIES_DB_ID manquant");
    process.exit(1);
  }

  console.log("📂 Récupération des collections Shopify...");
  const allCollections = await fetchAllCollections({
    onPage: (page, total) => console.log(`  ...${total} collections récupérées`),
  });

  const menuCollections = allCollections.filter((c) => !isExcluded(c.title));
  menuCollections.forEach((c, i) => (c.order = i + 1));

  console.log(
    `✅ ${allCollections.length} collections trouvées, ${menuCollections.length} retenues ` +
      `(${allCollections.length - menuCollections.length} exclues)\n`
  );

  console.log("📋 Lecture du schema de la base Catégories Website...");
  const schema = await getDatabase(dbId);
  if (!getPropertyType(schema, "Nom") || !getPropertyType(schema, "Photo") || !getPropertyType(schema, "Ordre")) {
    throw new Error('Propriétés "Nom", "Photo" ou "Ordre" introuvables dans la base Catégories Website');
  }

  console.log("📖 Chargement des catégories déjà présentes...");
  const existingPages = await queryAll(dbId);
  const existingByTitle = new Map();
  for (const p of existingPages) {
    const title = p.properties["Nom"]?.title?.[0]?.plain_text?.trim().toLowerCase();
    if (title) existingByTitle.set(title, { id: p.id, hasPhoto: !!p.properties["Photo"]?.files?.length });
  }
  console.log(`✅ ${existingByTitle.size} catégories déjà présentes\n`);

  let createdWithPhoto = 0;
  let createdNoPhoto = 0;
  let updatedPhoto = 0;
  let skippedExisting = 0;
  const errors = [];

  for (const collection of menuCollections) {
    const existing = existingByTitle.get(collection.title.trim().toLowerCase());

    try {
      if (existing) {
        if (existing.hasPhoto || !collection.imageUrl) {
          console.log(`  ⏭️  ${collection.title}: déjà présente${existing.hasPhoto ? "" : " (toujours sans photo)"}`);
          skippedExisting++;
          continue;
        }
        const blobUrl = await rehostImage(collection.imageUrl, {
          folder: "categories",
          name: collection.handle || collection.title,
        });
        await updatePage(existing.id, {
          Photo: { files: [{ type: "external", name: "photo", external: { url: blobUrl } }] },
        });
        console.log(`  🖼️  ${collection.title}: photo ajoutée`);
        updatedPhoto++;
      } else {
        const properties = {
          Nom: { title: [{ text: { content: collection.title } }] },
          Ordre: { number: collection.order },
        };
        if (collection.imageUrl) {
          const blobUrl = await rehostImage(collection.imageUrl, {
            folder: "categories",
            name: collection.handle || collection.title,
          });
          properties.Photo = { files: [{ type: "external", name: "photo", external: { url: blobUrl } }] };
        }
        const result = await createPage(dbId, properties);
        if (result.object === "error") throw new Error(result.message);

        if (collection.imageUrl) {
          console.log(`  ✅ ${collection.title} (ordre ${collection.order}, avec photo)`);
          createdWithPhoto++;
        } else {
          console.log(`  ➕ ${collection.title} (ordre ${collection.order}, sans photo — placeholder)`);
          createdNoPhoto++;
        }
      }
    } catch (err) {
      errors.push({ title: collection.title, error: err.message });
      console.log(`  ❌ ${collection.title}: ${err.message}`);
    }
    await sleep(350);
  }

  const stats = {
    total: menuCollections.length,
    createdWithPhoto,
    createdNoPhoto,
    updatedPhoto,
    skippedExisting,
    errors,
  };
  fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ ${createdWithPhoto} créées avec photo`);
  console.log(`➕ ${createdNoPhoto} créées sans photo (placeholder en attendant)`);
  console.log(`🖼️  ${updatedPhoto} mises à jour (photo ajoutée à une catégorie existante)`);
  console.log(`⏭️  ${skippedExisting} inchangées`);
  console.log(`❌ ${errors.length} erreurs`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
