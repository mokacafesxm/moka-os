import { DB, corsHeaders, createPage, updatePage, titleProp, textProp, selectProp, numberProp, dateProp } from "../../_notion";
import { orderCodeFromPageId } from "../_shared";
import { notifyInternalNewOrder } from "../_notify";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Staff-entered walk-in/table order — writes into the SAME Commandes clients
// Notion DB and "Nouvelle" prep-status the public /commander checkout uses
// (see app/api/orders/confirm/route.js), so it lands on the real KDS board
// (app/_components/ClientOrdersKDS.js via /api/orders/board) exactly like a
// paid online order — no parallel system. Skips Stripe/slot/reward entirely
// since this is rung up in person, not paid online; "Statut paiement" has no
// in-person option in Notion, so we mark it "Payé" and tag the payment
// reference field "STAFF-SUR-PLACE" to keep these auditable/distinguishable
// from a real Stripe charge.
export async function POST(request) {
  try {
    const { items, tableName, staffName, comment } = await request.json();

    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "La commande est vide" }, { status: 400, headers: corsHeaders });
    }

    const articles = items.map((i) => `${i.qty}x ${i.name}`).join("\n");
    const clientLabel = tableName?.trim() || (staffName ? `Commande ${staffName}` : "Commande sur place");

    const page = await createPage(DB.COMMANDES_CLIENTS, {
      "Commande": titleProp("En cours"),
      "Client": textProp(clientLabel),
      "Articles": textProp(articles),
      "Total": numberProp(0),
      "Créneau": selectProp("Dès que possible"),
      "Statut paiement": selectProp("Payé"),
      "Statut préparation": selectProp("Nouvelle"),
      "Source": selectProp("Staff Salle"),
      "Stripe Payment Intent": textProp("STAFF-SUR-PLACE"),
      "Date création": dateProp(new Date().toISOString()),
      "Commentaire": textProp(comment?.trim() || (staffName ? `Prise par ${staffName}` : "")),
    });

    const orderCode = orderCodeFromPageId(page.id);
    await updatePage(page.id, { "Commande": titleProp(orderCode) });

    notifyInternalNewOrder({
      code: orderCode,
      client: clientLabel,
      articles,
      total: 0,
      creneau: "Dès que possible",
      comment: comment?.trim() || "",
    }).catch((err) => console.warn("[staff-create] internal alert failed:", err.message));

    return Response.json({ success: true, orderCode, id: page.id }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST orders/staff-create]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
