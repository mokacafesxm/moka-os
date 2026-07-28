"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";
import DeclareIncidentModal from "../../components/shared/DeclareIncidentModal";

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

// Boutons d'action — même logique partagée par la card (liste) et le modal
// détail : "Ouvert" → prendre en charge, "En cours" → résoudre, sinon rien
// (Résolu/Fermé n'ont plus d'action).
function IncidentActions({ incident, onTakeCharge, onOpenResolve, busy }) {
  if (incident.statut === "Ouvert") {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onTakeCharge(incident); }}
        disabled={busy}
        className="w-full py-2.5 rounded-xl bg-[#2c1a10] text-white text-xs font-black cursor-pointer disabled:opacity-50"
      >
        ▶ Prendre en charge
      </button>
    );
  }
  if (incident.statut === "En cours") {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenResolve(incident); }}
        disabled={busy}
        className="w-full py-2.5 rounded-xl bg-[#5a7828] text-white text-xs font-black cursor-pointer disabled:opacity-50"
      >
        ✅ Résoudre
      </button>
    );
  }
  return null;
}

function IncidentCard({ incident, zoneById, staffById, onOpenDetail, onTakeCharge, onOpenResolve, busy }) {
  const hasAction = incident.statut === "Ouvert" || incident.statut === "En cours";
  return (
    <div
      className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5 cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => onOpenDetail(incident)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-black text-sm text-[#2c1a10]">{incident.titre}</div>
        <span
          className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
          style={{ color: CRITICITE_COLOR[incident.criticite] || "#9a7060", background: `${CRITICITE_COLOR[incident.criticite] || "#9a7060"}1a` }}
        >
          {incident.criticite || "—"}
        </span>
      </div>
      <div className="text-[11px] text-[#9a7060] font-semibold mt-1">
        {zoneById[incident.zoneId]?.nom || "Zone inconnue"} · {staffById[incident.declareParId]?.name || "—"} · {formatDateHeure(incident.dateHeure)}
      </div>
      {hasAction && (
        <div className="mt-2.5">
          <IncidentActions incident={incident} onTakeCharge={onTakeCharge} onOpenResolve={onOpenResolve} busy={busy} />
        </div>
      )}
    </div>
  );
}

function IncidentDetailModal({ incident, zoneById, staffById, onClose, onTakeCharge, onOpenResolve, busy }) {
  const hasAction = incident.statut === "Ouvert" || incident.statut === "En cours";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-black text-[#2c1a10]">{incident.titre}</h2>
          <span
            className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
            style={{ color: CRITICITE_COLOR[incident.criticite] || "#9a7060", background: `${CRITICITE_COLOR[incident.criticite] || "#9a7060"}1a` }}
          >
            {incident.criticite || "—"}
          </span>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-[#9a7060]">Zone</span><span className="font-bold text-[#2c1a10]">{zoneById[incident.zoneId]?.nom || "—"}</span></div>
          <div className="flex justify-between"><span className="text-[#9a7060]">Catégorie</span><span className="font-bold text-[#2c1a10]">{incident.categorie || "—"}</span></div>
          <div className="flex justify-between"><span className="text-[#9a7060]">Criticité</span><span className="font-bold text-[#2c1a10]">{incident.criticite || "—"}</span></div>
          <div className="flex justify-between"><span className="text-[#9a7060]">Déclaré par</span><span className="font-bold text-[#2c1a10]">{staffById[incident.declareParId]?.name || "—"}</span></div>
          <div className="flex justify-between"><span className="text-[#9a7060]">Date / heure</span><span className="font-bold text-[#2c1a10]">{formatDateHeure(incident.dateHeure)}</span></div>
        </div>

        {incident.description && (
          <div className="pt-2 border-t border-[#e5d5c5] mt-2">
            <div className="text-[10px] font-bold text-[#9a7060] uppercase mb-1">Description</div>
            <div className="text-xs text-[#2c1a10] whitespace-pre-wrap">{incident.description}</div>
          </div>
        )}

        {incident.actionsPrises && (
          <div className="pt-2 border-t border-[#e5d5c5] mt-2">
            <div className="text-[10px] font-bold text-[#9a7060] uppercase mb-1">Actions prises</div>
            <div className="text-xs text-[#2c1a10] whitespace-pre-wrap">{incident.actionsPrises}</div>
          </div>
        )}

        {incident.statut === "Résolu" && incident.resolution && (
          <div className="pt-2 border-t border-[#e5d5c5] mt-2">
            <div className="text-[10px] font-bold text-[#5a7828] uppercase mb-1">Résolution</div>
            <div className="text-xs text-[#2c1a10] whitespace-pre-wrap">{incident.resolution}</div>
          </div>
        )}

        {hasAction && (
          <div className="pt-1">
            <IncidentActions incident={incident} onTakeCharge={onTakeCharge} onOpenResolve={onOpenResolve} busy={busy} />
          </div>
        )}

        <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
          Fermer
        </button>
      </div>
    </div>
  );
}

function ResolveIncidentModal({ incident, onClose, onConfirm, saving }) {
  const [resolution, setResolution] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">✅ Résoudre — {incident.titre}</h2>
        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Résolution</label>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={4}
            autoFocus
            className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] resize-none"
            placeholder="Comment l'incident a été résolu…"
          />
        </div>
        <div className="flex gap-3 pt-1" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onConfirm(resolution)}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50 hover:bg-[#4e6a22] transition-colors"
          >
            {saving ? "…" : "Confirmer résolution"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IncidentsPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const { zonesPhysiques, staff } = useAppContext();

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeclare, setShowDeclare] = useState(false);
  const [detailIncident, setDetailIncident] = useState(null);
  const [resolvingIncident, setResolvingIncident] = useState(null);
  const [busyId, setBusyId] = useState(null);
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

  const patchIncident = async (id, patch) => {
    const res = await fetch("/api/incidents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
  };

  const handleTakeCharge = async (incident) => {
    setBusyId(incident.id);
    try {
      await patchIncident(incident.id, { statut: "En cours" });
      setIncidents((list) => list.map((i) => (i.id === incident.id ? { ...i, statut: "En cours" } : i)));
      setDetailIncident((d) => (d?.id === incident.id ? { ...d, statut: "En cours" } : d));
      setToast({ text: "Pris en charge", type: "success" });
    } catch (err) {
      setToast({ text: "Erreur : " + err.message, type: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const handleResolve = async (resolution) => {
    const incident = resolvingIncident;
    if (!incident) return;
    setBusyId(incident.id);
    try {
      await patchIncident(incident.id, { statut: "Résolu", resolution });
      setIncidents((list) => list.map((i) => (i.id === incident.id ? { ...i, statut: "Résolu", resolution } : i)));
      setResolvingIncident(null);
      setDetailIncident(null);
      setToast({ text: "Incident résolu", type: "success" });
    } catch (err) {
      setToast({ text: "Erreur : " + err.message, type: "error" });
    } finally {
      setBusyId(null);
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
                    <IncidentCard
                      key={inc.id}
                      incident={inc}
                      zoneById={zoneById}
                      staffById={staffById}
                      onOpenDetail={setDetailIncident}
                      onTakeCharge={handleTakeCharge}
                      onOpenResolve={setResolvingIncident}
                      busy={busyId === inc.id}
                    />
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
          onClick={() => setShowDeclare(true)}
          className="w-full h-12 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer shadow-lg"
        >
          🚨 Déclarer un incident
        </button>
      </div>

      {showDeclare && (
        <DeclareIncidentModal
          onClose={() => setShowDeclare(false)}
          onDeclared={() => { setToast({ text: "Incident déclaré", type: "success" }); loadIncidents(); }}
        />
      )}

      {detailIncident && (
        <IncidentDetailModal
          incident={detailIncident}
          zoneById={zoneById}
          staffById={staffById}
          onClose={() => setDetailIncident(null)}
          onTakeCharge={handleTakeCharge}
          onOpenResolve={setResolvingIncident}
          busy={busyId === detailIncident.id}
        />
      )}

      {resolvingIncident && (
        <ResolveIncidentModal
          incident={resolvingIncident}
          onClose={() => setResolvingIncident(null)}
          onConfirm={handleResolve}
          saving={busyId === resolvingIncident.id}
        />
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
