import { DB, corsHeaders, createPage, updatePage, titleProp, textProp, selectProp, numberProp, dateProp, relationProp } from "../../_notion";
import { getPhoneFromRequest } from "../../_session";
import { findClientByPhone, clientHasActiveReward, setClientLastSpin, setClientActiveReward } from "../../_clients";
import { currentPeriodStart, pickReward, spinCodeFromPageId, randomSpinCode, computeFingerprint, findAnonymousSpin, recordAnonymousSpin } from "../_shared";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { screenResolution } = await request.json();
    const periodStart = currentPeriodStart();
    const phone = getPhoneFromRequest(request);

    if (phone) {
      const client = await findClientByPhone(phone);
      if (!client) {
        return Response.json({ error: "Session invalide, reconnecte-toi." }, { status: 401, headers: corsHeaders });
      }
      if (client.lastSpin && new Date(client.lastSpin) >= periodStart) {
        return Response.json({ error: "Une seule roue par jour — reviens après 5h du matin." }, { status: 409, headers: corsHeaders });
      }

      const { sliceIndex, reward } = await pickReward();
      const wonAt = new Date();

      // Spinning always consumes today's slot, whether or not the win ends
      // up saved below — the daily limit and the "one active reward" rule
      // are independent (see wheel/_shared.js's resolveActiveRewardForClient).
      await setClientLastSpin(client.id, wonAt);

      if (clientHasActiveReward(client, wonAt)) {
        return Response.json(
          {
            sliceIndex,
            reward,
            code: null,
            blockedByExistingReward: true,
            existingReward: { reward: client.activeReward, expiresAt: client.rewardExpiresAt },
          },
          { headers: corsHeaders }
        );
      }

      const expiresAt = new Date(wonAt.getTime() + 24 * 60 * 60 * 1000);
      const spinPage = await createPage(DB.ROUE_CHANCE, {
        "Code": titleProp("En cours"),
        "Client": textProp(client.prenom || ""),
        "Téléphone": { phone_number: phone },
        "Fiche client": relationProp(client.id),
        "Récompense": selectProp(reward),
        "Case": numberProp(sliceIndex),
        "Gagné le": dateProp(wonAt.toISOString()),
        "Expire le": dateProp(expiresAt.toISOString()),
        "Réclamée": { checkbox: true },
        "Statut": selectProp("Active"),
      });
      const code = spinCodeFromPageId(spinPage.id);
      await Promise.all([
        updatePage(spinPage.id, { "Code": titleProp(code) }),
        setClientActiveReward(client.id, { spinId: spinPage.id, reward, expiresAt: expiresAt.toISOString() }),
      ]);

      return Response.json({ sliceIndex, reward, code, expiresAt: expiresAt.toISOString() }, { headers: corsHeaders });
    }

    // Anonymous: check the fingerprint-based daily limit, but never persist
    // the reward itself yet — it only becomes real once the phone is
    // verified (see /api/auth/verify-code), so a spin-and-abandon costs the
    // business nothing.
    const hash = computeFingerprint(request, screenResolution);
    const anonSpin = await findAnonymousSpin(hash);
    if (anonSpin && new Date(anonSpin.lastSpin) >= periodStart) {
      return Response.json({ error: "Une seule roue par jour — reviens après 5h du matin." }, { status: 409, headers: corsHeaders });
    }

    const { sliceIndex, reward } = await pickReward();
    await recordAnonymousSpin(hash);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return Response.json(
      { sliceIndex, reward, code: randomSpinCode(), expiresAt: expiresAt.toISOString(), requiresVerification: true },
      { headers: corsHeaders }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
