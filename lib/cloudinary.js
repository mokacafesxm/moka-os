"use client";

// Upload d'image côté client — Notion n'accepte pas d'upload direct par
// API, on passe par Cloudinary (preset non signé) et on stocke l'URL
// résultante dans Photo_URL. NEXT_PUBLIC_ requis sur les DEUX variables
// (pas seulement le cloud name) : ce fetch tourne dans le navigateur, donc
// toute variable sans ce préfixe est undefined côté client, quelle que
// soit sa valeur côté serveur.
export function isCloudinaryConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
  );
}

export async function uploadToCloudinary(file) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary non configuré");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Échec de l'upload de l'image");
  const data = await res.json();
  return data.secure_url;
}
