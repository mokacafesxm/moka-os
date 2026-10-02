"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../../_lib/AdminAuthProvider";
import PhotoUploadField from "./PhotoUploadField";

const EMPTY = { nom: "", image: "", lien: "", actif: false, ordre: 0 };

export default function PromoForm({ promoId, onClose, onSaved }) {
  const { adminFetch } = useAdminAuth();
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(!!promoId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!promoId) return;
    let cancelled = false;
    adminFetch(`/api/admin/promos/${promoId}`)
      .then((r) => r.json())
      .then((item) => !cancelled && setData({ ...EMPTY, ...item }))
      .catch(() => setError("Impossible de charger cette promo."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [promoId, adminFetch]);

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
    try {
      const res = await adminFetch(promoId ? `/api/admin/promos/${promoId}` : "/api/admin/promos", {
        method: promoId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, ordre: Number(data.ordre) || 0 }),
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
    if (!promoId) return;
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/promos/${promoId}`, { method: "DELETE" });
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
      <div className="relative w-full sm:max-w-sm max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f0e8dc] text-[#2c1a10] font-black cursor-pointer flex items-center justify-center"
          aria-label="Fermer"
        >
          ×
        </button>

        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">
          {promoId ? "Modifier" : "Nouvelle"}
        </div>
        <h2 className="text-xl font-black text-[#2c1a10] -mt-0.5 mb-4">Promo</h2>

        {loading ? (
          <div className="text-sm text-[#9a7060] text-center py-10">…</div>
        ) : (
          <div className="space-y-4">
            <input
              type="text"
              value={data.nom}
              onChange={(e) => set({ nom: e.target.value })}
              placeholder="Nom (usage interne)"
              className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] text-sm font-semibold"
            />
            <input
              type="text"
              value={data.lien}
              onChange={(e) => set({ lien: e.target.value })}
              placeholder="Lien (ex. /commander)"
              className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] text-sm"
            />
            <input
              type="number"
              value={data.ordre}
              onChange={(e) => set({ ordre: e.target.value })}
              placeholder="Ordre d'affichage"
              className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] text-sm"
            />
            <label className="flex items-center gap-2 text-sm font-semibold text-[#2c1a10]">
              <input type="checkbox" checked={data.actif} onChange={(e) => set({ actif: e.target.checked })} />
              Actif (visible sur le site)
            </label>
            <PhotoUploadField label="Image" value={data.image} onChange={(url) => set({ image: url })} folder="promos" />

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
              {promoId && (
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
