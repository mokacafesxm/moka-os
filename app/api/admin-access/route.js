import { corsHeaders } from "../_notion";
import { isLockedOut, recordFailedAttempt, recordSuccess } from "../../../lib/auth/pin-rate-limit";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function getIp(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

// Hidden entry point from /commander (5 taps on the logo, see Header.js) to
// the staff backoffice. This endpoint only proves "this visitor knows the
// secret PIN" — it is NOT the real security boundary, which stays downstream
// (the backoffice's own isAdmin gate + its Basic Auth, see middleware.js).
// Its one job is deciding where to send them, via ADMIN_ACCESS_REDIRECT_URL —
// a single env var, so swapping the destination (e.g. once MÖKA OS V2's API
// is ready) never requires touching this code again.
//
// Default below is a TEMPORARY stand-in (the Notion-backed backoffice built
// in this same repo) — explicitly not "the" destination, just what exists
// today. See project memory / HANDOFF for the MÖKA OS V2 migration context.
const TEMPORARY_LEGACY_BACKOFFICE_URL = "https://moka-os.vercel.app/admin/commandes";

export async function POST(request) {
  const ip = getIp(request);

  if (isLockedOut(ip)) {
    return Response.json({ ok: false, error: "Trop de tentatives, réessaie plus tard." }, { status: 429, headers: corsHeaders });
  }

  const expectedPin = process.env.ADMIN_ACCESS_PIN;
  if (!expectedPin) {
    return Response.json({ ok: false, error: "Non configuré." }, { status: 503, headers: corsHeaders });
  }

  const { pin } = await request.json().catch(() => ({}));
  if (String(pin || "") !== expectedPin) {
    recordFailedAttempt(ip);
    return Response.json({ ok: false, error: "Code incorrect." }, { status: 401, headers: corsHeaders });
  }

  recordSuccess(ip);
  const redirectUrl = process.env.ADMIN_ACCESS_REDIRECT_URL || TEMPORARY_LEGACY_BACKOFFICE_URL;
  return Response.json({ ok: true, redirectUrl }, { headers: corsHeaders });
}
