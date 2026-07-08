import { DB, corsHeaders, getPage, updatePage, selectProp, dateProp, getSelect, getTitle, getText } from "../../_notion";
import { nextPrepStatus } from "../_shared";
import { notifyClientOrderReady } from "../_notify";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Advance an order one step: Nouvelle → En préparation → Prête → Récupérée.
// Re-reads the current status from Notion first so two devices tapping at
// once can't double-advance. On "Prête", fires the client notification
// (Phase 2, config-gated — inert until the prod sender/template exist).
export async function POST(request) {
  try {
    const { orderId, expectedNext } = await request.json();
    if (!orderId) {
      return Response.json({ error: "orderId requis" }, { status: 400, headers: corsHeaders });
    }

    const page = await getPage(orderId);
    if (page?.parent?.database_id !== DB.COMMANDES_CLIENTS) {
      return Response.json({ error: "Commande introuvable" }, { status: 404, headers: corsHeaders });
    }

    const current = getSelect(page.properties, "Statut préparation");
    const next = nextPrepStatus(current);
    if (!next) {
      return Response.json({ error: `Commande déjà ${current}` }, { status: 409, headers: corsHeaders });
    }
    // If the client thought it was advancing to a different step, another
    // device already moved it — tell the caller to refresh rather than skip.
    if (expectedNext && expectedNext !== next) {
      return Response.json({ error: "Statut déjà modifié ailleurs", current, next }, { status: 409, headers: corsHeaders });
    }

    const props = { "Statut préparation": selectProp(next) };
    if (next === "Prête") props["Prête le"] = dateProp(new Date().toISOString());
    if (next === "Récupérée") props["Récupérée le"] = dateProp(new Date().toISOString());

    await updatePage(orderId, props);

    let clientNotified = null;
    if (next === "Prête") {
      clientNotified = await notifyClientOrderReady({
        telephone: getText(page.properties, "Téléphone"),
        prenom: getText(page.properties, "Client"),
        code: getTitle(page.properties, "Commande"),
      });
    }

    return Response.json({ ok: true, status: next, clientNotified }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
