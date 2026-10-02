"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../../_lib/AdminAuthProvider";
import PhotoUploadField from "./PhotoUploadField";
import VariantesEditor from "./VariantesEditor";
import ExtrasEditor from "./ExtrasEditor";

const EMPTY = {
  nom: "",
  description: "",
  prix: "",
  categorie: "",
  tags: [],
  disponible: true,
  populaire: false,
  photo: "",
  variantes: [],
  extras: [],
};

export default function ProductForm({ productId, categoryNames, onClose, onSaved }) {
  const { adminFetch } = useAdminAuth();
  const [data, setData] = useState(EMPTY);
  const [tagsText, setTagsText] = useState("");
  const [loading, setLoading] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    adminFetch(`/api/admin/products/${productId}`)
      .then((r) => r.json())
      .then((item) => {
        if (cancelled) return;
        setData({ ...EMPTY, ...item, prix: item.prix ?? "" });
        setTagsText((item.tags || []).join(", "));
      })
      .catch(() => setError("Impossible de charger ce produit."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [productId, adminFetch]);

  function set(patch) {
    setData((prev) => ({ ...prev, ...patch }));
  }

  async function handleSave() {
    if (!data.nom.trim()) {
      setError("Le nom est requis.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...data,
      prix: data.prix === "" ? 0 : Number(data.prix),
      tags: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      const res = await adminFetch(productId ? `/api/admin/products/${productId}` : "/api/admin/products", {
        method: productId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok || result.success === false) throw new Error(result.error || "Échec de l'enregistrement");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!productId) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/products/${productId}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok || result.success === false) throw new Error(result.error || "Échec de la suppression");
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg sm:max-h-[90vh] max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f0e8dc] text-[#2c1a10] font-black cursor-pointer flex items-center justify-center"
          aria-label="Fermer"
        >
          ×
        </button>

        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">
          {productId ? "Modifier" : "Nouveau"}
        </div>
        <h2 className="text-xl font-black text-[#2c1a10] -mt-0.5 mb-4">{productId ? data.nom || "Produit" : "Nouveau produit"}</h2>

        {loading ? (
          <div className="text-sm text-[#9a7060] text-center py-10">…</div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              value={data.nom}
              onChange={(e) => set({ nom: e.target.value })}
              placeholder="Nom du produit"
              className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] text-sm font-semibold"
            />
            <textarea
              value={data.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Description"
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-[#e5d5c5] text-sm"
            />
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                value={data.prix}
                onChange={(e) => set({ prix: e.target.value })}
                placeholder="Prix"
                className="w-28 h-11 px-3 rounded-xl border border-[#e5d5c5] text-sm"
              />
              <input
                type="text"
                list="category-names"
                value={data.categorie}
                onChange={(e) => set({ categorie: e.target.value })}
                placeholder="Catégorie"
                className="flex-1 h-11 px-3 rounded-xl border border-[#e5d5c5] text-sm"
              />
              <datalist id="category-names">
                {categoryNames.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <input
              type="text"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Tags séparés par des virgules"
              className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] text-sm"
            />

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#2c1a10]">
                <input type="checkbox" checked={data.disponible} onChange={(e) => set({ disponible: e.target.checked })} />
                Disponible
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-[#2c1a10]">
                <input type="checkbox" checked={data.populaire} onChange={(e) => set({ populaire: e.target.checked })} />
                Populaire
              </label>
            </div>

            <PhotoUploadField value={data.photo} onChange={(url) => set({ photo: url })} folder="produits" />

            <div>
              <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-1.5">Variantes</div>
              <VariantesEditor variantes={data.variantes} onChange={(variantes) => set({ variantes })} />
            </div>

            <div>
              <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-1.5">Extras</div>
              <ExtrasEditor extras={data.extras} onChange={(extras) => set({ extras })} />
            </div>

            {error && <div className="text-xs font-semibold text-red-700">{error}</div>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 h-11 rounded-xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer disabled:opacity-50"
              >
                {saving ? "…" : "Enregistrer"}
              </button>
              {productId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="h-11 px-4 rounded-xl border border-red-200 text-red-700 text-sm font-black cursor-pointer disabled:opacity-50"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
