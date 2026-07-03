#!/usr/bin/env node
// One-off script: the 9 real customer-facing menu categories, with photo URLs
// scraped directly from mokacafe.co's public HTML (the Admin GraphQL API had
// no accessible metafield or `image` field for these — see 07-inspect-collection-metafields.js).
const fs = require("fs");
const path = require("path");
const { rehostImage } = require("./lib/blob");
const { queryAll, createPage, updatePage } = require("./lib/notion");

const STATS_FILE = path.join(__dirname, "data", "stats-categories-direct.json");

const CATEGORIES = [
  { name: "ICED COFFEEs", imageUrl: "https://mokacafe.co/cdn/shop/files/MOKAINSTA-8.png?v=1773165290" },
  { name: "ICED MATCHA & UBE", imageUrl: "https://mokacafe.co/cdn/shop/files/MOKA_INSTA_-_9.png?v=1773077186" },
  {
    name: "SMOOTHIEs & JUICEs",
    imageUrl: "https://mokacafe.co/cdn/shop/files/MOKA_INSTA_-_10_0fa8725c-45c1-48b7-a58e-fd57e2b57dda.png?v=1773164775",
  },
  { name: "MILKSHAKES", imageUrl: "https://mokacafe.co/cdn/shop/files/PHOTO-2026-03-11-15-21-58.jpg?v=1773260539" },
  { name: "COFFEE's and TEA's", imageUrl: "https://mokacafe.co/cdn/shop/files/MOKA_INSTA_-_13.png?v=1773077330" },
  { name: "SMALL BITES", imageUrl: "https://mokacafe.co/cdn/shop/files/92298b36-2369-43e7-b453-6171e9b8fdec.jpg?v=1776013443" },
  { name: "BIG BITES", imageUrl: "https://mokacafe.co/cdn/shop/files/MOKAINSTA-31.png?v=1776013877" },
  { name: "BOWLS", imageUrl: "https://mokacafe.co/cdn/shop/files/MOKAINSTA-37.png?v=1773108363" },
  { name: "SWEET", imageUrl: "https://mokacafe.co/cdn/shop/files/1ecde08a-113b-4fae-8db9-9bd868487692.jpg?v=1776013558" },
].map((c, i) => ({ ...c, ordre: i + 1 }));

// Public storefront category names don't always match the Shopify Admin
// collection titles we seeded earlier (punctuation/plural differences) —
// map the mismatches explicitly rather than guessing with fuzzy matching.
const ALIASES = {
  "iced matcha & ube": "iced matcha &ube",
  "coffee's and tea's": "coffees & teas",
  sweet: "sweets",
};

// Categories confirmed NOT to be real customer-facing menu categories
// (leftover Shopify Admin/internal artifacts) — archived after the upsert.
const TO_ARCHIVE = ["SIDES", "Coffee", "DRINKS", "BEST SELLER", "AMAZING JUICEs", "FOOD"];

function normalize(name) {
  return String(name).trim().toLowerCase();
}

function resolveKey(name) {
  const n = normalize(name);
  return ALIASES[n] || n;
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const dbId = process.env.NOTION_CATEGORIES_DB_ID;
  if (!dbId) {
    console.error("❌ NOTION_CATEGORIES_DB_ID manquant");
    process.exit(1);
  }

  console.log("📖 Chargement des catégories existantes...");
  const existingPages = await queryAll(dbId);
  const existingByKey = new Map();
  for (const p of existingPages) {
    const nom = p.properties["Nom"]?.title?.[0]?.plain_text;
    if (nom) existingByKey.set(normalize(nom), { id: p.id, nom });
  }
  console.log(`✅ ${existingByKey.size} catégories existantes\n`);

  let created = 0;
  let updated = 0;
  const errors = [];

  for (const cat of CATEGORIES) {
    try {
      console.log(`⬇️  ${cat.name}: téléchargement + upload Blob...`);
      const blobUrl = await rehostImage(cat.imageUrl, { folder: "categories", name: slugify(cat.name) });

      const key = resolveKey(cat.name);
      const existing = existingByKey.get(key);

      if (existing) {
        await updatePage(existing.id, {
          Photo: { files: [{ type: "external", name: "photo", external: { url: blobUrl } }] },
          Ordre: { number: cat.ordre },
        });
        console.log(`  🔄 mise à jour de la page existante "${existing.nom}" (ordre ${cat.ordre})`);
        updated++;
      } else {
        await createPage(dbId, {
          Nom: { title: [{ text: { content: cat.name } }] },
          Photo: { files: [{ type: "external", name: "photo", external: { url: blobUrl } }] },
          Ordre: { number: cat.ordre },
        });
        console.log(`  ➕ création "${cat.name}" (ordre ${cat.ordre})`);
        created++;
      }
    } catch (err) {
      errors.push({ name: cat.name, error: err.message });
      console.log(`  ❌ ${cat.name}: ${err.message}`);
    }
  }

  console.log(`\n🗑️  Archivage des catégories non réelles...`);
  let archived = 0;
  for (const name of TO_ARCHIVE) {
    const existing = existingByKey.get(normalize(name));
    if (!existing) {
      console.log(`  ⏭️  ${name}: introuvable (déjà absente ?)`);
      continue;
    }
    try {
      const res = await fetch(`https://api.notion.com/v1/pages/${existing.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.NOTION_TOKEN || process.env.NOTION_API_KEY}`,
          "Notion-Version": process.env.NOTION_VERSION || "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ archived: true }),
      });
      const data = await res.json();
      if (data.object === "error") throw new Error(data.message);
      console.log(`  ✅ ${name}: archivée`);
      archived++;
    } catch (err) {
      errors.push({ name, error: err.message });
      console.log(`  ❌ ${name}: ${err.message}`);
    }
  }

  const stats = { created, updated, archived, errors };
  fs.mkdirSync(path.dirname(STATS_FILE), { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));

  console.log(`\n${"=".repeat(50)}`);
  console.log(`➕ ${created} catégories créées`);
  console.log(`🔄 ${updated} catégories mises à jour (photo + ordre)`);
  console.log(`🗑️  ${archived} catégories archivées (non réelles)`);
  console.log(`❌ ${errors.length} erreurs`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
