"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

const MOMENT_OPTIONS = ["Ouverture", "Pendant service", "Fermeture", "Planifié"];
const PRIORITE_OPTIONS = ["Critique", "Haute", "Normale", "Basse"];
const FREQUENCE_OPTIONS = ["À chaque service", "Quotidien", "Hebdomadaire", "Mensuel"];
const STATUT_EQUIPEMENT_OPTIONS = ["Actif", "En panne", "En maintenance", "Retraité"];

const TABS = [
  { key: "taches", label: "Tâches", icon: "📋" },
  { key: "equipements", label: "Équipements", icon: "🔧" },
  { key: "equipe", label: "Équipe", icon: "👥" },
];

const EMPTY_TACHE_FORM = { nom: "", moment: "", priorite: "Normale", frequence: "" };
const EMPTY_EQUIPEMENT_FORM = { nom: "", marque: "", statut: "Actif", prochaineMaintenance: "" };

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

const inputClass = "w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-3.5 py-2.5 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]";

// UX audit (28 jul 2026) — "En panne" et une maintenance dépassée rendaient
// en texte gris identique à un équipement sain. Même correction que Stock :
// le statut existant pilote enfin une couleur.
function isMaintenanceOverdue(dateStr) {
  if (!dateStr) return false;
  return dateStr.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

function EquipementStatusBadge({ statut }) {
  const isPanne = statut === "En panne";
  const isMaintenance = statut === "En maintenance";
  const style = isPanne
    ? "bg-red-50 text-red-700"
    : isMaintenance
    ? "bg-orange-50 text-orange-700"
    : "bg-[#f0e8dc] text-[#9a7060]";
  return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${style}`}>{statut}</span>;
}

function TachesTab({ zone, taches, onCreated }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_TACHE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const zoneTaches = useMemo(() => taches.filter((t) => t.zoneId === zone.id), [taches, zone.id]);

  const submit = async () => {
    if (!form.nom.trim()) { setError("Nom requis"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/taches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, zoneId: zone.id, actif: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setForm(EMPTY_TACHE_FORM);
      setShowForm(false);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {zoneTaches.length === 0 ? (
        <div className="text-sm text-[#9a7060] py-2">Aucune tâche pour cette zone</div>
      ) : (
        <div className="space-y-2">
          {zoneTaches.map((t) => (
            <div key={t.id} className="rounded-xl border border-[#e5d5c5] bg-white p-3">
              <div className="font-bold text-sm text-[#2c1a10]">{t.nom}</div>
              <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
                {[t.moment, t.frequence, t.priorite].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5 space-y-2.5">
          <input
            value={form.nom}
            onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
            placeholder="Nom de la tâche"
            className={inputClass}
            autoFocus
          />
          <select value={form.moment} onChange={(e) => setForm((f) => ({ ...f, moment: e.target.value }))} className={inputClass}>
            <option value="">Moment…</option>
            {MOMENT_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={form.priorite} onChange={(e) => setForm((f) => ({ ...f, priorite: e.target.value }))} className={inputClass}>
            {PRIORITE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={form.frequence} onChange={(e) => setForm((f) => ({ ...f, frequence: e.target.value }))} className={inputClass}>
            <option value="">Fréquence…</option>
            {FREQUENCE_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          {error && <div className="text-xs font-bold text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="flex-1 h-10 rounded-xl text-[#9a7060] font-bold text-xs cursor-pointer">
              Annuler
            </button>
            <button type="button" onClick={submit} disabled={saving} className="flex-1 h-10 rounded-xl bg-[#5a7828] text-white font-black text-xs cursor-pointer disabled:opacity-50">
              {saving ? "Ajout…" : "Ajouter"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="w-full h-10 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer">
          + Ajouter une tâche
        </button>
      )}
    </div>
  );
}

function EquipementsTab({ zone, equipements, onCreated }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_EQUIPEMENT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const zoneEquipements = useMemo(() => {
    const list = equipements.filter((e) => e.zoneId === zone.id);
    const urgency = (e) => (e.statut === "En panne" ? 0 : isMaintenanceOverdue(e.prochaineMaintenance) ? 1 : e.statut === "En maintenance" ? 2 : 3);
    return [...list].sort((a, b) => urgency(a) - urgency(b));
  }, [equipements, zone.id]);

  const submit = async () => {
    if (!form.nom.trim()) { setError("Nom requis"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/equipements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, zoneId: zone.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setForm(EMPTY_EQUIPEMENT_FORM);
      setShowForm(false);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {zoneEquipements.length === 0 ? (
        <div className="text-sm text-[#9a7060] py-2">Aucun équipement pour cette zone</div>
      ) : (
        <div className="space-y-2">
          {zoneEquipements.map((e) => {
            const overdue = isMaintenanceOverdue(e.prochaineMaintenance);
            return (
              <div key={e.id} className="rounded-xl border border-[#e5d5c5] bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-sm text-[#2c1a10]">{e.nom}</div>
                  <EquipementStatusBadge statut={e.statut} />
                </div>
                <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
                  {e.marque || "—"}
                  {e.prochaineMaintenance && (
                    <span className={overdue ? "text-red-700 font-black" : ""}>
                      {" · "}{overdue ? "⚠ Entretien dépassé " : "Entretien "}{e.prochaineMaintenance.slice(0, 10)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5 space-y-2.5">
          <input
            value={form.nom}
            onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
            placeholder="Nom de l'équipement"
            className={inputClass}
            autoFocus
          />
          <input
            value={form.marque}
            onChange={(e) => setForm((f) => ({ ...f, marque: e.target.value }))}
            placeholder="Marque"
            className={inputClass}
          />
          <select value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value }))} className={inputClass}>
            {STATUT_EQUIPEMENT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div>
            <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Date prochain entretien</label>
            <input
              type="date"
              value={form.prochaineMaintenance}
              onChange={(e) => setForm((f) => ({ ...f, prochaineMaintenance: e.target.value }))}
              className={inputClass}
            />
          </div>
          {error && <div className="text-xs font-bold text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="flex-1 h-10 rounded-xl text-[#9a7060] font-bold text-xs cursor-pointer">
              Annuler
            </button>
            <button type="button" onClick={submit} disabled={saving} className="flex-1 h-10 rounded-xl bg-[#5a7828] text-white font-black text-xs cursor-pointer disabled:opacity-50">
              {saving ? "Ajout…" : "Ajouter"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)} className="w-full h-10 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer">
          + Ajouter un équipement
        </button>
      )}
    </div>
  );
}

function EquipeTab({ zone, staff, onAssigned }) {
  const [showPicker, setShowPicker] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const [error, setError] = useState(null);

  const zoneStaff = useMemo(() => staff.filter((s) => s.poste === zone.nom), [staff, zone.nom]);
  const availableStaff = useMemo(() => staff.filter((s) => s.poste !== zone.nom), [staff, zone.nom]);

  const assign = async (member) => {
    setAssigning(member.id);
    setError(null);
    try {
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, poste: zone.nom }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setShowPicker(false);
      onAssigned();
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="space-y-3">
      {zoneStaff.length === 0 ? (
        <div className="text-sm text-[#9a7060] py-2">Personne assigné à cette zone</div>
      ) : (
        <div className="space-y-2">
          {zoneStaff.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5 rounded-xl border border-[#e5d5c5] bg-white p-3">
              <span
                className="rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                style={{ width: 32, height: 32, background: "#2c1a10" }}
              >
                {initials(s.name)}
              </span>
              <span className="font-bold text-sm text-[#2c1a10]">{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {error && <div className="text-xs font-bold text-red-600">{error}</div>}

      {showPicker ? (
        <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3 space-y-1 max-h-48 overflow-y-auto">
          {availableStaff.length === 0 ? (
            <div className="text-xs text-[#9a7060] text-center py-2">Personne d&apos;autre à assigner</div>
          ) : (
            availableStaff.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => assign(s)}
                disabled={assigning === s.id}
                className="w-full text-left rounded-xl px-3 py-2.5 text-sm font-bold text-[#2c1a10] hover:bg-[#f0e4d4] cursor-pointer disabled:opacity-50"
              >
                {assigning === s.id ? "Assignation…" : s.name}
              </button>
            ))
          )}
          <button type="button" onClick={() => setShowPicker(false)} className="w-full h-9 rounded-xl text-[#9a7060] font-bold text-xs cursor-pointer">
            Fermer
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowPicker(true)} className="w-full h-10 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer">
          + Assigner un membre
        </button>
      )}
    </div>
  );
}

function ZonePanel({ zone, taches, equipements, staff, onClose, onDataChanged }) {
  const [tab, setTab] = useState("taches");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div
        className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{zone.emoji || "📍"}</span>
            <h2 className="text-lg font-black text-[#2c1a10]">{zone.nom}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] cursor-pointer font-black"
          >
            ×
          </button>
        </div>

        <div className="flex gap-1.5 mb-4 rounded-2xl bg-[#f0e8dc] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 h-9 rounded-xl text-xs font-black cursor-pointer transition-colors ${
                tab === t.key ? "bg-white text-[#2c1a10] shadow-sm" : "text-[#9a7060]"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === "taches" && <TachesTab zone={zone} taches={taches} onCreated={onDataChanged} />}
        {tab === "equipements" && <EquipementsTab zone={zone} equipements={equipements} onCreated={onDataChanged} />}
        {tab === "equipe" && <EquipeTab zone={zone} staff={staff} onAssigned={onDataChanged} />}
      </div>
    </div>
  );
}

export default function RestaurantPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const { zonesPhysiques, equipements, taches, staff, refreshAll } = useAppContext();
  const [selectedZone, setSelectedZone] = useState(null);

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Restaurant</div>
      <h1 className="text-xl font-black text-[#2c1a10] -mt-3">Zones physiques</h1>

      <div className="space-y-3">
        {zonesPhysiques.map((zone) => {
          const zoneTaches = taches.filter((t) => t.zoneId === zone.id).length;
          const zoneEquipements = equipements.filter((e) => e.zoneId === zone.id).length;
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => setSelectedZone(zone)}
              className="w-full text-left rounded-2xl border border-[#e5d5c5] bg-white p-4 cursor-pointer active:scale-[0.99] transition-all hover:bg-[#faf5ef]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{zone.emoji || "📍"}</span>
                  <div>
                    <div className="font-black text-base text-[#2c1a10]">{zone.nom}</div>
                    {zone.description && <div className="text-xs text-[#9a7060]">{zone.description}</div>}
                  </div>
                </div>
                <span className="text-[#9a7060] shrink-0">→</span>
              </div>
              <div className="flex gap-4 mt-3 text-xs font-bold text-[#9a7060]">
                <span>{`${zoneTaches} tâche${zoneTaches !== 1 ? "s" : ""}`}</span>
                <span>{`${zoneEquipements} équipement${zoneEquipements !== 1 ? "s" : ""}`}</span>
                {zone.responsablePoste && <span>Responsable : {zone.responsablePoste}</span>}
              </div>
            </button>
          );
        })}
        {zonesPhysiques.length === 0 && (
          <div className="text-center text-sm text-[#9a7060] py-10">Aucune zone configurée</div>
        )}
      </div>

      {selectedZone && (
        <ZonePanel
          zone={selectedZone}
          taches={taches}
          equipements={equipements}
          staff={staff}
          onClose={() => setSelectedZone(null)}
          onDataChanged={refreshAll}
        />
      )}
    </div>
  );
}
