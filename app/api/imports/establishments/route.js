import { listEstablishments } from "../../../../lib/importer/notion/establishments";
import { corsHeaders } from "../_shared";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

/** Lists the configured establishment allowlist (IMPORTS_ESTABLISHMENTS) for the UI's selector. Read-only, no Notion access. */
export async function GET() {
  return Response.json({ establishments: listEstablishments() }, { headers: corsHeaders });
}
