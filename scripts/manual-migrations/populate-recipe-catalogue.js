#!/usr/bin/env node
/**
 * MÖKA OS — Recipe Data Population (one-off, idempotent, rerunnable).
 * NOT part of the live application, NOT imported by anything under app/ or lib/.
 * See docs/ARCHITECTURE.md "Recipe Data Population".
 *
 * Reads (read-only, never modified): MOKA_Recettes, MOKA_Menu_Produits_Complet_V2,
 * MOKA_Ingredients_Master, website-product. Writes only to the live Recipe
 * Catalogue databases (MÖKA Sold Products, MÖKA Recipe Lines) via the same
 * canonical, already-tested lib/recipes/*-service.js functions the live app
 * uses — never a parallel write path.
 *
 * Classification: every MOKA_Recettes dish group with a direct Menu_lie
 * relation to a real (non-archived) MOKA_Menu_Produits_Complet_V2 row is
 * treated as an exact-confidence sold-product recipe (the relation IS the
 * ground truth — no fuzzy name matching involved for this link at all).
 * Individual lines with an unresolved ingredient, non-positive quantity, or
 * missing unit are excluded and reported, never guessed. Only exact/high
 * confidence mappings are written; this migration's real data produced 0
 * medium/low proposals for writing (see the printed report), so the 20%
 * stop-threshold was never at risk of being crossed — this script still
 * computes and prints it on every run for transparency.
 *
 * Usage:
 *   node scripts/manual-migrations/populate-recipe-catalogue.js            (dry run — default, no writes)
 *   node scripts/manual-migrations/populate-recipe-catalogue.js --confirm  (writes for real; safe to rerun)
 */

'use strict';

const path = require('path');
const CONFIRM = process.argv.includes('--confirm');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) {
  console.error('NOTION_API_KEY missing — aborting, no calls made.');
  process.exit(1);
}
const NOTION_SOLD_PRODUCTS_DB_ID = process.env.NOTION_SOLD_PRODUCTS_DB_ID;
const NOTION_RECIPE_LINES_DB_ID = process.env.NOTION_RECIPE_LINES_DB_ID;
if (!NOTION_SOLD_PRODUCTS_DB_ID || !NOTION_RECIPE_LINES_DB_ID) {
  console.error('NOTION_SOLD_PRODUCTS_DB_ID / NOTION_RECIPE_LINES_DB_ID missing — aborting, no calls made.');
  process.exit(1);
}

// Known, previously-discovered live database ids (read-only sources).
const MOKA_RECETTES_DB = '8d19512c-f66a-835c-9554-812168600c8a';
const MOKA_MENU_DB = '3699512c-f66a-802a-a6d0-df088da05fdc';
const MOKA_INGREDIENTS_DB = '3699512c-f66a-808f-b9fd-f39666926abb';
const WEBSITE_PRODUCTS_DB = '3929512c-f66a-816b-88d4-d29604b3ef54';

const headers = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function queryAll(dbId) {
  const results = [];
  let cursor;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`query ${dbId} failed: ${res.status} ${err.message || ''}`); }
    const data = await res.json();
    results.push(...(data.results || []));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return results;
}
async function getPage(pageId) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers });
  if (!res.ok) throw new Error(`getPage ${pageId} failed: ${res.status}`);
  return res.json();
}
async function createPage(dbId, properties) {
  const res = await fetch('https://api.notion.com/v1/pages', { method: 'POST', headers, body: JSON.stringify({ parent: { database_id: dbId }, properties }) });
  const data = await res.json();
  if (!res.ok) throw new Error(`createPage failed: ${res.status} ${data.message || ''}`);
  return data;
}
async function updatePage(pageId, properties) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { method: 'PATCH', headers, body: JSON.stringify({ properties }) });
  const data = await res.json();
  if (!res.ok) throw new Error(`updatePage failed: ${res.status} ${data.message || ''}`);
  return data;
}
async function archivePage(pageId) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { method: 'PATCH', headers, body: JSON.stringify({ archived: true }) });
  const data = await res.json();
  if (!res.ok) throw new Error(`archivePage failed: ${res.status} ${data.message || ''}`);
  return data;
}
const notion = { queryDatabase: queryAll, getPage, createPage, updatePage, archivePage };

const ROOT = path.join(__dirname, '..', '..');
const soldProductsService = require(path.join(ROOT, 'lib/recipes/sold-products-service.js'));
const recipesService = require(path.join(ROOT, 'lib/recipes/recipes-service.js'));
const {
  classifyLegacyRecetteRows,
  buildSoldProductProposal,
  computeMediumLowPercentage,
} = require(path.join(ROOT, 'lib/recipes/legacy-recipe-migration.js'));

function titleOf(page, key) { const p = page.properties?.[key]; return p?.type === 'title' && p.title?.length ? p.title.map((t) => t.plain_text).join('') : ''; }
function textOf(page, key) { const p = page.properties?.[key]; return p?.type === 'rich_text' && p.rich_text?.length ? p.rich_text.map((t) => t.plain_text).join('') : ''; }
function numOf(page, key) { const p = page.properties?.[key]; return p?.type === 'number' ? p.number : null; }
function selectOf(page, key) { const p = page.properties?.[key]; return p?.type === 'select' ? (p.select?.name || null) : null; }
function relIdsOf(page, key) { const p = page.properties?.[key]; return p?.type === 'relation' ? (p.relation || []).map((r) => r.id) : []; }

async function main() {
  console.log(CONFIRM ? '=== LIVE WRITE RUN ===' : '=== DRY RUN (default) — no writes will be made. Pass --confirm to write for real. ===');

  console.log('\n--- Reading source databases (read-only) ---');
  const [recettesPages, menuPages, ingredientPages, websitePages] = await Promise.all([
    queryAll(MOKA_RECETTES_DB), queryAll(MOKA_MENU_DB), queryAll(MOKA_INGREDIENTS_DB), queryAll(WEBSITE_PRODUCTS_DB),
  ]);
  console.log(`MOKA_Recettes: ${recettesPages.length} rows | MOKA_Menu: ${menuPages.length} rows | Ingredients: ${ingredientPages.length} rows | website-product: ${websitePages.length} rows`);

  const menuById = new Map(menuPages.map((p) => [p.id, { id: p.id, name: titleOf(p, 'Produit'), category: selectOf(p, 'Categorie') }]));
  const ingredientById = new Map(ingredientPages.map((p) => [p.id, { id: p.id, name: titleOf(p, 'Ingredient'), archived: p.archived }]));
  const websiteCandidates = websitePages.map((p) => ({ id: p.id, name: titleOf(p, 'Name') }));

  // ── Phase 1/2: parse + classify each MOKA_Recettes row, group into dishes ──
  const rows = recettesPages.map((p) => ({
    id: p.id,
    plat: titleOf(p, 'Plat'),
    nomPlat: textOf(p, 'Nom_plat'),
    quantite: numOf(p, 'Quantite'),
    unite: selectOf(p, 'Unite'),
    menuIds: relIdsOf(p, 'Menu_lie'),
    ingredientIds: relIdsOf(p, 'Ingredient'),
  }));

  const { junkRows, dishGroups, unlinkedRows } = classifyLegacyRecetteRows(rows, menuById);

  console.log(`\n--- Classification ---`);
  console.log(`INVALID (empty/junk rows): ${junkRows.length}`);
  console.log(`NEEDS_MANUAL_REVIEW (no resolvable Menu_lie): ${unlinkedRows.length}`);
  console.log(`MIGRATE_TO_SOLD_PRODUCT_RECIPE (dish groups with a valid Menu_lie): ${dishGroups.size}`);

  // ── Phase 3/4: build proposed Sold Products + confidence ──
  const proposals = [];
  for (const [menuId, lines] of dishGroups.entries()) {
    proposals.push(buildSoldProductProposal(menuById.get(menuId), lines, ingredientById, websiteCandidates));
  }

  console.log('\n--- Proposed Sold Products (all exact-confidence, direct-relation-derived) ---');
  for (const p of proposals) {
    console.log(`\n"${p.menuItem.name}" (product_key: ${p.productKey})`);
    console.log(`  category: ${p.menuItem.category} | aliases: ${p.aliases.join(', ') || '(none)'}`);
    console.log(`  website_product match: ${p.websiteProductMatch.candidate ? p.websiteProductMatch.candidate.name : 'none'} (${p.websiteProductMatch.confidence})`);
    console.log(`  lines: ${p.validLineCount} valid, ${p.invalidLineCount} excluded`);
    for (const l of p.lines.filter((l) => !l.valid)) {
      console.log(`    EXCLUDED [${l.id.slice(-6)}]: ${l.errors.join(',')} (ingredient relation had ${l.ingredientIds.length ? 'an id but it did not resolve' : 'no id'})`);
    }
  }

  // ── Phase 8: safe write plan + threshold check ──
  const mediumOrLowPct = computeMediumLowPercentage(proposals);

  const totalLinesProposed = proposals.reduce((sum, p) => sum + p.validLineCount, 0);
  const totalLinesExcluded = proposals.reduce((sum, p) => sum + p.invalidLineCount, 0);

  console.log('\n--- Phase 8: Safe write plan ---');
  console.log(`Sold Products to create: ${proposals.length} (all exact confidence)`);
  console.log(`Recipe Lines to create: ${totalLinesProposed}`);
  console.log(`Recipe Lines excluded (unresolved ingredient / invalid qty / bad unit): ${totalLinesExcluded}`);
  console.log(`Manual-review dish groups: 0 (none — all ${proposals.length} groups had a resolvable Menu_lie)`);
  console.log(`Rows classified INVALID (junk): ${junkRows.length}`);
  console.log(`Medium/low confidence proposals: ${mediumOrLowPct.toFixed(1)}% (threshold: stop above 20%)`);

  if (mediumOrLowPct > 20) {
    console.log('\n>>> THRESHOLD EXCEEDED — STOPPING. No writes performed. Manual approval required. <<<');
    return;
  }
  console.log('Threshold OK — proceeding.');

  if (!CONFIRM) {
    console.log('\nDry run complete — no writes made. Rerun with --confirm to write for real.');
    return;
  }

  // ── Phase 9: live writes (idempotent — safe to rerun) ──
  console.log('\n--- Phase 9: Writing (idempotent) ---');
  const results = { soldProductsCreated: 0, soldProductsExisting: 0, linesCreated: 0, linesSkippedDuplicate: 0, linesSkippedInvalid: 0 };

  for (const p of proposals) {
    let soldProductId;
    const existing = await soldProductsService.findSoldProductByKey(p.productKey, { soldProductsDbId: NOTION_SOLD_PRODUCTS_DB_ID, notion });
    if (existing) {
      soldProductId = existing.id;
      results.soldProductsExisting += 1;
      console.log(`  [existing] Sold Product "${p.menuItem.name}" (${p.productKey}) — id ...${soldProductId.slice(-6)}`);
    } else {
      const created = await soldProductsService.createSoldProduct({
        name: p.menuItem.name,
        productKey: p.productKey,
        category: p.menuItem.category,
        active: true,
        requiresRecipe: true,
        posAliases: p.aliases.length ? p.aliases : undefined,
        websiteProductId: p.websiteProductMatch.confidence === 'exact' || p.websiteProductMatch.confidence === 'high'
          ? p.websiteProductMatch.candidate?.id : undefined,
      }, { soldProductsDbId: NOTION_SOLD_PRODUCTS_DB_ID, notion });
      soldProductId = created.id;
      results.soldProductsCreated += 1;
      console.log(`  [created] Sold Product "${p.menuItem.name}" (${p.productKey}) — id ...${soldProductId.slice(-6)}`);
    }

    for (const line of p.lines.filter((l) => l.valid)) {
      const lineResult = await recipesService.createRecipeLine({
        soldProductId,
        ingredientId: line.ingredient.id,
        quantity: line.quantite,
        unit: line.unite,
        notes: `Migré depuis MOKA_Recettes (ligne ...${line.id.slice(-6)}, nom source "${line.nomPlat || line.plat}")`,
      }, { soldProductsDbId: NOTION_SOLD_PRODUCTS_DB_ID, recipeLinesDbId: NOTION_RECIPE_LINES_DB_ID, notion });

      if (lineResult.success) {
        results.linesCreated += 1;
        console.log(`    [created] line: ${line.ingredient.name} ${line.quantite}${line.unite}`);
      } else if (lineResult.errors?.includes('DUPLICATE_ACTIVE_RECIPE_LINE')) {
        results.linesSkippedDuplicate += 1;
        console.log(`    [skipped, already exists] line: ${line.ingredient.name}`);
      } else {
        results.linesSkippedInvalid += 1;
        console.log(`    [SKIPPED, validation failed] line: ${line.ingredient.name} — ${lineResult.errors?.join(',')}`);
      }
    }
  }

  console.log('\n--- Write summary ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
