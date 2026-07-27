'use strict';

// Database-id resolution for the Recipe Catalogue domain (Sold Product
// Catalogue + Recipe Lines) — deliberately env-var-based, mirroring
// lib/importer/notion/repository.js's CONFIG_MISSING pattern, rather than a
// hardcoded entry in app/api/_notion.js's DB map. Neither database exists
// live yet (see docs/ARCHITECTURE.md "Recipe Catalogue foundation" —
// inspection concluded the old RECETTES_DB/MENU_DB are not safely reusable
// without schema additions this task was not authorized to make live). Once
// a database is created (new, or an adopted+extended MENU_DB/RECETTES_DB),
// set these two variables — no code change is needed either way.

function resolveDbId(envVar) {
  const id = process.env[envVar];
  if (!id) {
    const err = new Error(`CONFIG_MISSING: ${envVar} is not set — Recipe Catalogue database not configured yet`);
    err.code = 'CONFIG_MISSING';
    throw err;
  }
  return id;
}

function getSoldProductsDbId() {
  return resolveDbId('NOTION_SOLD_PRODUCTS_DB_ID');
}

function getRecipeLinesDbId() {
  return resolveDbId('NOTION_RECIPE_LINES_DB_ID');
}

module.exports = { resolveDbId, getSoldProductsDbId, getRecipeLinesDbId };
