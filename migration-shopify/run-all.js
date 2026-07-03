#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const DATA_DIR = path.join(__dirname, "data");

function run(script) {
  console.log(`\n${"─".repeat(60)}\n▶ ${script}\n${"─".repeat(60)}`);
  execFileSync(process.execPath, [path.join(__dirname, script)], { stdio: "inherit" });
}

function readJSON(file) {
  const p = path.join(DATA_DIR, file);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf-8")) : null;
}

async function main() {
  run("01-fetch-shopify.js");
  run("02-upload-images.js");
  run("04-migrate-to-notion.js");

  const fetchStats = readJSON("stats-fetch.json") || {};
  const imageStats = readJSON("stats-images.json") || {};
  const migrateStats = readJSON("stats-migrate.json") || {};

  console.log(`\n${"═".repeat(60)}`);
  console.log("📊 RAPPORT FINAL — Migration Shopify → Notion");
  console.log("═".repeat(60));
  console.log(`Produits actifs trouvés sur Shopify : ${fetchStats.total ?? "?"}`);
  console.log(`Images ré-hébergées sur Vercel Blob  : ${imageStats.uploaded ?? "?"}`);
  console.log(`Produits migrés dans Notion          : ${migrateStats.created ?? "?"}`);
  console.log(`Produits déjà présents (ignorés)     : ${migrateStats.skippedExisting ?? "?"}`);
  console.log(`Produits sans image                  : ${migrateStats.noImage ?? "?"}`);

  const allErrors = [...(imageStats.errors || []), ...(migrateStats.errors || [])];
  console.log(`Erreurs                              : ${allErrors.length}`);
  if (allErrors.length) {
    for (const e of allErrors) console.log(`  ❌ ${e.title}: ${e.error}`);
  }
  console.log("═".repeat(60));
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
