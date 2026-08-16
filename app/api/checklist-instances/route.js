import { corsHeaders } from "../_notion";
import { completeInstance } from "../_checklist";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Complète une tâche de checklist — une à la fois (voir /checklist, pattern
// swipeable repris de ReceiveModal/WorkflowRunner). La décision "Non
// conforme" (température hors plage) et la déclaration d'incident qui en
// découle sont calculées côté serveur, jamais par le client — voir
// completeInstance dans _checklist.js.
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { instanceId, staffId, preuveTexte, preuvePhotoUrl, preuveChiffre, ignore } = body;

    if (!instanceId || !staffId) {
      return Response.json({ error: "instanceId and staffId required" }, { status: 400, headers: corsHeaders });
    }

    const result = await completeInstance({ instanceId, staffId, preuveTexte, preuvePhotoUrl, preuveChiffre, ignore });
    return Response.json({ success: true, ...result }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH checklist-instances]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
