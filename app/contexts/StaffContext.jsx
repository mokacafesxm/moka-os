"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRealTime } from "./RealTimeContext";

const CLOCK_URL = "/api/clock";
const CLOCK_STATUS_URL = "/api/clock-status";
const SESSION_KEY = "mokaStaffSession";
const ZONE_KEY = "mokaMyZone";
const POSTE_KEY = "mokaSelectedPoste";
const CLOCK_CACHE_KEY = "mokaClockStatuses"; // même clé que page.js — un seul cache partagé

function loadClockStatusesCache() {
  if (typeof window === "undefined") return {};
  try {
    const today = new Date().toISOString().slice(0, 10);
    const saved = JSON.parse(localStorage.getItem(CLOCK_CACHE_KEY) || "{}");
    if (saved.date !== today) return {};

    const afterReset = new Date().getHours() >= 18;
    if (afterReset && !saved.resetDone) {
      localStorage.setItem(CLOCK_CACHE_KEY, JSON.stringify({ date: today, resetDone: true, statuses: {} }));
      return {};
    }
    return saved.statuses || {};
  } catch {
    return {};
  }
}

function saveClockStatusesCache(statuses) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(CLOCK_CACHE_KEY, JSON.stringify({ date: today, resetDone: false, statuses }));
}

function loadSession() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function loadZone() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(ZONE_KEY) || "null");
  } catch {
    return null;
  }
}

function loadPoste() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem(POSTE_KEY) || "null");
  } catch {
    return null;
  }
}

// Sprint 17 — /parametres' Sécurité section stores new PINs hashed (never
// plain text). checkPin below accepts either form so a PIN set by the old
// plain-text flow (legacy page.js, or the "3578" factory default) keeps
// working after this change — only newly-saved PINs are ever hashed.
export function simpleHash(str) {
  let hash = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

const STATUS_AFTER_ACTION = {
  "Arrivée": "present",
  "Départ pause": "pause",
  "Retour pause": "present",
  "Départ": "done",
};

const StaffContext = createContext(null);

export function StaffProvider({ children }) {
  const { subscribe } = useRealTime();

  // Ces 3 états démarrent volontairement "vides" (identiques au rendu SSR, où
  // localStorage n'existe pas) puis se chargent dans un useEffect après le
  // montage — lire localStorage dans l'initializer de useState fait diverger
  // le premier rendu client du HTML serveur et déclenche une erreur
  // d'hydratation React (constaté en test navigateur sur /poste).
  const [selectedStaff, setSelectedStaffState] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clockStatuses, setClockStatuses] = useState({});
  const [clockStatusTimes, setClockStatusTimes] = useState({}); // staffName -> ISO date du dernier pointage (voir /api/clock-status "__times")
  const [clockSending, setClockSending] = useState(false);
  const [myTasks, setMyTasks] = useState([]); // dérivé côté page /taches (Sprint 4) depuis AppContext.taches
  const [myZone, setMyZoneState] = useState(null);
  const [poste, setPosteState] = useState(null); // Sprint 11 — poste-first entry flow (/poste)
  // Sprint 12 — never loaded from/written to localStorage on purpose: a
  // fresh mount (i.e. a page reload) must always start at false so the
  // SplashScreen reappears every time, per spec.
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    setSelectedStaffState(loadSession());
    setClockStatuses(loadClockStatusesCache());
    setMyZoneState(loadZone());
    setPosteState(loadPoste());
  }, []);

  const selectedStaffName = selectedStaff?.name || selectedStaff?.prenom || selectedStaff?.nom || "";
  const status = clockStatuses[selectedStaffName] || "absent";
  const isClockedIn = status === "present" || status === "pause";

  // Horodatage local approximatif du dernier passage à "present" — le
  // backend n'expose qu'un statut, pas un instant de pointage exploitable
  // côté client, donc le temps affiché repart de zéro à chaque rechargement
  // de page tant que le Sprint 3 n'ajoute pas cette donnée côté API.
  const clockInTimeRef = useRef(null);
  const [hoursWorked, setHoursWorked] = useState(0);

  useEffect(() => {
    if (status === "present" && !clockInTimeRef.current) {
      clockInTimeRef.current = Date.now();
    }
    if (status !== "present") {
      clockInTimeRef.current = null;
      setHoursWorked(0);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "present") return;
    const interval = setInterval(() => {
      if (!clockInTimeRef.current) return;
      setHoursWorked((Date.now() - clockInTimeRef.current) / 3_600_000);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const refreshClockStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${CLOCK_STATUS_URL}?t=${Date.now()}`);
      if (!res.ok) return;
      const { __times, ...statuses } = await res.json();
      setClockStatuses(statuses);
      setClockStatusTimes(__times || {});
    } catch (error) {
      console.error("[StaffContext] refreshClockStatuses failed", error);
    }
  }, []);

  useEffect(() => {
    refreshClockStatuses();
  }, [refreshClockStatuses]);

  useEffect(() => {
    const unsubscribe = subscribe(refreshClockStatuses);
    return unsubscribe;
  }, [subscribe, refreshClockStatuses]);

  const setStaff = useCallback((staffMember) => {
    setSelectedStaffState(staffMember);
    if (typeof window !== "undefined") {
      localStorage.setItem(SESSION_KEY, JSON.stringify(staffMember));
    }
  }, []);

  // Pas d'affectation staff -> zone dans MOKA_Staff pour l'instant : le staff
  // choisit son poste à l'arrivée (PRD "Mon Poste"), persisté pour la session.
  const setMyZone = useCallback((zone) => {
    setMyZoneState(zone);
    if (typeof window !== "undefined") {
      localStorage.setItem(ZONE_KEY, JSON.stringify(zone));
    }
  }, []);

  // Sprint 11 — poste-first entry flow. Distinct from myZone (Sprint 4,
  // zone physique picker still used standalone elsewhere): poste is one of
  // the 4 fixed stations (Bar/Cuisine/Salle/Plonge) driving both staff
  // filtering and which Mon Poste interface renders.
  const setPoste = useCallback((posteKey) => {
    setPosteState(posteKey);
    if (typeof window === "undefined") return;
    if (posteKey) localStorage.setItem(POSTE_KEY, JSON.stringify(posteKey));
    else localStorage.removeItem(POSTE_KEY);
  }, []);

  // staffNameOverride lets clockActionFor fire the webhook for a staff
  // member who isn't (or isn't yet) the active session, instead of racing
  // the async setStaff/selectedStaffName state update (React state isn't
  // readable synchronously right after the setState call that would
  // otherwise populate it).
  const sendClockAction = useCallback(async (action, staffNameOverride) => {
    const name = staffNameOverride || selectedStaffName;
    if (!name) return;
    setClockSending(true);
    try {
      const response = await fetch(CLOCK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: name,
          staffName: name,
          action,
          timestamp: new Date().toISOString(),
          source: "MOKA OS",
        }),
      });
      if (!response.ok) throw new Error(`Erreur webhook ${response.status}`);
      const data = await response.json().catch(() => ({}));

      setClockStatuses((prev) => {
        const next = { ...prev, [name]: STATUS_AFTER_ACTION[action] || prev[name] };
        saveClockStatusesCache(next);
        return next;
      });
      setClockStatusTimes((prev) => ({ ...prev, [name]: new Date().toISOString() }));

      // Remonté à l'appelant (QuickPointageButton -> SplashScreen) pour
      // rediriger vers /checklist sans redemander à /api/clock ni dupliquer
      // triggerOuvertureIfNeeded côté client — voir app/api/_checklist.js.
      return data;
    } catch (error) {
      console.error("[StaffContext] clock action failed", error);
      throw error;
    } finally {
      setClockSending(false);
    }
  }, [selectedStaffName]);

  const clockIn = useCallback(() => sendClockAction("Arrivée"), [sendClockAction]);
  const clockOut = useCallback(() => sendClockAction("Départ"), [sendClockAction]);
  const startBreak = useCallback(() => sendClockAction("Départ pause"), [sendClockAction]);
  const endBreak = useCallback(() => sendClockAction("Retour pause"), [sendClockAction]);


  // Pointage rapide pour N'IMPORTE QUEL staff, sans toucher à selectedStaff —
  // permet à un collègue de pointer (splash, Mon Poste) sans changer la
  // session active de l'appareil. `action` est explicite (pas déduit ici) :
  // un staff "present" a le choix entre Début pause / Fin de service, donc la
  // décision revient à l'UI (voir QuickPointageButton), pas à ce helper.
  const clockActionFor = useCallback(async (member, action) => {
    const staffName = member?.name || member?.prenom || member?.nom || "";
    if (!staffName || !action) return null;
    return sendClockAction(action, staffName);
  }, [sendClockAction]);

  // Sprint 13 — Access (multi_select on Staff) gates which features the
  // *currently selected* staff can reach, independent of the PIN itself.
  const hasAccess = useCallback(
    (feature) => Boolean(selectedStaff?.access?.includes(feature)),
    [selectedStaff]
  );
  const canOrderPad = hasAccess("OrderPad");
  const canCommandes = hasAccess("Commandes");
  const canLivraisons = hasAccess("Livraisons");

  // Sprint 18 — le PIN admin (code à 4 chiffres partagé) est supprimé : la
  // seule identification qui compte désormais est le choix d'une identité
  // admin nommée (Guillaume/Valérie/Thibaut…), filtrée sur Access contenant
  // "Admin" — même garde qu'avant, juste sans code à saisir devant. Reason
  // "no_access" gardée (pas "wrong_pin", qui n'a plus de sens) pour les
  // appelants qui affichent encore un message d'erreur.
  const unlockAdminAs = useCallback((member) => {
    if (!member?.access?.includes("Admin")) return { ok: false, reason: "no_access" };
    setStaff(member);
    setIsAdmin(true);
    return { ok: true };
  }, [setStaff]);

  const lockAdmin = useCallback(() => setIsAdmin(false), []);

  return (
    <StaffContext.Provider
      value={{
        selectedStaff,
        selectedStaffName,
        isAdmin,
        status,
        isClockedIn,
        clockStatuses,
        clockStatusTimes,
        clockSending,
        hoursWorked,
        myTasks,
        myZone,
        poste,
        hasAccess,
        canOrderPad,
        canCommandes,
        canLivraisons,
        splashDone,
        setSplashDone,
        setStaff,
        setMyZone,
        setPoste,
        setIsAdmin,
        unlockAdminAs,
        lockAdmin,
        clockIn,
        clockOut,
        startBreak,
        endBreak,
        clockActionFor,
      }}
    >
      {children}
    </StaffContext.Provider>
  );
}

export function useStaffContext() {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaffContext must be used within a StaffProvider");
  return ctx;
}
