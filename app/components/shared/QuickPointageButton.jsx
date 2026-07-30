"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

function getName(member) {
  return member?.name || member?.prenom || member?.nom || "Staff";
}

function formatHeures(decimal) {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

// Liste "Qui pointe ?" — 2 états seulement (le choix Pause/Fin de service se
// fait dans le sheet d'actions juste après, pas ici).
const STATUS_LABEL = {
  present: "● En service",
  pause: "● En service",
  done: "○ Non pointé",
  absent: "○ Non pointé",
};

// Actions disponibles par statut — même logique que ClockSheet (Mon Poste) :
// absent/done n'ont qu'un choix (Arrivée), present/pause ont un vrai choix
// (Début pause vs Fin de service, Retour pause vs Fin de service). Généralisé
// ici à N'IMPORTE QUEL staff, pas seulement la session active.
const ACTIONS_FOR_STATUS = {
  absent: [{ action: "Arrivée", label: "✅ Arrivée", style: "bg-[#5a7828] text-white" }],
  done: [{ action: "Arrivée", label: "✅ Arrivée", style: "bg-[#5a7828] text-white" }],
  present: [
    { action: "Départ pause", label: "☕ Début pause", style: "bg-white border border-[#e5d5c5] text-[#2c1a10]" },
    { action: "Départ", label: "🔴 Fin de service", style: "bg-[#b91c1c] text-white" },
  ],
  pause: [
    { action: "Retour pause", label: "▶ Retour pause", style: "bg-[#5a7828] text-white" },
    { action: "Départ", label: "🔴 Fin de service", style: "bg-[#b91c1c] text-white" },
  ],
};

// Pointage rapide "V1" — pill rose, liste de TOUT le staff (pas seulement la
// session active), pour qu'un collègue pointe sans changer de session (voir
// StaffContext.clockActionFor). `shortcutMember`, s'il est fourni, affiche un
// raccourci direct pour ce staff-là (déjà en session) à côté du bouton
// "choisir un autre" plutôt que d'obliger à rouvrir la liste complète.
export default function QuickPointageButton({ staff, clockStatuses, onPick, shortcutMember, hoursWorked, className }) {
  const [open, setOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState(null); // membre en attente d'un choix d'action
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const fire = async (member, action) => {
    setBusy(true);
    try {
      await onPick(member, action);
      setToast(`${getName(member)} — ${action}`);
      setTimeout(() => setToast(null), 2500);
    } catch {
      /* transient — le staff peut réessayer */
    } finally {
      setBusy(false);
      setActionsFor(null);
      setOpen(false);
    }
  };

  const selectMember = (member) => {
    const status = clockStatuses[getName(member)] || "absent";
    const actions = ACTIONS_FOR_STATUS[status];
    if (actions.length === 1) {
      fire(member, actions[0].action);
    } else {
      setActionsFor(member);
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
            onClick={() => selectMember(shortcutMember)}
            disabled={busy}
            className="rounded-full bg-[#e8336d] text-white font-black text-sm px-4 py-2.5 cursor-pointer disabled:opacity-50 whitespace-nowrap active:scale-[0.98] transition-transform"
          >
            {busy ? "…" : shortcutLabel}
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-[11px] font-bold text-[#9a7060] underline cursor-pointer whitespace-nowrap"
          >
            ou choisir un autre
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
            className="relative w-full sm:max-w-sm max-h-[70vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-black text-[#2c1a10] mb-1">Qui pointe ?</h2>
            {staff.map((member) => {
              const name = getName(member);
              const status = clockStatuses[name] || "absent";
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => selectMember(member)}
                  disabled={busy}
                  className="w-full flex items-center justify-between rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-left cursor-pointer disabled:opacity-50 hover:bg-[#f0e4d4] transition-colors"
                >
                  <span className="font-bold text-sm text-[#2c1a10]">{name}</span>
                  <span className="text-[10px] font-bold text-[#9a7060]">{STATUS_LABEL[status]}</span>
                </button>
              );
            })}
            {staff.length === 0 && (
              <div className="text-sm text-[#9a7060] text-center py-4">Chargement de l&apos;équipe…</div>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full h-10 rounded-xl text-[#9a7060] font-bold text-xs cursor-pointer mt-1"
            >
              Fermer
            </button>
          </div>
        </div>,
        document.body
      )}

      {actionsFor && createPortal(
        <div className="fixed inset-0 z-[121] flex items-end sm:items-center justify-center" onClick={() => setActionsFor(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full sm:max-w-xs rounded-t-3xl sm:rounded-3xl bg-[#f7efe4] border-t sm:border border-[#e5d5c5] shadow-2xl p-5 pb-8 sm:pb-5 space-y-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-[#e5d5c5] mx-auto mb-2 sm:hidden" />
            <h2 className="text-base font-black text-[#2c1a10] mb-1">{getName(actionsFor)}</h2>
            {ACTIONS_FOR_STATUS[clockStatuses[getName(actionsFor)] || "absent"].map((a) => (
              <button
                key={a.action}
                type="button"
                disabled={busy}
                onClick={() => fire(actionsFor, a.action)}
                className={`w-full h-12 rounded-2xl font-black text-sm disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-transform ${a.style}`}
              >
                {busy ? "…" : a.label}
              </button>
            ))}
            <button type="button" onClick={() => setActionsFor(null)} className="w-full h-11 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
              Annuler
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
