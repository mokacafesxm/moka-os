import {
  DB, corsHeaders,
  queryDatabase, getTitle, getText, getSelect, getDate,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function getSXMDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function isCritique(statut) {
  return String(statut || "").toLowerCase().includes("critique");
}

async function getCritiques() {
  const pages = await queryDatabase(DB.STOCK, null, null, 200);
  return pages
    .map((page) => {
      const p = page.properties;
      return {
        nom: getTitle(p, "Produit"),
        statut: getSelect(p, "Statut") || getText(p, "Statut"),
        portions: 0,
      };
    })
    .filter((item) => item.nom && isCritique(item.statut))
    .map(({ nom, portions }) => ({ nom, portions }))
    .slice(0, 10);
}

async function getPrepasUrgentes(todaySXM) {
  const pages = await queryDatabase(DB.PREPS, null, null, 200);
  return pages
    .map((page) => {
      const p = page.properties;
      return {
        nom: getTitle(p, "Action"),
        statut: getSelect(p, "Statut"),
        due: getDate(p, "Date prévue"),
      };
    })
    .filter((item) => {
      if (!item.nom || item.nom === "Préparation") return false;
      const statut = String(item.statut || "").toLowerCase();
      if (statut.includes("fait") || statut.includes("terminé")) return false;
      return !item.due || item.due <= todaySXM;
    })
    .map(({ nom, due }) => ({ nom, due }))
    .slice(0, 10);
}

async function getLivraisonsAttendues() {
  const [orderPages, supplierPages] = await Promise.all([
    queryDatabase(DB.BESOINS, { property: "Statut", select: { equals: "Envoyé" } }, null, 100),
    queryDatabase(DB.FOURNISSEURS),
  ]);

  const supplierMap = {};
  supplierPages.forEach((p) => {
    const nom = getTitle(p.properties, "Fournisseur", "Nom", "nom");
    if (p.id && nom) supplierMap[p.id] = nom;
  });

  const seen = new Set();
  const result = [];
  orderPages.forEach((page) => {
    const p = page.properties;
    const relIds = (p.Fournisseur?.relation || []).map((r) => r.id);
    const fournisseur = supplierMap[relIds[0]] || getText(p, "Fournisseur") || "Fournisseur";
    if (seen.has(fournisseur)) return;
    seen.add(fournisseur);
    result.push({ fournisseur });
  });
  return result;
}

async function getIncidentsOuverts() {
  const pages = await queryDatabase(DB.INCIDENTS, null, null, 200);
  return pages.filter((page) => {
    const statut = getSelect(page.properties, "Statut");
    return statut === "Ouvert" || statut === "En cours";
  }).length;
}

async function getStaffToday(todaySXM) {
  const [staffPages, pointagePages] = await Promise.all([
    queryDatabase(DB.STAFF, { property: "Actif", checkbox: { equals: true } }),
    queryDatabase(DB.POINTAGES, {
      property: "Date et heure",
      date: { on_or_after: `${todaySXM}T00:00:00-04:00` },
    }, [{ property: "Date et heure", direction: "ascending" }], 500),
  ]);

  const events = pointagePages
    .map((page) => {
      const p = page.properties;
      return {
        staff: getText(p, "Staff") || "",
        action: getSelect(p, "Action") || "",
        date: getDate(p, "Date et heure") || page.created_time || "",
      };
    })
    .filter((e) => e.staff && e.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const byStaff = {};
  events.forEach(({ staff, action, date }) => {
    if (!byStaff[staff]) byStaff[staff] = { statut: "absent", workedMs: 0, sessionStart: null };
    const entry = byStaff[staff];
    const a = action.toLowerCase();
    const t = new Date(date).getTime();

    if (a === "arrivée" || a === "retour pause") {
      entry.statut = "present";
      entry.sessionStart = t;
    } else if (a === "départ pause") {
      if (entry.sessionStart) entry.workedMs += t - entry.sessionStart;
      entry.sessionStart = null;
      entry.statut = "pause";
    } else if (a === "départ") {
      if (entry.sessionStart) entry.workedMs += t - entry.sessionStart;
      entry.sessionStart = null;
      entry.statut = "done";
    }
  });

  const now = Date.now();
  return staffPages
    .map((page) => getTitle(page.properties, "Prénom", "prenom", "Nom", "nom", "Name", "name", "Staff"))
    .filter(Boolean)
    .map((nom) => {
      const entry = byStaff[nom];
      if (!entry) return { nom, statut: "absent", heures: 0 };
      const openMs = entry.sessionStart ? now - entry.sessionStart : 0;
      return { nom, statut: entry.statut, heures: Math.round(((entry.workedMs + openMs) / 3_600_000) * 100) / 100 };
    });
}

export async function GET() {
  try {
    const todaySXM = getSXMDateString();

    const [critiques, prepasUrgentes, livraisonsAttendues, incidentsOuverts, staffToday] = await Promise.all([
      getCritiques(),
      getPrepasUrgentes(todaySXM),
      getLivraisonsAttendues(),
      getIncidentsOuverts(),
      getStaffToday(todaySXM),
    ]);

    return Response.json({
      date: todaySXM,
      critiques,
      prepas_urgentes: prepasUrgentes,
      livraisons_attendues: livraisonsAttendues,
      incidents_ouverts: incidentsOuverts,
      staff_today: staffToday,
      // Aucun import AddicTill réel n'a encore tourné en production (voir
      // docs/MOKA_OS_V2_BLUEPRINT.md) — pas de CA/food-cost/tickets réels à
      // rapporter tant que l'importateur n'est pas branché. Jamais inventé.
      kpi_semaine: null,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET dashboard]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
