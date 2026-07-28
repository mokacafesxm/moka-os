"use client";

// Sprint 16 — statut ouvert/fermé par poste (Bar/Cuisine/Salle/Plonge),
// persisté en localStorage sous une clé datée SXM ("mokaBarStatus_2026-07-28")
// — le reset quotidien à minuit SXM est donc automatique : une nouvelle date
// produit une clé inexistante, jamais besoin de la nettoyer explicitement.

const SXM_TZ = "America/Puerto_Rico";

export function getSXMDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SXM_TZ }).format(date);
}

const STATUS_KEY_PREFIX = {
  Bar: "mokaBarStatus",
  Cuisine: "mokaCuisineStatus",
  Salle: "mokaSalleStatus",
  Plonge: "mokaPlongeStatus",
};

export function getPosteStatus(poste) {
  if (typeof window === "undefined") return null;
  const prefix = STATUS_KEY_PREFIX[poste];
  if (!prefix) return null;
  try {
    const raw = localStorage.getItem(`${prefix}_${getSXMDateString()}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setPosteStatus(poste, status) {
  if (typeof window === "undefined") return;
  const prefix = STATUS_KEY_PREFIX[poste];
  if (!prefix) return;
  try {
    localStorage.setItem(`${prefix}_${getSXMDateString()}`, JSON.stringify({ status, at: new Date().toISOString() }));
  } catch {
    // localStorage indisponible (mode privé, quota) — le statut ne persiste
    // pas mais l'action elle-même (workflow, session) reste valide.
  }
}

// Workflows qui, une fois terminés (voir WorkflowRunner.jsx), font basculer
// automatiquement le statut ouvert/fermé du poste correspondant.
export const WORKFLOW_STATUS_EFFECT = {
  "ouverture-bar": { poste: "Bar", status: "open" },
  "fermeture-bar": { poste: "Bar", status: "closed" },
  "ouverture-cuisine": { poste: "Cuisine", status: "open" },
  "fermeture-cuisine": { poste: "Cuisine", status: "closed" },
  "ouverture-salle": { poste: "Salle", status: "open" },
  "fermeture-salle": { poste: "Salle", status: "closed" },
};
