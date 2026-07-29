'use strict';

// Database-id resolution for the Staff Planning domain (weekly schedule +
// personal task assignments) — mirrors lib/recipes/config.js's
// CONFIG_MISSING pattern. Both databases (MOKA_Planning,
// MOKA_Assignations_Taches) were created live under "MÖKA OS v2 — Bases"
// on 2026-07-29 — see docs/ARCHITECTURE.md "Weekly Staff Planning".
//
// MOKA_Assignations_Taches is deliberately its own database, NOT rows in
// MOKA_EXECUTIONS_TACHES: that database's "Statut" is read everywhere as
// "did this happen" (taches/page.jsx's doneTacheIds treats the mere
// presence of an execution row as "done", regardless of status) — a
// pending "À faire" row planted there to represent a future assignment
// would make already-live completion-tracking silently think the task was
// already handled. Keeping assignment intent in a separate database avoids
// that collision entirely.

function resolveDbId(envVar) {
  const id = process.env[envVar];
  if (!id) {
    const err = new Error(`CONFIG_MISSING: ${envVar} is not set — Planning database not configured yet`);
    err.code = 'CONFIG_MISSING';
    throw err;
  }
  return id;
}

function getPlanningDbId() {
  return resolveDbId('NOTION_PLANNING_DB_ID');
}

function getTaskAssignmentsDbId() {
  return resolveDbId('NOTION_ASSIGNATIONS_DB_ID');
}

module.exports = { getPlanningDbId, getTaskAssignmentsDbId };
