import { put } from "@vercel/blob";
import { corsHeaders } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

const EXT_BY_TYPE = { "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/jpeg": "jpg" };

function slugify(str) {
  const s = String(str || "photo")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return s || "photo";
}

// First in-app (request-time, browser-driven) Blob uploader — every existing
// product/category/promo photo was re-hosted from a Shopify URL by a one-off
// migration script instead (migration-shopify/lib/blob.js's rehostImage).
// Same store (BLOB_READ_WRITE_TOKEN, same bucket already serving every
// current photo), same public bucket layout (folder/slug.ext) — but accepts
// a multipart file directly rather than fetching a source URL.
export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") || "produits");

    if (!(file instanceof File)) {
      return Response.json({ error: "Fichier manquant" }, { status: 400, headers: corsHeaders });
    }
    const ext = EXT_BY_TYPE[file.type];
    if (!ext) {
      return Response.json(
        { error: "Format non supporté (jpg, png, webp ou gif uniquement)" },
        { status: 400, headers: corsHeaders }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // A random suffix (not just the slugified filename) so re-uploading a
    // photo for the same product never silently overwrites the previous
    // blob — each upload gets its own file, the old one just stops being
    // referenced once the product's Photo property is repointed.
    const suffix = Math.random().toString(36).slice(2, 8);
    const pathname = `${folder}/${slugify(file.name.replace(/\.[^.]+$/, ""))}-${suffix}.${ext}`;

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return Response.json({ url: blob.url }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST admin/upload]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
