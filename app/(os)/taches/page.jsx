"use client";

import { useEffect, useMemo, useState } from "react";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

function getSXMDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Puerto_Rico",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function WorkflowStepModal({ tache, onClose, onSubmit, submitting }) {
  const [temperature, setTemperature] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[#f7efe4] border border-[#e5d5c5] shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-1">Valider la tâche</div>
        <h2 className="text-lg font-black text-[#2c1a10] mb-4">{tache.nom}</h2>

        {tache.necessiteTemperature ? (
          <div className="mb-4">
            <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">
              Température (°C)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full rounded-xl border border-[#e5d5c5] bg-white px-3 py-2.5 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
              placeholder="ex: 4"
            />
          </div>
        ) : (
          <p className="text-sm text-[#9a7060] mb-4">Confirmer que cette tâche est terminée ?</p>
        )}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl border border-[#e5d5c5] bg-white font-black text-sm text-[#9a7060] cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={submitting || (tache.necessiteTemperature && temperature === "")}
            onClick={() => onSubmit(temperature === "" ? null : Number(temperature))}
            className="flex-1 h-12 rounded-2xl bg-[#5a7828] text-white font-black text-sm disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "…" : "Valider"}
          </button>
        </div>
      </div>
    </div>
  );
}

// UX audit (28 jul 2026) — "Faites" n'avait pas de repli : une journée
// productive repoussait "À faire" plus bas que nécessaire. Au-delà de 3
// tâches faites, on replie derrière un <details> — Skill 11, disclosure
// progressive — au lieu d'étendre la liste indéfiniment.
function TaskGroup({ title, color, items, onSelect, collapsible }) {
  if (items.length === 0) return null;
  const list = (
    <div className="space-y-2">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect?.(t)}
          disabled={!onSelect}
          className="w-full text-left rounded-2xl border border-[#e5d5c5] bg-white p-3.5 flex items-center justify-between gap-2 cursor-pointer disabled:cursor-default"
        >
          <div>
            <div className="font-black text-sm text-[#2c1a10]">{t.nom}</div>
            <div className="text-[10px] text-[#9a7060] font-semibold mt-1">{t.frequence} · {t.moment}</div>
          </div>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        </button>
      ))}
    </div>
  );

  if (collapsible && items.length > 3) {
    return (
      <details className="mb-4">
        <summary className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 cursor-pointer" style={{ color }}>
          {title} ({items.length}) — voir ▾
        </summary>
        <div className="mt-2">{list}</div>
      </details>
    );
  }

  return (
    <div className="mb-4">
      <div className="text-[10px] font-black uppercase tracking-[0.3em] mb-2" style={{ color }}>
        {title} ({items.length})
      </div>
      {list}
    </div>
  );
}

export default function TachesPage() {
  const { selectedStaff, selectedStaffName, poste } = useStaffContext();
  const { zonesPhysiques } = useAppContext();

  const [executions, setExecutions] = useState([]);
  const [myTaches, setMyTaches] = useState([]);
  const [selectedTache, setSelectedTache] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const todaySXM = getSXMDateString();

  const refreshExecutions = () => {
    fetch(`/api/executions-taches?date=${todaySXM}`)
      .then((r) => r.json())
      .then((data) => setExecutions(Array.isArray(data) ? data : []))
      .catch((error) => console.error("[TachesPage] executions fetch failed", error));
  };

  useEffect(() => {
    refreshExecutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtrées côté serveur par zone du poste connecté (voir
  // /api/taches?zone=) : Jeanne (Salle) ne voit que Zone=Salle, jamais les
  // tâches des autres postes.
  const zoneId = useMemo(() => zonesPhysiques.find((z) => z.nom === poste)?.id || null, [zonesPhysiques, poste]);

  useEffect(() => {
    if (!zoneId) { setMyTaches([]); return; }
    fetch(`/api/taches?zone=${zoneId}`)
      .then((r) => r.json())
      .then((data) => setMyTaches(Array.isArray(data) ? data.filter((t) => t.actif !== false) : []))
      .catch((error) => console.error("[TachesPage] taches fetch failed", error));
  }, [zoneId]);

  const doneTacheIds = new Set(executions.map((e) => e.tacheId));

  const { urgentes, aFaire, faites } = useMemo(() => {
    const done = [];
    const urgent = [];
    const normal = [];
    myTaches.forEach((t) => {
      if (doneTacheIds.has(t.id)) { done.push(t); return; }
      if (t.priorite === "Critique" || t.priorite === "Haute") urgent.push(t);
      else normal.push(t);
    });
    return { urgentes: urgent, aFaire: normal, faites: done };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTaches, executions]);

  const handleSubmit = async (valeurTemperature) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/executions-taches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: `${selectedTache.nom} — ${todaySXM}`,
          tacheId: selectedTache.id,
          staffId: selectedStaff?.id,
          statut: "Fait",
          valeurTemperature,
        }),
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      refreshExecutions();
      setSelectedTache(null);
    } catch (error) {
      console.error("[TachesPage] submit failed", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh px-4 py-4" style={{ background: "#f7efe4" }}>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Mes Tâches</div>
      <h1 className="text-xl font-black text-[#2c1a10] mb-4">
        {selectedStaffName ? `Aujourd'hui, ${selectedStaffName}` : "Aujourd'hui"}
      </h1>

      {myTaches.length === 0 ? (
        <div className="text-center text-sm text-[#9a7060] py-10">Aucune tâche pour l&apos;instant</div>
      ) : (
        <>
          <TaskGroup title="Urgentes" color="#b91c1c" items={urgentes} onSelect={setSelectedTache} />
          <TaskGroup title="À faire" color="#d97706" items={aFaire} onSelect={setSelectedTache} />
          <TaskGroup title="Faites" color="#5a7828" items={faites} collapsible />
        </>
      )}

      {selectedTache && (
        <WorkflowStepModal
          tache={selectedTache}
          submitting={submitting}
          onClose={() => setSelectedTache(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
