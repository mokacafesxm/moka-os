"use client";

// Extracted from app/(os)/incidents/page.jsx's inline form so it can also be
// opened from Mon Poste (any staff, no admin gate) — /incidents itself
// redirects non-admins to /home, so that page can't be reused as-is for the
// "Signaler un incident" entry point on Mon Poste.

import { useState } from "react";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

const CATEGORIES = ["Client", "Équipement", "Stock", "RH", "Hygiène", "Sécurité", "Autre"];
const CRITICITES = ["Critique", "Majeur", "Modéré", "Mineur"];

const emptyForm = (defaultZoneId) => ({ titre: "", zoneId: defaultZoneId || "", categorie: "", criticite: "", description: "" });

export default function DeclareIncidentModal({ onClose, onDeclared, defaultZoneId }) {
  const { selectedStaff } = useStaffContext();
  const { zonesPhysiques } = useAppContext();

  const [form, setForm] = useState(() => emptyForm(defaultZoneId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!form.titre.trim()) {
      setError("Titre requis");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, declareParId: selectedStaff?.id || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      onDeclared?.(data.item);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div
        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">🚨 Déclarer un incident</h2>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-500">{error}</div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Titre *</label>
          <input
            value={form.titre}
            onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
            className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
            placeholder="Ex : Fuite machine à café"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Zone</label>
          <select
            value={form.zoneId}
            onChange={(e) => setForm((f) => ({ ...f, zoneId: e.target.value }))}
            className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828]"
          >
            <option value="">Sélectionner…</option>
            {zonesPhysiques.map((z) => (
              <option key={z.id} value={z.id}>{z.nom}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Catégorie</label>
          <select
            value={form.categorie}
            onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
            className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828]"
          >
            <option value="">Sélectionner…</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Criticité</label>
          <select
            value={form.criticite}
            onChange={(e) => setForm((f) => ({ ...f, criticite: e.target.value }))}
            className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828]"
          >
            <option value="">Sélectionner…</option>
            {CRITICITES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] resize-none"
            placeholder="Détails de l'incident…"
          />
        </div>

        <div className="flex gap-3 pt-1" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !form.titre.trim()}
            className="flex-1 py-3 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50 hover:bg-[#4e6a22] transition-colors"
          >
            {saving ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
