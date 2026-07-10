import { DB, corsHeaders, createPage, updatePage, titleProp, textProp, selectProp, numberProp, dateProp, relationProp } from "../../_notion";
import { getStripe, isStripeConfigured } from "../../_stripe";
import { isValidSlot, slotLabel, buildArticlesText, orderCodeFromPageId, isFreeOrder, resolveOrderDiscount } from "../_shared";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone, clearClientActiveReward } from "../../_clients";
import { notifyInternalNewOrder } from "../_notify";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Step 2 of checkout: called once payment is confirmed (or immediately, in
// test mode). Writes the order into the Commandes clients Notion database
// for the team to prepare, and returns the order code shown to the customer.
export async function POST(request) {
  try {
    const { items, slot, guest, paymentIntentId, testMode, comment } = await request.json();

    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "Le panier est vide" }, { status: 400, headers: corsHeaders });
    }
    if (!isValidSlot(slot)) {
      return Response.json({ error: "Créneau de retrait invalide" }, { status: 400, headers: corsHeaders });
    }
    if (!guest?.prenom || !guest?.telephone) {
      return Response.json({ error: "Prénom et téléphone requis" }, { status: 400, headers: corsHeaders });
    }

    // Re-validate independently rather than trusting whatever discount the
    // client remembers from the checkout step — the source of truth is
    // Notion (reward + order history) + the live cart, same as the checkout
    // route. First-order promo always wins over an active wheel reward when
    // both apply — never both at once. See orders/_shared.js.
    const phone = getPhoneFromRequest(request);
    const client = phone ? await findClientByPhone(phone) : null;
    const { total, rewardApplied, firstOrderApplied } = await resolveOrderDiscount({ client, phone, items });

    // Payment path is decided from the server-recomputed total, never a client
    // flag: a reward-zeroed order is free (no Stripe), otherwise a real intent
    // is required (test mode aside). This is what lets "Café offert" & co.
    // actually complete instead of erroring on a sub-minimum Stripe charge.
    let paymentReference;
    if (isFreeOrder(total)) {
      paymentReference = "OFFERT";
    } else if (testMode) {
      paymentReference = "TEST-MODE";
    } else {
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

    const trimmedComment = comment?.trim() || "";

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
      "Commentaire": textProp(trimmedComment),
    });

    const orderCode = orderCodeFromPageId(page.id);
    await updatePage(page.id, { "Commande": titleProp(orderCode) });

    // Internal WhatsApp alert to owner + chef — best-effort, never blocks the
    // order confirmation the customer is waiting on.
    notifyInternalNewOrder({
      code: orderCode,
      client: guest.prenom,
      articles: buildArticlesText(items),
      total,
      creneau: slotLabel(slot),
      comment: trimmedComment,
    }).catch((err) => console.warn("[confirm] internal alert failed:", err.message));

    if (rewardApplied) {
      await Promise.all([
        updatePage(rewardApplied.spinId, {
          "Statut": selectProp("Utilisée"),
          "Commande liée": relationProp(page.id),
        }),
        clearClientActiveReward(client.id),
      ]);
    }

    return Response.json(
      {
        orderCode,
        slotLabel: slotLabel(slot),
        total,
        rewardApplied: rewardApplied ? { reward: rewardApplied.reward, discount: rewardApplied.discount } : null,
        firstOrderApplied,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
