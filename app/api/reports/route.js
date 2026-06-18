import {
  DB, corsHeaders, queryDatabase,
  getTitle, getText, getSelect, getNumber, getDate, getRelationIds,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function periodFilter(period) {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }));
  let start;
  if (period === "today") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    start = new Date(now);
    const day = now.getDay();
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { property: "Date création", date: { on_or_after: start.toISOString() } };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "week";
    const filter = periodFilter(period);

    const nowSXM = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" }));
    let periodStart;
    if (period === "today") {
      periodStart = new Date(nowSXM); periodStart.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      periodStart = new Date(nowSXM);
      const day = nowSXM.getDay();
      periodStart.setDate(nowSXM.getDate() - (day === 0 ? 6 : day - 1));
      periodStart.setHours(0, 0, 0, 0);
    } else {
      periodStart = new Date(nowSXM.getFullYear(), nowSXM.getMonth(), 1);
    }
    const filterByDate = (dateStr) => dateStr && new Date(dateStr) >= periodStart;

    const [stockPages, prepsPages, besoinsPages, staffPages, fournisseurPages, clockPages] = await Promise.all([
      queryDatabase(DB.STOCK, null, null, 200),
      queryDatabase(DB.PREPS, null, null, 200),
      queryDatabase(DB.BESOINS, filter, [{ property: "Date création", direction: "descending" }], 200),
      queryDatabase(DB.STAFF, null, null, 50),
      queryDatabase(DB.FOURNISSEURS, null, null, 50),
      queryDatabase(DB.POINTAGES, { property: "Date et heure", date: { on_or_after: periodStart.toISOString() } }, [{ property: "Date et heure", direction: "ascending" }], 500),
    ]);

    // ── Stock KPIs ──────────────────────────────────────────────
    const stockItems = stockPages.map((p) => ({
      name: getTitle(p.properties, "Ingredient", "Nom", "nom"),
      qty: getNumber(p.properties, "Quantité actuelle") ?? 0,
      min: getNumber(p.properties, "Seuil minimum") ?? 0,
      category: getSelect(p.properties, "Catégorie") || "Autre",
    })).filter((i) => i.name);

    const stockCritique = stockItems.filter((i) => i.qty <= i.min && i.min > 0);
    const stockAlerte = stockItems.filter((i) => i.qty > i.min && i.qty <= i.min * 1.5 && i.min > 0);
    const totalIngredients = stockItems.length;

    // ── Preps ────────────────────────────────────────────────────
    const prepItems = prepsPages.map((p) => ({
      name: getTitle(p.properties, "Action"),
      status: getSelect(p.properties, "Statut"),
      priority: getSelect(p.properties, "Priorité"),
    })).filter((i) => i.name && i.name.length > 3);

    const prepsFait = prepItems.filter((i) => i.status === "Fait").length;
    const prepsTodo = prepItems.filter((i) => i.status === "À faire").length;
    const prepsTop = prepItems.slice(0, 8);

    // ── Commandes (BESOINS) ──────────────────────────────────────
    const fournisseurMap = {};
    fournisseurPages.forEach((p) => {
      const nom = getTitle(p.properties, "Fournisseur", "Nom");
      if (p.id && nom) fournisseurMap[p.id] = nom;
    });

    const commandes = besoinsPages.map((p) => {
      const fRelIds = getRelationIds(p.properties, "Fournisseur");
      return {
        id: p.id,
        titre: getTitle(p.properties, "Besoin"),
        statut: getSelect(p.properties, "Statut"),
        source: getSelect(p.properties, "Source"),
        fournisseur: fournisseurMap[fRelIds[0]] || getText(p.properties, "Fournisseur") || "Sans fournisseur",
        date: getDate(p.properties, "Date création") || p.created_time || "",
      };
    });

    const commandesEnvoyees = commandes.filter((c) => c.statut === "Envoyé").length;
    const commandesTotal = commandes.length;
    const commandesEnAttente = commandesTotal - commandesEnvoyees;

    const byFournisseur = {};
    commandes.forEach((c) => {
      const f = c.fournisseur || "Autre";
      if (!byFournisseur[f]) byFournisseur[f] = 0;
      byFournisseur[f]++;
    });
    const fournisseurRanking = Object.entries(byFournisseur)
      .map(([nom, count]) => ({ nom, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // ── Staff ────────────────────────────────────────────────────
    const staffList = staffPages.map((p) => ({
      id: p.id,
      nom: getTitle(p.properties, "Prénom", "Nom", "Name"),
      role: getSelect(p.properties, "Rôle") || "Staff",
      actif: p.properties["Actif"]?.checkbox ?? true,
    })).filter((s) => s.nom);

    const staffActifs = staffList.filter((s) => s.actif);

    // ── Heures travaillées ───────────────────────────────────────
    const clockEvents = clockPages.map(p => ({
      staff: getText(p.properties, "Staff") || "",
      action: getSelect(p.properties, "Action") || "",
      date: getDate(p.properties, "Date et heure") || "",
    })).filter(e => e.staff && e.date && filterByDate(e.date));

    const getDaySXM = (isoDate) =>
      new Date(isoDate).toLocaleDateString("en-CA", { timeZone: "America/Puerto_Rico" });

    const eventsByStaffDay = {};
    clockEvents.forEach(e => {
      const day = getDaySXM(e.date);
      const key = `${e.staff}__${day}`;
      if (!eventsByStaffDay[key]) eventsByStaffDay[key] = [];
      eventsByStaffDay[key].push(e);
    });

    const calculateWorkedHours = (events) => {
      let totalMs = 0;
      let state = "out";
      let lastTimestamp = null;
      let incomplete = false;
      events.forEach(e => {
        const action = e.action.toLowerCase();
        const t = new Date(e.date);
        if (action === "arrivée") {
          if (state === "out") { state = "working"; lastTimestamp = t; }
        } else if (action === "départ pause") {
          if (state === "working" && lastTimestamp) {
            totalMs += t - lastTimestamp;
            state = "paused";
            lastTimestamp = null;
          }
        } else if (action === "retour pause") {
          if (state === "paused") { state = "working"; lastTimestamp = t; }
        } else if (action === "départ") {
          if (state === "working" && lastTimestamp) totalMs += t - lastTimestamp;
          state = "out";
          lastTimestamp = null;
        }
      });
      if (state === "working") incomplete = true;
      return { hours: totalMs / (1000 * 60 * 60), incomplete };
    };

    const hoursWorkedByStaff = {};
    const hoursDetailByStaff = {};
    Object.entries(eventsByStaffDay).forEach(([key, events]) => {
      const [staffName, day] = key.split("__");
      const sorted = events.sort((a, b) => new Date(a.date) - new Date(b.date));
      const { hours, incomplete } = calculateWorkedHours(sorted);
      if (!hoursWorkedByStaff[staffName]) hoursWorkedByStaff[staffName] = 0;
      hoursWorkedByStaff[staffName] += hours;
      if (!hoursDetailByStaff[staffName]) hoursDetailByStaff[staffName] = [];
      if (hours > 0 || incomplete) hoursDetailByStaff[staffName].push({ date: day, heures: Math.round(hours * 10) / 10, incomplete });
    });

    const staffHoursStats = Object.entries(hoursWorkedByStaff)
      .map(([nom, heures]) => ({
        nom,
        heures: Math.round(heures * 10) / 10,
        detail: (hoursDetailByStaff[nom] || []).sort((a, b) => new Date(b.date) - new Date(a.date)),
      }))
      .sort((a, b) => b.heures - a.heures);

    return Response.json({
      period,
      ca: null,
      stock: {
        total: totalIngredients,
        critique: stockCritique.length,
        alerte: stockAlerte.length,
        criticalItems: stockCritique.slice(0, 5).map((i) => i.name),
      },
      preps: {
        total: prepItems.length,
        fait: prepsFait,
        todo: prepsTodo,
        top: prepsTop,
      },
      commandes: {
        total: commandesTotal,
        envoyees: commandesEnvoyees,
        enAttente: commandesEnAttente,
        aCommander: commandesEnAttente,
        byFournisseur: fournisseurRanking,
        recent: commandes.slice(0, 5),
      },
      staff: {
        total: staffList.length,
        actifs: staffActifs.length,
        presences: staffActifs,
        list: staffList,
        heures: staffHoursStats,
      },
    }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
