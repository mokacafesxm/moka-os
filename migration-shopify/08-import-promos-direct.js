#!/usr/bin/env node
// One-off script: the 2 real promo banners, scraped directly from mokacafe.co's
// public CDN (same approach as 06-import-categories-direct.js).
const { rehostImage } = require("./lib/blob");
const { queryAll, createPage, updatePage } = require("./lib/notion");

const PROMOS = [
  {
    name: "Promo -20% en ligne (1)",
    imageUrl:
      "https://mokacafe.co/cdn/shop/files/Up_to_-20_on_your_online_order_2_29236f79-7eda-498d-9ef6-923283856168.png?v=1778763578",
    ordre: 1,
  },
  {
    name: "Promo -20% en ligne (2)",
    imageUrl:
      "https://mokacafe.co/cdn/shop/files/Up_to_-20_on_your_online_order_1_9b11cf70-7fc7-4f11-86df-647c15613383.png?v=1777994220",
    ordre: 2,
  },
];

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const dbId = process.env.NOTION_PROMOS_DB_ID;
  if (!dbId) {
    console.error("❌ NOTION_PROMOS_DB_ID manquant");
    process.exit(1);
  }

  console.log("📖 Chargement des promos existantes...");
  const existingPages = await queryAll(dbId);
  const existingByName = new Map();
  for (const p of existingPages) {
    const nom = p.properties["Nom"]?.title?.[0]?.plain_text;
    if (nom) existingByName.set(nom.trim().toLowerCase(), p.id);
  }

  let created = 0;
  let updated = 0;
  const errors = [];

  for (const promo of PROMOS) {
    try {
      console.log(`⬇️  ${promo.name}: téléchargement + upload Blob...`);
      const blobUrl = await rehostImage(promo.imageUrl, { folder: "promos", name: slugify(promo.name) });

      const properties = {
        Nom: { title: [{ text: { content: promo.name } }] },
        Image: { files: [{ type: "external", name: "photo", external: { url: blobUrl } }] },
        Actif: { checkbox: true },
        Ordre: { number: promo.ordre },
      };

      const existingId = existingByName.get(promo.name.trim().toLowerCase());
      if (existingId) {
        await updatePage(existingId, properties);
        console.log(`  🔄 mise à jour (ordre ${promo.ordre})`);
        updated++;
      } else {
        const result = await createPage(dbId, properties);
        if (result.object === "error") throw new Error(result.message);
        console.log(`  ➕ créée (ordre ${promo.ordre})`);
        created++;
      }
    } catch (err) {
      errors.push({ name: promo.name, error: err.message });
      console.log(`  ❌ ${promo.name}: ${err.message}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`➕ ${created} promos créées`);
  console.log(`🔄 ${updated} promos mises à jour`);
  console.log(`❌ ${errors.length} erreurs`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
