import { corsHeaders } from "../../_notion";
import { clearSessionCookieHeader } from "../../_session";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST() {
  return Response.json({ ok: true }, { headers: { ...corsHeaders, "Set-Cookie": clearSessionCookieHeader() } });
}
