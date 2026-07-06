import { corsHeaders } from "../../_notion";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone, clientHasActiveReward } from "../../_clients";
import { currentPeriodStart, nextResetAt, computeFingerprint, findAnonymousSpin } from "../_shared";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(request) {
  try {
    const now = new Date();
    const periodStart = currentPeriodStart(now);
    const phone = getPhoneFromRequest(request);

    if (phone) {
      const client = await findClientByPhone(phone);
      const spunThisPeriod = client?.lastSpin && new Date(client.lastSpin) >= periodStart;
      const activeReward = client && clientHasActiveReward(client, now) ? { reward: client.activeReward, expiresAt: client.rewardExpiresAt } : null;

      return Response.json(
        { canSpin: !spunThisPeriod, nextResetAt: nextResetAt(now).toISOString(), activeReward },
        { headers: corsHeaders }
      );
    }

    const screenResolution = new URL(request.url).searchParams.get("screenResolution");
    const hash = computeFingerprint(request, screenResolution);
    const anonSpin = await findAnonymousSpin(hash);
    const spunThisPeriod = anonSpin && new Date(anonSpin.lastSpin) >= periodStart;

    return Response.json(
      { canSpin: !spunThisPeriod, nextResetAt: nextResetAt(now).toISOString(), activeReward: null },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
