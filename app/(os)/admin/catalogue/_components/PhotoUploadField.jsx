"use client";

import { useRef, useState } from "react";
import { useAdminAuth } from "../../_lib/AdminAuthProvider";

export default function PhotoUploadField({ label = "Photo", value, onChange, folder }) {
  const { adminFetch } = useAdminAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      const res = await adminFetch("/api/admin/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de l'upload");
      onChange(data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-xl bg-[#f0e8dc] overflow-hidden shrink-0 flex items-center justify-center">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[#9a7060] text-xs">—</span>
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-9 px-3 rounded-xl border border-[#e5d5c5] text-xs font-black text-[#2c1a10] cursor-pointer disabled:opacity-50"
          >
            {uploading ? "Envoi…" : value ? "Changer" : "Choisir une photo"}
          </button>
          {error && <div className="text-[11px] font-semibold text-red-700 mt-1">{error}</div>}
        </div>
      </div>
    </div>
  );
}
