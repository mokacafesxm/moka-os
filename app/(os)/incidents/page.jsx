"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

const CATEGORIES = ["Client", "Équipement", "Stock", "RH", "Hygiène", "Sécurité", "Autre"];
const CRITICITES = ["Critique", "Majeur", "Modéré", "Mineur"];
const CRITICITE_COLOR = { Critique: "#b91c1c", Majeur: "#d97706", Modéré: "#9a7060", Mineur: "#9a7060" };

const GROUPS = [
  { key: "Ouvert", label: "Ouverts" },
  { key: "En cours", label: "En cours" },
  { key: "Résolu", label: "Résolus" },
];

function statusGroup(statut) {
  if (statut === "Ouvert") return "Ouvert";
  if (statut === "En cours") return "En cours";
  return "Résolu"; // Résolu ou Fermé — pas de 4e groupe demandé pour ce sprint
}

function formatDateHeure(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "America/Puerto_Rico",
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

const EMPTY_FORM = { titre: "", zoneId: "", categorie: "", criticite: "", description: "" };

export default function IncidentsPage() {
  const router = useRouter();
  const { isAdmin, selectedStaff } = useStaffContext();
  const { zonesPhysiques, staff } = useAppContext();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  const loadIncidents = () => {
    setLoading(true);
    setError(null);
    fetch("/api/incidents")
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Erreur chargement incidents");
        setIncidents(Array.isArray(data) ? data : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadIncidents();
  }, [isAdmin]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const zoneById = useMemo(() => Object.fromEntries(zonesPhysiques.map((z) => [z.id, z])), [zonesPhysiques]);
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);

  const grouped = useMemo(() => {
    const map = { Ouvert: [], "En cours": [], Résolu: [] };
    for (const inc of incidents) map[statusGroup(inc.statut)].push(inc);
    return map;
  }, [incidents]);

  if (!isAdmin) return null;

  const submitIncident = async () => {
    if (!form.titre.trim()) {
      setToast({ text: "Titre requis", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, declareParId: selectedStaff?.id || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setToast({ text: "Incident déclaré", type: "success" });
      setShowModal(false);
      setForm(EMPTY_FORM);
      loadIncidents();
    } catch (err) {
      setToast({ text: "Erreur : " + err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Sécurité & qualité</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">Incidents</h1>
      </div>

      {loading && <div className="text-center text-sm text-[#9a7060] py-10">Chargement…</div>}

      {!loading && error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-500">{error}</div>
      )}

      {!loading && !error && (
        <div className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group.key}>
              <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">
                {group.label} ({grouped[group.key].length})
              </div>
              {grouped[group.key].length === 0 ? (
                <div className="text-sm text-[#9a7060] py-2">Aucun incident</div>
              ) : (
                <div className="space-y-2">
                  {grouped[group.key].map((inc) => (
                    <div key={inc.id} className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-black text-sm text-[#2c1a10]">{inc.titre}</div>
                        <span
                          className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                          style={{ color: CRITICITE_COLOR[inc.criticite] || "#9a7060", background: `${CRITICITE_COLOR[inc.criticite] || "#9a7060"}1a` }}
                        >
                          {inc.criticite || "—"}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#9a7060] font-semibold mt-1">
                        {zoneById[inc.zoneId]?.nom || "Zone inconnue"} · {staffById[inc.declareParId]?.name || "—"} · {formatDateHeure(inc.dateHeure)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="sticky bottom-2 z-30 pt-2">
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="w-full h-12 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer shadow-lg"
        >
          🚨 Déclarer un incident
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          <div
            className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-black text-[#2c1a10]">🚨 Déclarer un incident</h2>

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
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitIncident}
                disabled={saving || !form.titre.trim()}
                className="flex-1 py-3 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50 hover:bg-[#4e6a22] transition-colors"
              >
                {saving ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg"
          style={{ background: toast.type === "error" ? "#b91c1c" : "#5a7828" }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
