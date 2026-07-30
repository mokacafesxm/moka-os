"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

const SXM_TZ = "America/Puerto_Rico";
// Options du select "poste du jour" — doit rester identique aux options
// Notion créées sur MOKA_Planning (Lundi..Dimanche).
const JOUR_OPTIONS = ["Bar", "Cuisine", "Salle", "Plonge"];
const REPOS_POSTES = ["Repos", "Congé"];
const JOURS = [
  { key: "lundi", label: "Lun" },
  { key: "mardi", label: "Mar" },
  { key: "mercredi", label: "Mer" },
  { key: "jeudi", label: "Jeu" },
  { key: "vendredi", label: "Ven" },
  { key: "samedi", label: "Sam" },
  { key: "dimanche", label: "Dim" },
];

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

function todaySXM() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SXM_TZ }).format(new Date());
}
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// Semaine = lundi de la semaine (YYYY-MM-DD), pas un numéro de semaine ISO —
// plus simple à raisonner et à afficher, pas d'ambiguïté de norme.
function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0 dim..6 sam
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}
function formatShort(dateStr) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: SXM_TZ }).format(new Date(`${dateStr}T12:00:00Z`));
}

function Toast({ text }) {
  if (!text) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-2xl bg-[#2c1a10] text-white text-sm font-bold shadow-lg whitespace-nowrap">
      {text}
    </div>
  );
}

// "08:00" -> "08", "08:30" -> "08:30" — n'écourte que sur l'heure ronde, où
// l'ambiguïté est nulle ; garde les minutes sinon.
function shortHour(hhmm) {
  if (!hhmm) return "";
  return hhmm.endsWith(":00") ? hhmm.slice(0, 2) : hhmm;
}

function PosteChip({ poste, debut, fin, exception }) {
  if (!poste) return <span className="text-[#c8b4a8]">—</span>;
  const repos = REPOS_POSTES.includes(poste);
  const horaires = !repos && (debut || fin) ? `${shortHour(debut) || "—"}-${shortHour(fin) || "—"}` : null;
  if (repos) {
    return <span className={`text-[10px] font-bold ${exception ? "text-[#b45309]" : "text-[#9a7060]"}`}>{poste}</span>;
  }
  return (
    <span
      className={`inline-flex flex-col items-center gap-0.5 text-[10px] font-black px-1.5 py-1 rounded-lg whitespace-nowrap ${
        exception ? "bg-[#fef3c7] text-[#b45309]" : "bg-[#f0f7e5] text-[#5a7828]"
      }`}
    >
      <span>{poste}</span>
      {horaires && <span className="text-[9px] font-bold opacity-80">{horaires}</span>}
    </span>
  );
}

// Case du planning type — poste + horaires du jour en un seul geste de
// confirmation (bouton ✓), puisque les horaires varient d'un jour à
// l'autre (contrairement au mode exception, une simple dérogation
// ponctuelle où un tap direct sur le poste suffit).
function CellEditModal({ staffName, jourLabel, current, onSave, onClose, saving }) {
  const [poste, setPoste] = useState(current?.poste || "");
  const [debut, setDebut] = useState(current?.debut || "");
  const [fin, setFin] = useState(current?.fin || "");
  const isRepos = REPOS_POSTES.includes(poste);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">{staffName} — {jourLabel}</h2>

        <div className="grid grid-cols-2 gap-1.5">
          {JOUR_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPoste(p)}
              className={`h-11 rounded-xl text-sm font-bold cursor-pointer ${
                poste === p ? "bg-[#5a7828] text-white" : "bg-white border border-[#e5d5c5] text-[#2c1a10]"
              }`}
            >
              {p}
            </button>
          ))}
          {REPOS_POSTES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPoste(p)}
              className={`h-11 rounded-xl text-sm font-bold cursor-pointer ${
                poste === p ? "bg-[#9a7060] text-white" : "bg-white border border-[#e5d5c5] text-[#9a7060]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {!isRepos && (
          <div className="flex items-center gap-2">
            <label className="flex-1 space-y-1">
              <span className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide">Début</span>
              <input
                type="time"
                value={debut}
                onChange={(e) => setDebut(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
              />
            </label>
            <label className="flex-1 space-y-1">
              <span className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide">Fin</span>
              <input
                type="time"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
              />
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={() => onSave({ poste, debut: isRepos ? "" : debut, fin: isRepos ? "" : fin })}
          disabled={!poste || saving}
          className="w-full h-12 rounded-xl bg-[#5a7828] text-white font-black text-lg cursor-pointer disabled:opacity-50"
        >
          {saving ? "…" : "✓"}
        </button>
        <button type="button" onClick={onClose} className="w-full h-10 rounded-xl text-[#9a7060] font-bold text-xs cursor-pointer">
          Annuler
        </button>
      </div>
    </div>
  );
}

// Mode exception — dérogation ponctuelle pour une date précise (pas
// d'horaires propres, juste un poste) : un seul tap suffit, pas de bouton
// de confirmation séparé. Une option "revenir au planning type" permet
// d'annuler la dérogation pour cette date.
function PostePickerSheet({ staffName, jourLabel, isException, onPick, onClearException, onClose, saving }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">{staffName} — {jourLabel}</h2>

        <div className="grid grid-cols-2 gap-1.5">
          {JOUR_OPTIONS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={saving}
              onClick={() => onPick(p)}
              className="h-11 rounded-xl text-sm font-bold bg-white border border-[#e5d5c5] text-[#2c1a10] cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {p}
            </button>
          ))}
          {REPOS_POSTES.map((p) => (
            <button
              key={p}
              type="button"
              disabled={saving}
              onClick={() => onPick(p)}
              className="h-11 rounded-xl text-sm font-bold bg-white border border-[#e5d5c5] text-[#9a7060] cursor-pointer disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {p}
            </button>
          ))}
        </div>

        {isException && (
          <button
            type="button"
            disabled={saving}
            onClick={onClearException}
            className="w-full h-11 rounded-xl bg-white border border-[#e5d5c5] text-[#9a7060] font-bold text-xs cursor-pointer disabled:opacity-50"
          >
            ↩ Revenir au planning type
          </button>
        )}

        <button type="button" onClick={onClose} className="w-full h-10 rounded-xl text-[#9a7060] font-bold text-xs cursor-pointer">
          Annuler
        </button>
      </div>
    </div>
  );
}

function PlanningSection({ staff }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [pickerCell, setPickerCell] = useState(null); // { staffId, staffName, jour, jourLabel, dateISO? }
  const [savingKey, setSavingKey] = useState(null);
  const [toast, setToast] = useState(null);

  // Mode exception — dérogations ponctuelles au planning type pour UNE
  // semaine précise, stockées à part (MOKA_Assignations_Taches), jamais
  // écrites dans le planning type lui-même.
  const [exceptionMode, setExceptionMode] = useState(false);
  const [weekStart, setWeekStart] = useState(() => mondayOf(todaySXM()));
  const [exceptions, setExceptions] = useState([]);
  const [exceptionsLoading, setExceptionsLoading] = useState(false);

  const flashToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetch("/api/equipe/planning")
      .then(async (r) => {
        if (r.status === 503) return { notConfigured: true, rows: [] };
        const data = await r.json().catch(() => []);
        return { notConfigured: false, rows: Array.isArray(data) ? data : [] };
      })
      .then(({ notConfigured: nc, rows: r }) => {
        if (ignore) return;
        setNotConfigured(nc);
        setRows(r);
      })
      .catch(() => { if (!ignore) setNotConfigured(true); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!exceptionMode) return;
    let ignore = false;
    setExceptionsLoading(true);
    const from = weekStart;
    const to = addDays(weekStart, 6);
    fetch(`/api/task-assignments?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => { if (!ignore) setExceptions(Array.isArray(data) ? data : []); })
      .catch(() => { if (!ignore) setExceptions([]); })
      .finally(() => { if (!ignore) setExceptionsLoading(false); });
    return () => { ignore = true; };
  }, [exceptionMode, weekStart]);

  const rowsByStaff = useMemo(() => Object.fromEntries(rows.map((r) => [r.staffId, r])), [rows]);
  const dayIndex = useMemo(() => Object.fromEntries(JOURS.map((j, i) => [j.key, i])), []);
  // exceptionsByKey["staffId-YYYY-MM-DD"] -> exception row
  const exceptionsByKey = useMemo(
    () => Object.fromEntries(exceptions.map((e) => [`${e.staffId}-${e.date}`, e])),
    [exceptions]
  );

  const dateForJour = (jourKey) => addDays(weekStart, dayIndex[jourKey]);

  const openCell = (s, j) => {
    setPickerCell({
      staffId: s.id,
      staffName: s.name,
      jour: j.key,
      jourLabel: j.label,
      dateISO: exceptionMode ? dateForJour(j.key) : null,
    });
  };

  const pickTemplate = async ({ poste, debut, fin }) => {
    const { staffId, staffName, jour } = pickerCell;
    const key = `${staffId}-${jour}`;
    setSavingKey(key);
    try {
      const res = await fetch("/api/equipe/planning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, staffName, jour, poste, debut, fin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setRows((cur) => {
        const idx = cur.findIndex((r) => r.staffId === staffId);
        if (idx === -1) return [...cur, data.item];
        const next = [...cur];
        next[idx] = data.item;
        return next;
      });
      setPickerCell(null);
      flashToast("Mis à jour ✓");
    } catch {
      /* transient — la case garde son ancienne valeur affichée, le tap suivant réessaiera */
    } finally {
      setSavingKey(null);
    }
  };

  const pickException = async (poste) => {
    const { staffId, staffName, jour, dateISO } = pickerCell;
    const key = `${staffId}-${jour}`;
    setSavingKey(key);
    try {
      const existing = exceptionsByKey[`${staffId}-${dateISO}`];
      if (existing) await fetch(`/api/task-assignments?id=${existing.id}`, { method: "DELETE" });
      const res = await fetch("/api/task-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, staffName, date: dateISO, posteOverride: poste, type: "planning_exception" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setExceptions((cur) => [...cur.filter((e) => e.id !== existing?.id), data.item]);
      setPickerCell(null);
      flashToast("Exception enregistrée");
    } catch {
      /* transient */
    } finally {
      setSavingKey(null);
    }
  };

  const clearException = async () => {
    const { staffId, jour, dateISO } = pickerCell;
    const key = `${staffId}-${jour}`;
    const existing = exceptionsByKey[`${staffId}-${dateISO}`];
    if (!existing) { setPickerCell(null); return; }
    setSavingKey(key);
    try {
      await fetch(`/api/task-assignments?id=${existing.id}`, { method: "DELETE" });
      setExceptions((cur) => cur.filter((e) => e.id !== existing.id));
      setPickerCell(null);
      flashToast("Retour au planning type");
    } catch {
      /* transient */
    } finally {
      setSavingKey(null);
    }
  };

  if (notConfigured) {
    return (
      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4 text-sm text-[#9a7060]">
        Planning non configuré — base Notion pas encore créée (voir docs/ARCHITECTURE.md « Weekly Staff Planning »).
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        {exceptionMode ? (
          <>
            <button
              type="button"
              onClick={() => setWeekStart((s) => addDays(s, -7))}
              className="w-9 h-9 rounded-xl bg-white border border-[#e5d5c5] text-[#9a7060] font-black cursor-pointer shrink-0"
            >
              ←
            </button>
            <div className="text-sm font-black text-[#b45309] text-center">
              Exceptions — semaine du {formatShort(weekStart)}
            </div>
            <button
              type="button"
              onClick={() => setWeekStart((s) => addDays(s, 7))}
              className="w-9 h-9 rounded-xl bg-white border border-[#e5d5c5] text-[#9a7060] font-black cursor-pointer shrink-0"
            >
              →
            </button>
          </>
        ) : (
          <div className="text-sm font-black text-[#2c1a10]">Planning type</div>
        )}
        <button
          type="button"
          onClick={() => setExceptionMode((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-xs font-black cursor-pointer shrink-0 whitespace-nowrap ${
            exceptionMode ? "bg-[#2c1a10] text-white" : "bg-[#fef3c7] text-[#b45309]"
          }`}
        >
          {exceptionMode ? "✕ Quitter" : "✏️ Modifier cette semaine"}
        </button>
      </div>

      {loading || (exceptionMode && exceptionsLoading) ? (
        <div className="text-center text-sm text-[#9a7060] py-8">Chargement…</div>
      ) : staff.length === 0 ? (
        <div className="text-center text-sm text-[#9a7060] py-8">Aucun membre d&apos;équipe actif</div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="min-w-[640px] w-full border-separate" style={{ borderSpacing: "0 6px" }}>
            <thead>
              <tr>
                <th className="text-left text-[10px] font-black text-[#9a7060] uppercase tracking-wide pb-1 pl-1">Staff</th>
                {JOURS.map((j) => (
                  <th key={j.key} className="text-center text-[10px] font-black text-[#9a7060] uppercase tracking-wide pb-1 w-20">
                    {j.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const row = rowsByStaff[s.id] || {};
                return (
                  <tr key={s.id} className="bg-white">
                    <td className="rounded-l-2xl border-y border-l border-[#e5d5c5] px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                          style={{ width: 26, height: 26, background: "#2c1a10" }}
                        >
                          {initials(s.name)}
                        </span>
                        <span className="text-xs font-bold text-[#2c1a10] whitespace-nowrap">{s.name}</span>
                      </div>
                    </td>
                    {JOURS.map((j, i) => {
                      const key = `${s.id}-${j.key}`;
                      const exception = exceptionMode ? exceptionsByKey[`${s.id}-${dateForJour(j.key)}`] : null;
                      const templateDay = row.jours?.[j.key] || {};
                      const poste = exceptionMode ? (exception?.posteOverride || templateDay.poste || "") : (templateDay.poste || "");
                      return (
                        <td
                          key={j.key}
                          className={`border-y border-[#e5d5c5] text-center py-2 cursor-pointer ${i === JOURS.length - 1 ? "rounded-r-2xl border-r" : ""} ${exception ? "bg-[#fffbeb]" : ""}`}
                          onClick={() => openCell(s, j)}
                        >
                          {savingKey === key ? (
                            <span className="text-[10px] text-[#9a7060]">…</span>
                          ) : (
                            <PosteChip poste={poste} debut={templateDay.debut} fin={templateDay.fin} exception={Boolean(exception)} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pickerCell && (exceptionMode ? (
        <PostePickerSheet
          staffName={pickerCell.staffName}
          jourLabel={`${pickerCell.jourLabel} ${formatShort(pickerCell.dateISO)}`}
          isException={Boolean(exceptionsByKey[`${pickerCell.staffId}-${pickerCell.dateISO}`])}
          onPick={pickException}
          onClearException={clearException}
          onClose={() => setPickerCell(null)}
          saving={savingKey === `${pickerCell.staffId}-${pickerCell.jour}`}
        />
      ) : (
        <CellEditModal
          staffName={pickerCell.staffName}
          jourLabel={pickerCell.jourLabel}
          current={rowsByStaff[pickerCell.staffId]?.jours?.[pickerCell.jour] || null}
          onSave={pickTemplate}
          onClose={() => setPickerCell(null)}
          saving={savingKey === `${pickerCell.staffId}-${pickerCell.jour}`}
        />
      ))}

      <Toast text={toast} />
    </div>
  );
}

function AssignTaskSection({ staff }) {
  const { selectedStaff } = useStaffContext();
  const [taches, setTaches] = useState([]);
  const [staffId, setStaffId] = useState("");
  const [tacheId, setTacheId] = useState("");
  const [date, setDate] = useState(todaySXM());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    fetch("/api/taches").then((r) => r.json()).then((data) => setTaches(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const assign = async () => {
    if (!staffId || !tacheId) { setError("Staff et tâche requis"); return; }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const tache = taches.find((t) => t.id === tacheId);
      // MOKA_TACHES est un gabarit partagé par zone (pas de champ Staff/Date) et
      // MOKA_EXECUTIONS_TACHES est lu ailleurs comme "cette ligne = déjà fait"
      // (taches/page.jsx) — une assignation en attente vit donc dans sa propre
      // base, MOKA_Assignations_Taches (voir docs/ARCHITECTURE.md « Weekly
      // Staff Planning »).
      const res = await fetch("/api/task-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          staffName: staff.find((s) => s.id === staffId)?.name,
          tacheId,
          tacheNom: tache?.nom,
          date,
          note,
          assignePar: selectedStaff?.id,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        if (res.status === 503) throw new Error("Planning non configuré — base Notion pas encore créée");
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      setSuccess("Tâche assignée");
      setTacheId("");
      setNote("");
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4 space-y-2.5">
      <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-full h-11 px-3.5 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]">
        <option value="">Staff…</option>
        {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select value={tacheId} onChange={(e) => setTacheId(e.target.value)} className="w-full h-11 px-3.5 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]">
        <option value="">Tâche…</option>
        {taches.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
      </select>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full h-11 px-3.5 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optionnel)"
        className="w-full h-11 px-3.5 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
      />
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
      {success && <div className="text-xs font-bold text-[#5a7828]">{success}</div>}
      <button
        type="button"
        onClick={assign}
        disabled={saving}
        className="w-full h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50"
      >
        {saving ? "…" : "Assigner"}
      </button>
    </div>
  );
}

export default function EquipePage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const { staff } = useAppContext();

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  const activeStaff = useMemo(() => staff.filter((s) => s.actif !== false), [staff]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-dvh px-4 py-4 space-y-5" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Opérationnel</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">Équipe</h1>
      </div>

      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">Planning type</div>
        <PlanningSection staff={activeStaff} />
      </div>

      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">Assigner une tâche personnelle</div>
        <AssignTaskSection staff={activeStaff} />
      </div>
    </div>
  );
}
