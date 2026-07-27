import { runPreflight } from "../../../../lib/importer/notion/commit-pipeline";
import { corsHeaders, parseUploadForm, initiatedByFrom } from "../_shared";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

/**
 * Read-only preview: parses/classifies/validates the uploaded file and
 * checks establishment + duplicate status against Notion, but never writes
 * anything. Safe to call repeatedly (e.g. the UI re-calling this after the
 * user picks a different establishment) — the file is never persisted
 * server-side, so it must be resubmitted with each call.
 */
export async function POST(request) {
  let upload;
  try {
    upload = await parseUploadForm(request);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status ?? 400, headers: corsHeaders });
  }

  try {
    const preflight = await runPreflight({
      buffer: upload.buffer,
      originalFilename: upload.originalFilename,
      establishmentKey: upload.establishmentKey,
      initiatedVia: "web",
      initiatedBy: initiatedByFrom(request),
    });
    return Response.json(preflight, { headers: corsHeaders });
  } catch (error) {
    console.error("[api/imports/preflight] error:", error.message);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
