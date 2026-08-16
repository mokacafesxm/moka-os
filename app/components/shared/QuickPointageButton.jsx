"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

const SXM_TZ = "America/Puerto_Rico";

function getName(member) {
  return member?.name || member?.prenom || member?.nom || "Staff";
}

function formatHeures(decimal) {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function formatDepuis(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: SXM_TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

// Managers/Admin ne pointent pas (voir StaffContext.unlockAdminAs) — jamais
// d'action de pointage pertinente pour eux, donc exclus de la liste V1.
function isPointable(member) {
  return !(member?.access?.includes("Admin") && member?.poste === "Manager Général");
}

const ACTIONS_FOR_STATUS = {
  absent: [{ action: "Arrivée", label: "✅ Arriver", style: "bg-[#5a7828] text-white" }],
  done: [{ action: "Arrivée", label: "✅ Arriver", style: "bg-[#5a7828] text-white" }],
  present: [
    { action: "Départ pause", label: "☕ Pause", style: "bg-[#f7efe4] text-[#2c1a10] border border-[#e5d5c5]" },
    { action: "Départ", label: "🔴 Fin de service", style: "bg-[#fee2e2] text-red-700 border border-red-200" },
  ],
  pause: [
    { action: "Retour pause", label: "▶️ Retour pause", style: "bg-[#5a7828] text-white" },
    { action: "Départ", label: "🔴 Fin de service", style: "bg-[#fee2e2] text-red-700 border border-red-200" },
  ],
};

function StatusLine({ status, since }) {
  if (status === "present") {
    return <span className="text-sm text-[#9a7060]">● En service{since ? ` depuis ${since}` : ""}</span>;
  }
  if (status === "pause") {
    return <span className="text-sm text-[#9a7060]">⏸ En pause{since ? ` depuis ${since}` : ""}</span>;
  }
  return <span className="text-sm text-[#9a7060]">○ Non pointé</span>;
}

// Pointage rapide "V1" — pill rose, liste de TOUT le staff pointable (pas
// seulement la session active), pour qu'un collègue pointe sans changer de
// session (voir StaffContext.clockActionFor). Chaque ligne affiche statut +
// action(s) directement, pas de sélection en 2 étapes. `shortcutMember`, s'il
// est fourni, affiche un raccourci direct pour ce staff-là (déjà en session)
// à côté du bouton "choisir un autre" plutôt que d'obliger à rouvrir la liste.
export default function QuickPointageButton({ staff, clockStatuses, clockStatusTimes, onPick, onPicked, shortcutMember, hoursWorked, className }) {
  const [open, setOpen] = useState(false);
  const [busyName, setBusyName] = useState(null);
  const [toast, setToast] = useState(null);

  const pointableStaff = (staff || []).filter(isPointable);

  const fire = async (member, action) => {
    const name = getName(member);
    setBusyName(name);
    try {
      const result = await onPick(member, action);
      setToast(`${name} — ${action}`);
      setTimeout(() => setToast(null), 2500);
      // Optionnel — laisse l'appelant réagir au résultat du pointage (ex.
      // redirection vers /checklist si l'ouverture du poste vient d'être
      // déclenchée, voir SplashScreen). Le résultat vient de /api/clock via
      // StaffContext.clockActionFor, jamais recalculé ici.
      onPicked?.(member, action, result);
    } catch {
      /* transient — le staff peut réessayer */
    } finally {
      setBusyName(null);
    }
  };

  const shortcutName = shortcutMember ? getName(shortcutMember) : null;
  const shortcutStatus = shortcutName ? (clockStatuses[shortcutName] || "absent") : "absent";
  const shortcutLabel =
    shortcutStatus === "present" ? `⏱ En service${hoursWorked ? ` · ${formatHeures(hoursWorked)}` : ""}` :
    shortcutStatus === "pause" ? "⏱ Pause en cours" :
    "⏱ Pointage";

  return (
    <>
      {shortcutMember ? (
        <div className={`flex items-center gap-2.5 ${className || ""}`}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-[#e8336d] text-white font-black text-sm px-4 py-2.5 cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform"
          >
            {shortcutLabel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`rounded-full bg-[#e8336d] text-white font-black text-sm px-4 py-2.5 cursor-pointer whitespace-nowrap active:scale-[0.98] transition-transform ${className || ""}`}
        >
          ⏱ Pointage
        </button>
      )}

      {open && createPortal(
        // Portail vers document.body : SplashScreen fait glisser ses 2 phases
        // via un `transform` sur un ancêtre, ce qui crée un containing block
        // CSS pour tout `position: fixed` descendant — sans portail, "fixed
        // inset-0" se positionnait relatif à ce conteneur (200% de large,
        // translaté), pas au vrai viewport, et la modale s'affichait décalée/
        // coupée à droite (piégé en vérification visuelle avant ce fix).
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-[#e5d5c5] mx-auto mt-3 sm:hidden" />
            <h2 className="text-base font-black text-[#2c1a10] px-5 pt-4 pb-2">Équipe</h2>

            {pointableStaff.map((member) => {
              const name = getName(member);
              const status = clockStatuses[name] || "absent";
              const since = formatDepuis(clockStatusTimes?.[name]);
              const busy = busyName === name;
              return (
                <div key={member.id || name} className="px-5 py-4 border-b border-[#f5ede0]">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-base font-black text-[#2c1a10]">{name}</span>
                    <StatusLine status={status} since={since} />
                  </div>
                  <div className="flex items-center gap-2">
                    {ACTIONS_FOR_STATUS[status].map((a) => (
                      <button
                        key={a.action}
                        type="button"
                        disabled={busy}
                        onClick={() => fire(member, a.action)}
                        className={`rounded-xl px-4 py-2 text-sm font-black disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-transform ${a.style}`}
                      >
                        {busy ? "…" : a.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {pointableStaff.length === 0 && (
              <div className="text-sm text-[#9a7060] text-center py-8">Chargement de l&apos;équipe…</div>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full h-12 text-[#9a7060] font-bold text-xs cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>,
        document.body
      )}

      {toast && createPortal(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-2xl bg-[#2c1a10] text-white text-sm font-bold shadow-lg whitespace-nowrap">
          {toast}
        </div>,
        document.body
      )}
    </>
  );
}
