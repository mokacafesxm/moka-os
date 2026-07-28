import { DB, corsHeaders, queryDatabase, getSelect, getDate, getNumber } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

const SXM_TZ = "America/Puerto_Rico";

function monthStartSXM() {
  const nowSXM = new Date(new Date().toLocaleString("en-US", { timeZone: SXM_TZ }));
  return new Date(nowSXM.getFullYear(), nowSXM.getMonth(), 1);
}

// Sprint 15 — "Rapport mensuel" (bouton Données financières, dashboard Manager).
// CA depuis MOKA_Sales_History (jamais alimentée par le pipeline importer réel
// — voir docs/ARCHITECTURE.md — donc 0€ tant qu'aucun import n'a tourné, jamais
// une valeur inventée). Achats/commandes depuis Besoin_Fournisseurs, seule
// source de vérité existante pour les commandes fournisseurs.
export async function GET() {
  try {
    const monthStart = monthStartSXM();
    const monthStartISO = monthStart.toISOString();

    const [salesPages, besoinsPages] = await Promise.all([
      queryDatabase(DB.SALES_HISTORY, { property: "Date", date: { on_or_after: monthStartISO } }, null, 500),
      queryDatabase(DB.BESOINS, { property: "Date création", date: { on_or_after: monthStartISO } }, null, 500),
    ]);

    const caMois = salesPages.reduce((sum, page) => sum + (getNumber(page.properties, "CA_TTC") || 0), 0);

    const besoins = besoinsPages.map((page) => ({
      statut: getSelect(page.properties, "Statut"),
      date: getDate(page.properties, "Date création"),
    }));

    const achatsFournisseurs = besoins.length;
    const commandesPassees = besoins.filter((b) => b.statut === "Envoyé" || b.statut === "Reçu").length;
    const commandesRecues = besoins.filter((b) => b.statut === "Reçu").length;

    return Response.json({
      periodeDebut: monthStart.toISOString().slice(0, 10),
      caMois,
      achatsFournisseurs,
      commandesPassees,
      commandesRecues,
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET reports/monthly-summary]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
