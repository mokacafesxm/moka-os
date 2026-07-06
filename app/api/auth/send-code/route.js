import { corsHeaders } from "../../_notion";
import { isTwilioConfigured, sendVerificationCode } from "../../_twilio";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { phone } = await request.json();
    if (!phone || !/^\+[1-9]\d{6,14}$/.test(phone)) {
      return Response.json(
        { error: "Numéro invalide — format international requis, ex. +590690123456" },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!isTwilioConfigured()) {
      return Response.json({ error: "Vérification par SMS non configurée." }, { status: 503, headers: corsHeaders });
    }

    await sendVerificationCode(phone);
    return Response.json({ sent: true }, { headers: corsHeaders });
  } catch (err) {
    // Never surface Twilio's raw error to the customer (e.g. trial-account
    // restrictions, carrier issues) — log it for us, show a clean retry
    // message so the sign-in form never looks broken.
    console.error("Twilio sendVerificationCode failed:", err.message);
    return Response.json(
      { error: "Un problème est survenu, réessaie dans quelques instants." },
      { status: 500, headers: corsHeaders }
    );
  }
}
