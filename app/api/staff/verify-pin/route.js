import { corsHeaders, getPage, getText } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// GET ?staffId= -> { hasPin } uniquement (jamais le hash lui-même) — sert à
// savoir si re-sélectionner ce staff sur le splash doit être bloqué par une
// saisie de PIN (voir SplashScreen.handlePickStaff).
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const staffId = searchParams.get("staffId");
    if (!staffId) return Response.json({ error: "staffId requis" }, { status: 400, headers: corsHeaders });

    const page = await getPage(staffId);
    const hasPin = Boolean(getText(page.properties, "PIN_Hash"));
    return Response.json({ hasPin }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST { staffId, pinHash } -> { valid } — comparaison côté serveur ; le
// hash stocké dans Notion ne quitte jamais le serveur (jamais renvoyé au
// client, contrairement à un GET /api/staff qui exposerait le champ à
// n'importe quel appareil chargeant la liste du staff).
export async function POST(req) {
  try {
    const { staffId, pinHash } = await req.json();
    if (!staffId || !pinHash) {
      return Response.json({ error: "staffId et pinHash requis" }, { status: 400, headers: corsHeaders });
    }

    const page = await getPage(staffId);
    const stored = getText(page.properties, "PIN_Hash");
    return Response.json({ valid: Boolean(stored) && stored === pinHash }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
