import { DB, corsHeaders, getPage, queryDatabase, getSelect } from "../../../_notion";
import { mapAdminOrderProps, parseArticlesText, stripePaymentUrl } from "../../_shared";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const page = await getPage(id);
    if (page?.parent?.database_id !== DB.COMMANDES_CLIENTS) {
      return Response.json({ error: "Commande introuvable" }, { status: 404, headers: corsHeaders });
    }

    const order = { id: page.id, ...mapAdminOrderProps(page.properties) };
    order.items = parseArticlesText(order.articles);
    order.stripeUrl = stripePaymentUrl(order.stripePaymentIntent);

    // Single-order lookup, so a scoped `contains` filter is cheap enough
    // here — unlike the list route, which batches this across every order.
    const rewardPages = await queryDatabase(
      DB.ROUE_CHANCE,
      { property: "Commande liée", relation: { contains: id } },
      null,
      1
    );
    order.reward = rewardPages[0] ? getSelect(rewardPages[0].properties, "Récompense") : null;

    return Response.json({ order }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[GET admin/orders/:id]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
