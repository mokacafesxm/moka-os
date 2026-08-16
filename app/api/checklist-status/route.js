import { corsHeaders, withNotionCache } from "../_notion";
import { getInstancesForStaff } from "../_checklist";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Instances "À faire" du jour assignées à ?staffId=, enrichies des champs du
// Template (tache, déclencheur, type de preuve, plage température...) pour
// que le bandeau (compteur) ET l'écran de complétion /checklist puissent
// consommer la même réponse — surfacée via le même polling 8s que le reste
// de l'app (RealTimeContext), pas un second mécanisme.
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get("staffId");
    if (!staffId) return Response.json([], { headers: corsHeaders });

    const instances = await withNotionCache(
      `checklist-status:${staffId}`,
      15000,
      () => getInstancesForStaff(staffId)
    );

    return Response.json(instances, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET checklist-status]", err.message);
    return Response.json([], { status: 500, headers: corsHeaders });
  }
}
