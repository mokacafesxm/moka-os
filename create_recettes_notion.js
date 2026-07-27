#!/usr/bin/env node

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const INGREDIENTS_DB = "3699512c-f66a-808f-b9fd-f39666926abb";
const MENU_DB        = "3699512c-f66a-802a-a6d0-df088da05fdc";
const RECETTES_DB    = process.env.RECETTES_DB_ID;

if (!NOTION_API_KEY) { console.error("❌ NOTION_API_KEY manquant"); process.exit(1); }
if (!RECETTES_DB)    { console.error("❌ RECETTES_DB_ID manquant"); process.exit(1); }

const headers = {
  "Authorization": `Bearer ${NOTION_API_KEY}`,
  "Notion-Version": "2022-06-28",
  "Content-Type": "application/json",
};

async function queryAll(dbId) {
  const pages = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.object === "error") { console.error("Notion error:", data.message); break; }
    pages.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

function getTitle(props, ...keys) {
  for (const key of keys) {
    const v = props[key];
    if (!v) continue;
    if (v.type === "title")     return v.title?.[0]?.plain_text?.trim() || "";
    if (v.type === "rich_text") return v.rich_text?.[0]?.plain_text?.trim() || "";
  }
  return "";
}

async function createPage(dbId, properties) {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST", headers,
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const RECETTES = [
  {
    plat_fiche: "Carpaccio Mangue & Mozzarella",
    plat_menu:  "Mango Carpaccio",
    ingredients: [
      { nom: "Mangue",             quantite: 1,   unite: "pièce" },
      { nom: "Mozzarella",         quantite: 125, unite: "g"     },
      { nom: "Citron vert / lime", quantite: 5,   unite: "ml"    },
      { nom: "Huile d'olive",      quantite: 8,   unite: "ml"    },
      { nom: "Oignons rouges",     quantite: 5,   unite: "g"     },
      { nom: "Noix de Cajou",      quantite: 5,   unite: "g"     },
      { nom: "Basilic",            quantite: 2,   unite: "g"     },
    ],
  },
  {
    plat_fiche: "Caesar Salade",
    plat_menu:  "Möka's Caesar",
    ingredients: [
      { nom: "Salade iceberg",          quantite: 120, unite: "g"     },
      { nom: "Avocat / chair d'avocat", quantite: 60,  unite: "g"     },
      { nom: "Parmesan",                quantite: 15,  unite: "g"     },
      { nom: "Focaccia",                quantite: 40,  unite: "g"     },
      { nom: "Œufs",                    quantite: 1,   unite: "pièce" },
      { nom: "Citron jaune / lemon",    quantite: 20,  unite: "ml"    },
      { nom: "Huile d'olive",           quantite: 30,  unite: "ml"    },
    ],
  },
  {
    plat_fiche: "Écrasé d'avocat",
    plat_menu:  "Smashed Avocado",
    ingredients: [
      { nom: "Avocat / chair d'avocat",          quantite: 120, unite: "g"     },
      { nom: "Citron vert / lime",               quantite: 10,  unite: "ml"    },
      { nom: "Oignons rouges",                   quantite: 5,   unite: "g"     },
      { nom: "Coriandre",                        quantite: 2,   unite: "g"     },
      { nom: "Feta",                             quantite: 20,  unite: "g"     },
      { nom: "Dukkah",                           quantite: 4,   unite: "g"     },
      { nom: "Huile d'olive",                    quantite: 8,   unite: "ml"    },
      { nom: "Sourdough toast / pain au levain", quantite: 40,  unite: "g"     },
    ],
  },
  {
    plat_fiche: "French Toast Chocolat Fraise",
    plat_menu:  "French Toast",
    ingredients: [
      { nom: "Brioche",          quantite: 75, unite: "g"     },
      { nom: "Œufs",             quantite: 1,  unite: "pièce" },
      { nom: "Lait entier",      quantite: 60, unite: "ml"    },
      { nom: "Beurre salé",      quantite: 10, unite: "g"     },
      { nom: "Fraises fraîches", quantite: 60, unite: "g"     },
      { nom: "Amandes effilées", quantite: 5,  unite: "g"     },
    ],
  },
  {
    plat_fiche: "Bagel Saumon",
    plat_menu:  "Lox Bagel",
    ingredients: [
      { nom: "Bagels",             quantite: 1,  unite: "pièce" },
      { nom: "Saumon",             quantite: 60, unite: "g"     },
      { nom: "Fromage à tartiner", quantite: 35, unite: "g"     },
      { nom: "Aneth / dill",       quantite: 1,  unite: "g"     },
      { nom: "Citron vert / lime", quantite: 1,  unite: "g"     },
      { nom: "Oignons rouges",     quantite: 10, unite: "g"     },
      { nom: "Capres crispy",      quantite: 5,  unite: "g"     },
    ],
  },
  {
    plat_fiche: "Breakfast Burrito",
    plat_menu:  "Burrito Breakfast",
    ingredients: [
      { nom: "Wrap",                    quantite: 1,  unite: "pièce" },
      { nom: "Œufs",                    quantite: 2,  unite: "pièce" },
      { nom: "Bacon",                   quantite: 20, unite: "g"     },
      { nom: "Cheddar",                 quantite: 25, unite: "g"     },
      { nom: "Avocat / chair d'avocat", quantite: 40, unite: "g"     },
      { nom: "Haricots",                quantite: 20, unite: "g"     },
      { nom: "Chou rouge",              quantite: 20, unite: "g"     },
      { nom: "Sauce BBQ",               quantite: 15, unite: "g"     },
      { nom: "Tomates",                 quantite: 10, unite: "g"     },
      { nom: "Oignons rouges",          quantite: 5,  unite: "g"     },
      { nom: "Coriandre",               quantite: 1,  unite: "g"     },
      { nom: "Beurre salé",             quantite: 5,  unite: "g"     },
    ],
  },
  {
    plat_fiche: "Bun Bacon",
    plat_menu:  "Classic Bun",
    ingredients: [
      { nom: "Buns",           quantite: 1,  unite: "pièce" },
      { nom: "Bacon",          quantite: 40, unite: "g"     },
      { nom: "Mayonnaise",     quantite: 20, unite: "g"     },
      { nom: "Salade iceberg", quantite: 20, unite: "g"     },
      { nom: "Tomates",        quantite: 20, unite: "g"     },
      { nom: "Cheddar",        quantite: 25, unite: "g"     },
    ],
  },
];

async function main() {
  console.log("📖 Chargement des ingrédients...");
  const ingPages = await queryAll(INGREDIENTS_DB);
  const ingMap = {};
  for (const p of ingPages) {
    const nom = getTitle(p.properties, "Ingredient", "Nom", "nom");
    if (nom) ingMap[nom.toLowerCase()] = p.id;
  }
  console.log(`✅ ${Object.keys(ingMap).length} ingrédients chargés`);

  console.log("📖 Chargement du menu...");
  const menuPages = await queryAll(MENU_DB);
  const menuMap = {};
  for (const p of menuPages) {
    const nom = getTitle(p.properties, "Produit", "Nom", "nom", "Name");
    if (nom) menuMap[nom.toLowerCase()] = p.id;
  }
  console.log(`✅ ${Object.keys(menuMap).length} plats menu chargés`);
  console.log("Plats trouvés:", Object.keys(menuMap).slice(0,10).join(", "));

  let created = 0, skipped = 0;

  for (const recette of RECETTES) {
    const menuId = menuMap[recette.plat_menu.toLowerCase()];
    console.log(`\n📋 ${recette.plat_menu} ${menuId ? "✅" : "⚠️ pas trouvé dans menu"}`);

    for (const ing of recette.ingredients) {
      const ingId = ingMap[ing.nom.toLowerCase()];
      if (!ingId) {
        console.log(`  ⚠️  "${ing.nom}" non trouvé — skipped`);
        skipped++;
        continue;
      }

      const properties = {
        "Plat": { title: [{ text: { content: `${recette.plat_menu} — ${ing.nom}` } }] },
        "Ingredient": { relation: [{ id: ingId }] },
        "Quantite": { number: ing.quantite },
        "Unite": { select: { name: ing.unite } },
        "Nom_plat": { rich_text: [{ text: { content: recette.plat_menu } }] },
      };

      if (menuId) properties["Menu_lie"] = { relation: [{ id: menuId }] };

      const result = await createPage(RECETTES_DB, properties);
      if (result.object === "error") {
        console.log(`  ❌ ${ing.nom}: ${result.message}`);
      } else {
        console.log(`  ✅ ${ing.nom}: ${ing.quantite} ${ing.unite}`);
        created++;
      }
      await sleep(350);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ ${created} lignes créées`);
  console.log(`⚠️  ${skipped} ingrédients non trouvés`);
}

main().catch(console.error);
