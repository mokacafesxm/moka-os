import { DB, corsHeaders, createPage, titleProp, textProp, selectProp, numberProp, dateProp, relationProp } from "../../_notion";
import { checkVerificationCode } from "../../_twilio";
import { findClientByPhone, findOrCreateClient, touchLastLogin, clientHasActiveReward, setClientLastSpin, setClientActiveReward } from "../../_clients";
import { sessionCookieHeader } from "../../_session";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Step 2 of phone sign-in: verifies the Twilio code, finds-or-creates the
// Client record, and — if the customer won a wheel spin while signed out —
// persists that reward now (never before this point; see wheel/_shared.js).
// A brand-new phone number gets no prenom here — the client is signed in
// immediately regardless, and AccountView asks for just a first name in a
// single follow-up step (see /api/auth/set-prenom) rather than bundling a
// full signup form before the number is even verified.
export async function POST(request) {
  try {
    const { phone, code, pendingReward } = await request.json();
    if (!phone || !code) {
      return Response.json({ error: "Numéro et code requis" }, { status: 400, headers: corsHeaders });
    }

    let approved = false;
    try {
      approved = await checkVerificationCode(phone, code);
    } catch (err) {
      // Twilio throws a 404 (error code 20404) — rather than returning
      // approved: false — once a verification is already used/expired and
      // no longer pending for this number. That's a normal "wrong code"
      // outcome from the customer's perspective, not a system failure.
      if (err.status === 404) {
        return Response.json({ error: "Code invalide ou expiré." }, { status: 400, headers: corsHeaders });
      }
      // Any other Twilio failure (account-side issues, etc.) never surfaces
      // its raw error — just ask them to retry.
      console.error("Twilio checkVerificationCode failed:", err.message);
      return Response.json(
        { error: "Un problème est survenu, réessaie dans quelques instants." },
        { status: 500, headers: corsHeaders }
      );
    }
    if (!approved) {
      return Response.json({ error: "Code invalide ou expiré." }, { status: 400, headers: corsHeaders });
    }

    const existingClient = await findClientByPhone(phone);
    const client = existingClient || (await findOrCreateClient(phone));
    const isNewClient = !existingClient;
    await touchLastLogin(client.id);

    let rewardSaved = false;
    let blockedByExistingReward = false;
    let existingReward = null;

    if (pendingReward?.reward) {
      if (clientHasActiveReward(client)) {
        blockedByExistingReward = true;
        existingReward = { reward: client.activeReward, expiresAt: client.rewardExpiresAt };
      } else {
        const wonAt = new Date();
        const expiresAt = new Date(wonAt.getTime() + 24 * 60 * 60 * 1000);

        const spinPage = await createPage(DB.ROUE_CHANCE, {
          "Code": titleProp(pendingReward.code || "LUCKY"),
          "Client": textProp(client.prenom || ""),
          "Téléphone": { phone_number: phone },
          "Fiche client": relationProp(client.id),
          "Récompense": selectProp(pendingReward.reward),
          "Case": numberProp(pendingReward.sliceIndex ?? null),
          "Gagné le": dateProp(wonAt.toISOString()),
          "Expire le": dateProp(expiresAt.toISOString()),
          "Réclamée": { checkbox: true },
          "Statut": selectProp("Active"),
        });

        await setClientActiveReward(client.id, { spinId: spinPage.id, reward: pendingReward.reward, expiresAt: expiresAt.toISOString() });
        await setClientLastSpin(client.id, wonAt);
        rewardSaved = true;
      }
    }

    return Response.json(
      {
        prenom: client.prenom || "",
        telephone: phone,
        isNewClient,
        rewardSaved,
        blockedByExistingReward,
        existingReward,
      },
      { headers: { ...corsHeaders, "Set-Cookie": sessionCookieHeader(phone) } }
    );
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
