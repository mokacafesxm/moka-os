#!/usr/bin/env node
const { getDatabase } = require("./lib/notion");

async function main() {
  const dbId = process.env.NOTION_PRODUCTS_DB_ID;
  if (!dbId) {
    console.error("❌ NOTION_PRODUCTS_DB_ID manquant");
    process.exit(1);
  }

  const db = await getDatabase(dbId);
  const title = db.title?.[0]?.plain_text || "(sans titre)";

  console.log(`📋 Base Notion : ${title} (${dbId})\n`);
  console.log("Propriétés :");

  for (const [name, prop] of Object.entries(db.properties)) {
    let detail = "";
    if (prop.type === "select") {
      detail = ` — options: ${prop.select.options.map((o) => o.name).join(", ") || "(aucune)"}`;
    } else if (prop.type === "multi_select") {
      detail = ` — options: ${prop.multi_select.options.map((o) => o.name).join(", ") || "(aucune)"}`;
    } else if (prop.type === "relation") {
      detail = ` — relation vers database ${prop.relation.database_id}`;
    }
    console.log(`  - "${name}" : ${prop.type}${detail}`);
  }

  console.log("\n👉 Utilise ces noms exacts dans notion-mapping.json avant de lancer 04-migrate-to-notion.js");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
