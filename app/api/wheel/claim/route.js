import { corsHeaders, updatePage, textProp } from "../../_notion";
import { findSpinsByDevice } from "../_shared";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Called right after sign-in (mock or real) so a reward won anonymously
// becomes usable. Attaches the customer's identity to the most recent
// unclaimed, unexpired spin for this device.
export async function POST(request) {
  try {
    const { deviceId, prenom, telephone } = await request.json();
    if (!deviceId) {
      return Response.json({ error: "deviceId requis" }, { status: 400, headers: corsHeaders });
    }

    const spins = await findSpinsByDevice(deviceId);
    const now = new Date();
    const pending = spins.find((s) => !s.claimed && new Date(s.expiresAt) > now);

    if (!pending) {
      return Response.json({ claimed: false }, { headers: corsHeaders });
    }

    await updatePage(pending.id, {
      "Client": textProp(prenom || ""),
      ...(telephone ? { "Téléphone": { phone_number: telephone } } : {}),
      "Réclamée": { checkbox: true },
    });

    return Response.json(
      { claimed: true, reward: pending.reward, code: pending.code, expiresAt: pending.expiresAt },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
