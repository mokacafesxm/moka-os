'use strict';

// Database-id resolution for the Staff Planning domain (weekly schedule +
// personal task assignments) — mirrors lib/recipes/config.js's
// CONFIG_MISSING pattern. Neither database exists live yet (no parent
// Notion page was designated to create them under, and creating a new
// top-level database in the user's live workspace isn't something to do
// unprompted). Once each is created and its id set via the matching env
// var, no code change is needed — see docs/ARCHITECTURE.md "Weekly Staff
// Planning".
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
  return resolveDbId('NOTION_TASK_ASSIGNMENTS_DB_ID');
}

module.exports = { getPlanningDbId, getTaskAssignmentsDbId };
