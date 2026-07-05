import { DB, corsHeaders, createPage, updatePage, titleProp, textProp, selectProp, numberProp, dateProp } from "../../_notion";
import { currentPeriodStart, pickReward, spinCodeFromPageId, findSpinsByDevice } from "../_shared";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { deviceId } = await request.json();
    if (!deviceId) {
      return Response.json({ error: "deviceId requis" }, { status: 400, headers: corsHeaders });
    }

    // Never trust the client's "can I spin" check — re-verify here.
    const spins = await findSpinsByDevice(deviceId);
    const periodStart = currentPeriodStart();
    if (spins.some((s) => new Date(s.wonAt) >= periodStart)) {
      return Response.json({ error: "Une seule roue par jour — reviens après 5h du matin." }, { status: 409, headers: corsHeaders });
    }

    const { sliceIndex, reward } = await pickReward();
    const wonAt = new Date();
    const expiresAt = new Date(wonAt.getTime() + 24 * 60 * 60 * 1000);

    const page = await createPage(DB.ROUE_CHANCE, {
      "Code": titleProp("En cours"),
      "Device ID": textProp(deviceId),
      "Récompense": selectProp(reward),
      "Case": numberProp(sliceIndex),
      "Gagné le": dateProp(wonAt.toISOString()),
      "Expire le": dateProp(expiresAt.toISOString()),
      "Réclamée": { checkbox: false },
      "Statut": selectProp("Active"),
    });

    const code = spinCodeFromPageId(page.id);
    await updatePage(page.id, { "Code": titleProp(code) });

    return Response.json(
      { sliceIndex, reward, code, expiresAt: expiresAt.toISOString() },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
