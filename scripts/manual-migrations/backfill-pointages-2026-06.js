#!/usr/bin/env node
/**
 * MANUAL, HUMAN-RUN BACKFILL — NOT part of the live MÖKA OS application.
 *
 * Quarantined here (Architecture Ownership Audit, section 5) from an
 * untracked root-level `create_pointages.js` that hardcoded the Pointages
 * database id (identical to DB.POINTAGES in app/api/_notion.js) and wrote
 * directly to production Notion with no dry-run, no confirmation step, and
 * no relationship to the live app's clock-in/out logic (`/api/clock`).
 *
 * This script backfills theoretical clock-in/out entries for a fixed staff
 * planning table, 2026-06-01 through 2026-06-18. It is NOT idempotent and
 * NOT part of any CI/test run — running it twice creates duplicate
 * Pointages entries. Do not run it against production without independently
 * verifying (in Notion) that this exact backfill has not already been
 * applied for this date range.
 *
 * Usage:
 *   NOTION_API_KEY=... MANUAL_MIGRATION_POINTAGES_DB_ID=... node scripts/manual-migrations/backfill-pointages-2026-06.js
 *     → dry run (default): prints every planned write, calls Notion nowhere.
 *   ... node scripts/manual-migrations/backfill-pointages-2026-06.js --confirm
 *     → actually writes to Notion.
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const POINTAGES_DB = process.env.MANUAL_MIGRATION_POINTAGES_DB_ID;
const CONFIRM = process.argv.includes("--confirm");

if (!CONFIRM) {
  console.log("🧪 DRY RUN (default) — no Notion calls will be made. Pass --confirm to write for real.\n");
}
if (CONFIRM && !NOTION_API_KEY) {
  console.error("❌ NOTION_API_KEY manquant (requis uniquement avec --confirm)");
  process.exit(1);
}
if (CONFIRM && !POINTAGES_DB) {
  console.error("❌ MANUAL_MIGRATION_POINTAGES_DB_ID manquant (requis uniquement avec --confirm) — ne réutilise jamais un id codé en dur.");
  process.exit(1);
}

const headers = CONFIRM
  ? { Authorization: `Bearer ${NOTION_API_KEY}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" }
  : null;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// 0=Lundi 1=Mardi 2=Mercredi 3=Jeudi 4=Vendredi 5=Samedi 6=Dimanche
// [arrivee, depart, pause_debut, pause_fin] ou null=OFF
const PLANNING = {
  "Beyonce":  { 0:["06:45","14:45","11:00","11:20"], 1:["06:45","14:45","11:00","11:20"], 2:["06:45","14:45","11:00","11:20"], 3:["06:45","14:45","11:00","11:20"], 4:null, 5:null, 6:["06:45","14:45","11:00","11:20"] },
  "Quincy":   { 0:["09:30","17:00","13:00","13:20"], 1:["09:30","17:00","13:00","13:20"], 2:null, 3:null, 4:["06:45","14:45","11:00","11:20"], 5:["06:45","14:45","11:00","11:20"], 6:["09:30","17:00","13:00","13:20"] },
  "Aby":      { 0:null, 1:null, 2:["09:30","17:00","13:00","13:20"], 3:["09:30","17:00","13:00","13:20"], 4:["09:30","17:00","13:00","13:20"], 5:["09:30","17:00","13:00","13:20"], 6:null },
  "Jeanne":   { 0:["06:45","13:45","10:00","10:20"], 1:["06:45","13:45","10:00","10:20"], 2:null, 3:["06:45","13:45","10:00","10:20"], 4:["06:45","13:45","10:00","10:20"], 5:["06:45","13:45","10:00","10:20"], 6:["06:45","13:45","10:00","10:20"] },
  "Mme Jean": { 0:["09:00","17:00","12:30","13:30"], 1:null, 2:["13:00","17:00",null,null], 3:["09:00","17:00","12:30","13:30"], 4:["09:00","17:00","12:30","13:30"], 5:["09:00","17:00","12:30","13:30"], 6:["09:00","17:00","12:30","13:30"] },
};

const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

function buildDateTime(dateStr, timeStr) { return `${dateStr}T${timeStr}:00-04:00`; }

async function createPointage(staff, action, isoDate) {
  if (!CONFIRM) return { dryRun: true };
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers,
    body: JSON.stringify({
      parent: { database_id: POINTAGES_DB },
      properties: {
        "Pointage": { title: [{ text: { content: `${staff} - ${action}` } }] },
        "Staff": { rich_text: [{ text: { content: staff } }] },
        "Action": { select: { name: action } },
        "Date et heure": { date: { start: isoDate } },
      },
    }),
  });
  const data = await res.json();
  if (data.object === "error") throw new Error(data.message);
  return data;
}

function getDates() {
  const dates = [];
  const start = new Date("2026-06-01");
  const end = new Date("2026-06-18");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
    dates.push({ dateStr: `${y}-${m}-${day}`, weekday: wd });
  }
  return dates;
}

async function main() {
  const dates = getDates();
  let total = 0;
  console.log(`🚀 ${CONFIRM ? "Création" : "[DRY RUN] Simulation de création"} pointages théoriques 1→18 juin 2026\n`);

  for (const staff of Object.keys(PLANNING)) {
    console.log(`\n👤 ${staff}`);
    for (const { dateStr, weekday } of dates) {
      const p = PLANNING[staff][weekday];
      if (!p) continue;
      const [arr, dep, pd, pf] = p;
      const events = [{ action: "Arrivée", time: arr }];
      if (pd && pf) {
        events.push({ action: "Départ pause", time: pd });
        events.push({ action: "Retour pause", time: pf });
      }
      events.push({ action: "Départ", time: dep });
      process.stdout.write(`  ${dateStr} (${JOURS[weekday]}): `);
      for (const e of events) {
        try {
          await createPointage(staff, e.action, buildDateTime(dateStr, e.time));
          process.stdout.write(CONFIRM ? "✓ " : "(dry) ");
          total++;
        } catch (err) {
          process.stdout.write("❌ ");
          console.error("\n  Erreur:", err.message);
        }
        if (CONFIRM) await sleep(300);
      }
      console.log("");
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ ${total} entrées ${CONFIRM ? "créées dans MOKA_Pointages" : "qui SERAIENT créées (dry run — rien n'a été écrit)"}`);
}

main().catch(console.error);
