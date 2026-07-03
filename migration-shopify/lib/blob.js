const { put } = require("@vercel/blob");

function extFromContentType(contentType) {
  if (!contentType) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function rehostImage(imageUrl, { folder, name }) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`téléchargement échoué (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type");
  const ext = extFromContentType(contentType);
  const pathname = `${folder}/${slugify(name)}.${ext}`;

  const blob = await put(pathname, buffer, {
    access: "public",
    contentType: contentType || undefined,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  return blob.url;
}

module.exports = { rehostImage, slugify };
