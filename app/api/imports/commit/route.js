import { runCommit } from "../../../../lib/importer/notion/commit-pipeline";
import { corsHeaders, parseUploadForm, initiatedByFrom } from "../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Re-runs the full preflight server-side (never trusts a client-supplied
 * preview) and, only if nothing blocks, writes the pilotage rows. An Import
 * Run audit record is written for every attempt — blocked or not (see
 * lib/importer/notion/commit-pipeline.js "Audit trail vs. business dedup")
 * — but the pilotage rows themselves stay gated by the blocking rules
 * (validation errors, unknown establishment, schema mismatch, exact file
 * already committed).
 */
export async function POST(request) {
  let upload;
  try {
    upload = await parseUploadForm(request);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status ?? 400, headers: corsHeaders });
  }

  try {
    const result = await runCommit({
      buffer: upload.buffer,
      originalFilename: upload.originalFilename,
      establishmentKey: upload.establishmentKey,
      initiatedVia: "web",
      initiatedBy: initiatedByFrom(request),
    });
    return Response.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error("[api/imports/commit] error:", error.message);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
