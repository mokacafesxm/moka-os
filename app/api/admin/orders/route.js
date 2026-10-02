import { DB, corsHeaders, queryDatabase, getText, getNumber, getDate, getRelationIds, getSelect } from "../../_notion";
import {
  mapAdminOrderProps,
  parseArticlesText,
  stripePaymentUrl,
  round2,
  startOfTodayPR,
  startOfWeekPR,
  startOfMonthPR,
} from "../_shared";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

const DEFAULT_RANGE_DAYS = 30;

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

// One batch query covering every reward ever redeemed, rather than one
// lookup per order — Notion's rate limit (~2.9 req/s, see _notion.js) makes
// an N+1 here a real cost, and reward volume is low (big wins are weekly-
// capped, see wheel/_shared.js) so a single unfiltered query stays cheap.
async function fetchRewardByOrderId() {
  const pages = await queryDatabase(DB.ROUE_CHANCE, {
    property: "Commande liée",
    relation: { is_not_empty: true },
  });
  const map = {};
  for (const p of pages) {
    const orderId = getRelationIds(p.properties, "Commande liée")[0];
    if (orderId) map[orderId] = getSelect(p.properties, "Récompense");
  }
  return map;
}

// Lists orders in [from, to] (default: last 30 days) optionally filtered by
// status, then narrows by free-text search (code/client/phone) in JS —
// Notion's phone_number filter has no "contains", so a partial phone search
// can't be expressed server-side. Also returns two kinds of stats: CA jour/
// semaine/mois (a fixed dashboard snapshot, independent of the filters —
// needs its own month-to-date query since the main range can be narrower or
// wider than a calendar month) and nb commandes/panier moyen/top 5 produits
// (computed from the currently filtered set).
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") || isoDaysAgo(DEFAULT_RANGE_DAYS);
    const to = searchParams.get("to") || new Date().toISOString();
    const status = searchParams.get("status") || "";
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    const filter = {
      and: [
        { property: "Date création", date: { on_or_after: from } },
        { property: "Date création", date: { on_or_before: to } },
        ...(status ? [{ property: "Statut préparation", select: { equals: status } }] : []),
      ],
    };

    const [pages, rewardByOrderId, monthPages] = await Promise.all([
      queryDatabase(DB.COMMANDES_CLIENTS, filter),
      fetchRewardByOrderId(),
      queryDatabase(DB.COMMANDES_CLIENTS, {
        property: "Date création",
        date: { on_or_after: startOfMonthPR() },
      }),
    ]);

    let orders = pages.map((p) => ({
      id: p.id,
      ...mapAdminOrderProps(p.properties),
      reward: rewardByOrderId[p.id] || null,
      stripeUrl: stripePaymentUrl(getText(p.properties, "Stripe Payment Intent")),
    }));

    if (q) {
      const qDigits = q.replace(/\s+/g, "");
      orders = orders.filter(
        (o) =>
          o.code.toLowerCase().includes(q) ||
          o.client.toLowerCase().includes(q) ||
          o.telephone.replace(/\s+/g, "").includes(qDigits)
      );
    }

    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const nbCommandes = orders.length;
    const caFiltered = orders.reduce((sum, o) => sum + o.total, 0);
    const panierMoyen = nbCommandes ? round2(caFiltered / nbCommandes) : 0;

    const productCounts = {};
    for (const o of orders) {
      for (const item of parseArticlesText(o.articles)) {
        productCounts[item.name] = (productCounts[item.name] || 0) + item.qty;
      }
    }
    const top5 = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    const todayStart = startOfTodayPR();
    const weekStart = startOfWeekPR();
    let caJour = 0;
    let caSemaine = 0;
    let caMois = 0;
    for (const p of monthPages) {
      const total = getNumber(p.properties, "Total");
      const createdAt = getDate(p.properties, "Date création");
      caMois += total;
      if (createdAt >= weekStart) caSemaine += total;
      if (createdAt >= todayStart) caJour += total;
    }

    return Response.json(
      {
        orders,
        stats: {
          caJour: round2(caJour),
          caSemaine: round2(caSemaine),
          caMois: round2(caMois),
          nbCommandes,
          panierMoyen,
          top5,
        },
      },
      { headers: { ...corsHeaders, "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[GET admin/orders]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
