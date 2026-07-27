import { runScanZCommit } from "../../../../../lib/importer/notion/commit-pipeline";
import { corsHeaders, parseScanZUploadForm, initiatedByFrom } from "../../_shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

/**
 * scan-z secondary-source commit. Requires the signed `preflightToken`
 * from a prior preflight call — its embedded raw OCR values are combined
 * with the human-reviewed `finalValues` server-side; the client never
 * submits "raw values" directly (there is no such field in this request
 * shape at all). Never re-invokes Claude vision. A source-precedence
 * conflict (scan-z vs. an existing AddicTill/L'Addition row) is always
 * blocked, with zero pilotage writes — there is no override, from any
 * surface. See docs/ARCHITECTURE.md "scan-z secondary source".
 */
export async function POST(request) {
  let upload;
  try {
    upload = await parseScanZUploadForm(request, { requireToken: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status ?? 400, headers: corsHeaders });
  }

  try {
    const result = await runScanZCommit({
      imageBuffer: upload.imageBuffer,
      originalFilename: upload.originalFilename,
      establishmentKey: upload.establishmentKey,
      preflightToken: upload.preflightToken,
      finalValues: upload.finalValues ?? {},
      initiatedVia: "web",
      initiatedBy: initiatedByFrom(request),
    });
    return Response.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error("[api/imports/scan-z/commit] error:", error.message);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
