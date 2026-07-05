import { corsHeaders } from "../../_notion";
import { currentPeriodStart, nextResetAt, findSpinsByDevice } from "../_shared";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(request) {
  try {
    const deviceId = new URL(request.url).searchParams.get("deviceId");
    if (!deviceId) {
      return Response.json({ error: "deviceId requis" }, { status: 400, headers: corsHeaders });
    }

    const spins = await findSpinsByDevice(deviceId);
    const now = new Date();
    const periodStart = currentPeriodStart(now);

    const spunThisPeriod = spins.some((s) => new Date(s.wonAt) >= periodStart);
    const activeReward = spins.find(
      (s) => s.claimed && s.status === "Active" && new Date(s.expiresAt) > now
    );
    const pendingUnclaimed = spins.find((s) => !s.claimed && new Date(s.expiresAt) > now);

    return Response.json(
      {
        canSpin: !spunThisPeriod,
        nextResetAt: nextResetAt(now).toISOString(),
        activeReward: activeReward || null,
        pendingUnclaimed: pendingUnclaimed || null,
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
