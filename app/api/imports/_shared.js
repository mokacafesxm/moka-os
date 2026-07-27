// Shared helpers for the /api/imports/* route handlers (PR4). Kept minimal
// on purpose — the actual detect/extract/classify/parse/validate/write
// logic lives entirely in lib/importer/**, so the CLI and this API can
// never drift on business rules. This file only turns an HTTP request into
// the plain { buffer, originalFilename, establishmentKey } shape the
// importer's commit-pipeline already expects from the CLI.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Parses a multipart/form-data upload into the shape commit-pipeline.js
 * expects. Only the file itself is a hard requirement (400 if missing) —
 * a missing/unknown establishmentKey is left to flow through into the
 * pipeline's own UNKNOWN_ESTABLISHMENT blocking reason, so the preview can
 * still show extracted data before a user has picked an establishment.
 * @param {Request} request
 * @returns {Promise<{buffer: Buffer, originalFilename: string, establishmentKey: string|null}>}
 */
export async function parseUploadForm(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    const error = new Error('Expected multipart/form-data with a "file" field.');
    error.status = 400;
    throw error;
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    const error = new Error('Missing "file" in the upload.');
    error.status = 400;
    throw error;
  }

  const establishmentKeyField = formData.get("establishmentKey");
  const establishmentKey = typeof establishmentKeyField === "string" && establishmentKeyField ? establishmentKeyField : null;

  const arrayBuffer = await file.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    originalFilename: file.name || "upload",
    establishmentKey,
  };
}

/**
 * Reads the Basic Auth username middleware.js forwarded (see middleware.js
 * "x-imports-user") for the Import Runs audit trail's `initiated_by` field.
 * Best-effort, not a real per-staff identity — see docs/ARCHITECTURE.md
 * "PR4 addendum — audit trail".
 * @param {Request} request
 * @returns {string}
 */
export function initiatedByFrom(request) {
  return request.headers.get("x-imports-user") || "";
}

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

/**
 * Parses a scan-z (secondary source) upload: a photo, an establishment
 * key, and — for the commit step only — the signed preflight token and
 * the human-reviewed final values. See docs/ARCHITECTURE.md "scan-z
 * secondary source" §0 — the raw OCR values are never accepted as a
 * client-submitted field here; only the opaque, previously-issued token
 * carries them.
 * @param {Request} request
 * @param {{requireToken?: boolean}} [options]
 * @returns {Promise<{imageBuffer: Buffer, mimeType: string, originalFilename: string, establishmentKey: string|null, preflightToken: string|null, finalValues: object|null}>}
 */
export async function parseScanZUploadForm(request, { requireToken = false } = {}) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    const error = new Error('Expected multipart/form-data with an "image" field.');
    error.status = 400;
    throw error;
  }

  const formData = await request.formData();
  const image = formData.get("image");
  if (!image || typeof image === "string") {
    const error = new Error('Missing "image" in the upload.');
    error.status = 400;
    throw error;
  }
  if (image.type && !IMAGE_MIME_TYPES.has(image.type)) {
    const error = new Error(`Unsupported image type "${image.type}" — only image/jpeg and image/png are accepted.`);
    error.status = 400;
    throw error;
  }

  const establishmentKeyField = formData.get("establishmentKey");
  const establishmentKey = typeof establishmentKeyField === "string" && establishmentKeyField ? establishmentKeyField : null;

  const preflightTokenField = formData.get("preflightToken");
  const preflightToken = typeof preflightTokenField === "string" && preflightTokenField ? preflightTokenField : null;
  if (requireToken && !preflightToken) {
    const error = new Error('Missing "preflightToken" — scan-z commit always requires the token from a prior preflight call.');
    error.status = 400;
    throw error;
  }

  const finalValuesField = formData.get("finalValues");
  let finalValues = null;
  if (typeof finalValuesField === "string" && finalValuesField) {
    try {
      finalValues = JSON.parse(finalValuesField);
    } catch {
      const error = new Error('"finalValues" must be valid JSON.');
      error.status = 400;
      throw error;
    }
  }

  const arrayBuffer = await image.arrayBuffer();
  return {
    imageBuffer: Buffer.from(arrayBuffer),
    mimeType: image.type || "image/jpeg",
    originalFilename: image.name || "scan-z-photo",
    establishmentKey,
    preflightToken,
    finalValues,
  };
}
