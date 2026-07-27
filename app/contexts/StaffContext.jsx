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
      const statuses = await res.json();
      setClockStatuses(statuses);
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

  // staffNameOverride lets clockInAs fire the webhook with the just-picked
  // member's name immediately, instead of racing the async setStaff/
  // selectedStaffName state update (React state isn't readable synchronously
  // right after the setState call that would otherwise populate it).
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

      setClockStatuses((prev) => {
        const next = { ...prev, [name]: STATUS_AFTER_ACTION[action] || prev[name] };
        saveClockStatusesCache(next);
        return next;
      });
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

  // Sprint 11 — atomic "pick this staff card and clock them in" for the
  // poste-first flow: sets the session AND fires Arrivée in one call, using
  // the member directly rather than the (not-yet-updated) selectedStaffName.
  const clockInAs = useCallback(async (member) => {
    const staffName = member?.name || member?.prenom || member?.nom || "";
    if (!staffName) return;
    setSelectedStaffState(member);
    if (typeof window !== "undefined") {
      localStorage.setItem(SESSION_KEY, JSON.stringify(member));
    }
    await sendClockAction("Arrivée", staffName);
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

  // Même clés localStorage que le PIN admin de page.js (mokaAdminEnabled /
  // mokaPinCode) — une seule source de vérité pour le code, même si le
  // booléen "déverrouillé" reste par arbre de composants (page.js et cette
  // app (os) ne partagent pas de state React) et se réinitialise au reload,
  // comme le fait déjà page.js.
  //
  // Sprint 13 — the PIN alone is no longer sufficient: isAdmin only ever
  // gets set if the currently selected staff also has "Admin" in Access.
  // Returns a reason string instead of a plain boolean so callers can show
  // the right message (wrong PIN vs. no staff picked vs. PIN correct but
  // this identity isn't authorized) — `ok` alone stays boolean-truthy-safe
  // for any caller that only checks success/failure.
  const checkPin = useCallback((pin) => {
    if (typeof window === "undefined") return false;
    const adminEnabled = localStorage.getItem("mokaAdminEnabled") !== "false";
    if (!adminEnabled) return false;
    const savedPin = localStorage.getItem("mokaPinCode") || "3578";
    return pin === savedPin;
  }, []);

  const unlockAdmin = useCallback((pin) => {
    if (!checkPin(pin)) return { ok: false, reason: "wrong_pin" };
    if (!selectedStaff) return { ok: false, reason: "no_staff" };
    if (!selectedStaff.access?.includes("Admin")) return { ok: false, reason: "no_access" };
    setIsAdmin(true);
    return { ok: true };
  }, [checkPin, selectedStaff]);

  // Sprint 14 — Guillaume/Thibaut n'ont plus de poste opérationnel (voir
  // SplashScreen), donc jamais de selectedStaff au moment où ils tapent
  // "Mode Admin →" depuis le splash. Cette variante prend l'identité admin
  // en paramètre (choisie dans un petit picker) au lieu de dépendre d'un
  // selectedStaff déjà posé par le flux Mon Poste.
  const unlockAdminAs = useCallback((pin, member) => {
    if (!checkPin(pin)) return { ok: false, reason: "wrong_pin" };
    if (!member?.access?.includes("Admin")) return { ok: false, reason: "no_access" };
    setStaff(member);
    setIsAdmin(true);
    return { ok: true };
  }, [checkPin, setStaff]);

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
        unlockAdmin,
        unlockAdminAs,
        lockAdmin,
        clockIn,
        clockOut,
        startBreak,
        endBreak,
        clockInAs,
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
