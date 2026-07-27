import { runScanZPreflight } from "../../../../../lib/importer/notion/commit-pipeline";
import { corsHeaders, parseScanZUploadForm, initiatedByFrom } from "../../_shared";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

/**
 * scan-z secondary-source preview (behind IMPORTS_SCANZ_ENABLED, default
 * false — the underlying pipeline function itself returns a clear
 * SCANZ_DISABLED blocking reason when the flag is off, so no extra gating
 * is needed here). Runs Claude vision exactly once, mints a signed
 * preflight token binding the raw OCR values, and returns a preview —
 * never writes pilotage data. See docs/ARCHITECTURE.md "scan-z secondary
 * source".
 */
export async function POST(request) {
  let upload;
  try {
    upload = await parseScanZUploadForm(request);
  } catch (error) {
    return Response.json({ error: error.message }, { status: error.status ?? 400, headers: corsHeaders });
  }

  try {
    const preflight = await runScanZPreflight({
      imageBuffer: upload.imageBuffer,
      mimeType: upload.mimeType,
      originalFilename: upload.originalFilename,
      establishmentKey: upload.establishmentKey,
      initiatedVia: "web",
      initiatedBy: initiatedByFrom(request),
    });
    return Response.json(preflight, { headers: corsHeaders });
  } catch (error) {
    console.error("[api/imports/scan-z/preflight] error:", error.message);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
