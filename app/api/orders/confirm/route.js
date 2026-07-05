import { DB, corsHeaders, createPage, updatePage, titleProp, textProp, selectProp, numberProp, dateProp } from "../../_notion";
import { getStripe, isStripeConfigured } from "../../_stripe";
import { isValidSlot, slotLabel, computeTotal, buildArticlesText, orderCodeFromPageId } from "../_shared";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Step 2 of checkout: called once payment is confirmed (or immediately, in
// test mode). Writes the order into the Commandes clients Notion database
// for the team to prepare, and returns the order code shown to the customer.
export async function POST(request) {
  try {
    const { items, slot, guest, paymentIntentId, testMode } = await request.json();

    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "Le panier est vide" }, { status: 400, headers: corsHeaders });
    }
    if (!isValidSlot(slot)) {
      return Response.json({ error: "Créneau de retrait invalide" }, { status: 400, headers: corsHeaders });
    }
    if (!guest?.prenom || !guest?.telephone) {
      return Response.json({ error: "Prénom et téléphone requis" }, { status: 400, headers: corsHeaders });
    }

    let paymentReference = "TEST-MODE";
    if (!testMode) {
      if (!isStripeConfigured()) {
        return Response.json({ error: "Paiement non configuré" }, { status: 503, headers: corsHeaders });
      }
      if (!paymentIntentId) {
        return Response.json({ error: "Paiement introuvable" }, { status: 400, headers: corsHeaders });
      }
      const stripe = getStripe();
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== "succeeded") {
        return Response.json({ error: "Le paiement n'a pas abouti" }, { status: 402, headers: corsHeaders });
      }
      paymentReference = intent.id;
    }

    const total = computeTotal(items);

    const page = await createPage(DB.COMMANDES_CLIENTS, {
      "Commande": titleProp("En cours"),
      "Client": textProp(guest.prenom),
      "Téléphone": { phone_number: guest.telephone },
      "Articles": textProp(buildArticlesText(items)),
      "Total": numberProp(total),
      "Créneau": selectProp(slotLabel(slot)),
      "Statut paiement": selectProp("Payé"),
      "Statut préparation": selectProp("Nouvelle"),
      "Stripe Payment Intent": textProp(paymentReference),
      "Date création": dateProp(new Date().toISOString()),
    });

    const orderCode = orderCodeFromPageId(page.id);
    await updatePage(page.id, { "Commande": titleProp(orderCode) });

    return Response.json({ orderCode, slotLabel: slotLabel(slot) }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
