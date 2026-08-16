import { DB, corsHeaders, createPage, textProp, selectProp, dateProp } from "../_notion";
import { triggerOuvertureIfNeeded } from "../_checklist";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { staffName, action } = await request.json();

    if (!staffName || !action) {
      return Response.json({ error: "staffName and action required" }, { status: 400, headers: corsHeaders });
    }

    const nowSXM = new Date().toLocaleString("sv-SE", {
      timeZone: "America/Puerto_Rico",
    }).replace(" ", "T") + "-04:00";

    await createPage(DB.POINTAGES, {
      "Staff":          textProp(staffName),
      "Action":         selectProp(action),
      "Date et heure":  dateProp(nowSXM),
    });

    // Déclencheur d'ouverture de poste (checklists opérationnelles) — voir
    // app/api/_checklist.js. Attendu (pas fire-and-forget) : sur une plateforme
    // serverless, une promesse lancée après le retour de la réponse peut être
    // tuée avant de s'exécuter. Best-effort seulement dans le sens où une
    // erreur ici ne fait jamais échouer le pointage lui-même.
    if (String(action).toLowerCase() === "arrivée") {
      try {
        await triggerOuvertureIfNeeded(staffName);
      } catch (err) {
        console.error("[clock] triggerOuvertureIfNeeded failed", err.message);
      }
    }

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
