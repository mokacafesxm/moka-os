import {
  DB, corsHeaders,
  queryDatabase, getTitle, getText, getSelect, getDate, getNumber,
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

async function getLivraisonsAujourdhui(todaySXM) {
  const [orderPages, supplierPages] = await Promise.all([
    queryDatabase(DB.BESOINS, {
      property: "Date_Livraison_Prevue",
      date: { equals: todaySXM },
    }, null, 100),
    queryDatabase(DB.FOURNISSEURS),
  ]);

  const supplierMap = {};
  supplierPages.forEach((p) => {
    const nom = getTitle(p.properties, "Fournisseur", "Nom", "nom");
    if (p.id && nom) supplierMap[p.id] = nom;
  });

  return orderPages
    .filter((page) => getSelect(page.properties, "Statut") !== "Reçu")
    .map((page) => {
      const p = page.properties;
      const relIds = (p.Fournisseur?.relation || []).map((r) => r.id);
      return {
        id: page.id,
        fournisseur: supplierMap[relIds[0]] || getText(p, "Fournisseur") || "Fournisseur",
        produit: getTitle(p, "Besoin"),
      };
    });
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
    .map((page) => ({
      nom: getTitle(page.properties, "Prénom", "prenom", "Nom", "nom", "Name", "name", "Staff"),
      poste: getSelect(page.properties, "Poste") || "",
    }))
    .filter((s) => s.nom)
    .map(({ nom, poste }) => {
      const entry = byStaff[nom];
      if (!entry) return { nom, poste, statut: "absent", heures: 0 };
      const openMs = entry.sessionStart ? now - entry.sessionStart : 0;
      return { nom, poste, statut: entry.statut, heures: Math.round(((entry.workedMs + openMs) / 3_600_000) * 100) / 100 };
    });
}

function parseDonneesJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function daysAgoSXM(n, todaySXM) {
  const d = new Date(`${todaySXM}T00:00:00-04:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// KPIs financiers — désormais alimentés par MOKA_Sales_History (voir
// /api/imports/summary, seule route qui y écrit) et MOKA_Banque (voir
// /api/imports/bank). Marge brute et valeur stock restent `null` : aucun
// coût unitaire n'existe nulle part dans le modèle (STOCK/INGREDIENTS/
// BESOINS) pour les calculer sans inventer un chiffre.
async function getFinancialKpis(todaySXM) {
  const weekStart = daysAgoSXM(7, todaySXM);
  const monthStart = `${todaySXM.slice(0, 7)}-01`;

  const [salesPages, banquePages] = await Promise.all([
    queryDatabase(DB.SALES_HISTORY, { property: "Date", date: { on_or_after: daysAgoSXM(35, todaySXM) } }, null, 200),
    queryDatabase(DB.BANQUE, null, null, 500).catch(() => []),
  ]);

  const rows = salesPages.map((page) => {
    const p = page.properties;
    return {
      date: getDate(p, "Date"),
      type: getSelect(p, "Type"),
      caTtc: getNumber(p, "CA_TTC") || 0,
      donnees: parseDonneesJson(getText(p, "Donnees_JSON")),
    };
  });

  const quotidien = rows.filter((r) => r.type === "Quotidien" && r.date);
  const caJour = quotidien.filter((r) => r.date === todaySXM).reduce((s, r) => s + r.caTtc, 0);
  const caSemaine = quotidien.filter((r) => r.date >= weekStart).reduce((s, r) => s + r.caTtc, 0);
  const caMois = quotidien.filter((r) => r.date >= monthStart).reduce((s, r) => s + r.caTtc, 0);

  const moisRows = quotidien.filter((r) => r.date >= monthStart);
  const totalTickets = moisRows.reduce((s, r) => s + (r.donnees?.nbTickets || 0), 0);
  const totalCaMoisPourTicket = moisRows.reduce((s, r) => s + r.caTtc, 0);
  const ticketMoyenMois = totalTickets > 0 ? Math.round((totalCaMoisPourTicket / totalTickets) * 100) / 100 : null;

  const hebdo = rows.filter((r) => r.type === "Hebdomadaire" && r.date >= weekStart).sort((a, b) => (b.date > a.date ? 1 : -1));
  const produitStarSemaine = hebdo[0]?.donnees?.produitStar?.nom || null;

  const tresorerie = banquePages.length === 0
    ? null
    : banquePages.reduce((sum, page) => {
        const montant = getNumber(page.properties, "Montant") || 0;
        const type = getSelect(page.properties, "Type");
        return sum + (type === "Débit" ? -montant : montant);
      }, 0);

  return {
    ca_jour: caJour,
    ca_semaine: caSemaine,
    ca_mois: caMois,
    ticket_moyen_mois: ticketMoyenMois,
    produit_star_semaine: produitStarSemaine,
    tresorerie,
    marge_brute: null,
    valeur_stock: null,
  };
}

export async function GET() {
  try {
    const todaySXM = getSXMDateString();

    const [critiques, prepasUrgentes, livraisonsAttendues, livraisonsAujourdhui, incidentsOuverts, staffToday, financier] = await Promise.all([
      getCritiques(),
      getPrepasUrgentes(todaySXM),
      getLivraisonsAttendues(),
      getLivraisonsAujourdhui(todaySXM),
      getIncidentsOuverts(),
      getStaffToday(todaySXM),
      getFinancialKpis(todaySXM),
    ]);

    return Response.json({
      date: todaySXM,
      critiques,
      prepas_urgentes: prepasUrgentes,
      livraisons_attendues: livraisonsAttendues,
      livraisons_aujourd_hui: livraisonsAujourdhui,
      incidents_ouverts: incidentsOuverts,
      staff_today: staffToday,
      financier,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET dashboard]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
