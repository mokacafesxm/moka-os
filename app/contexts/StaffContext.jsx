"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRealTime } from "./RealTimeContext";

const CLOCK_URL = "/api/clock";
const CLOCK_STATUS_URL = "/api/clock-status";
const SESSION_KEY = "mokaStaffSession";
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

const STATUS_AFTER_ACTION = {
  "Arrivée": "present",
  "Départ pause": "pause",
  "Retour pause": "present",
  "Départ": "done",
};

const StaffContext = createContext(null);

export function StaffProvider({ children }) {
  const { subscribe } = useRealTime();

  const [selectedStaff, setSelectedStaffState] = useState(() => loadSession());
  const [isAdmin, setIsAdmin] = useState(false);
  const [clockStatuses, setClockStatuses] = useState(() => loadClockStatusesCache());
  const [clockSending, setClockSending] = useState(false);
  const [myTasks, setMyTasks] = useState([]); // branché en Sprint 3 (MOKA_Taches)
  const [myZone, setMyZone] = useState(null); // branché en Sprint 3 (MOKA_Zones_Physiques)

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

  const sendClockAction = useCallback(async (action) => {
    if (!selectedStaffName) return;
    setClockSending(true);
    try {
      const response = await fetch(CLOCK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: selectedStaffName,
          staffName: selectedStaffName,
          action,
          timestamp: new Date().toISOString(),
          source: "MOKA OS",
        }),
      });
      if (!response.ok) throw new Error(`Erreur webhook ${response.status}`);

      setClockStatuses((prev) => {
        const next = { ...prev, [selectedStaffName]: STATUS_AFTER_ACTION[action] || prev[selectedStaffName] };
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

  return (
    <StaffContext.Provider
      value={{
        selectedStaff,
        selectedStaffName,
        isAdmin,
        status,
        isClockedIn,
        clockSending,
        hoursWorked,
        myTasks,
        myZone,
        setStaff,
        setIsAdmin,
        clockIn,
        clockOut,
        startBreak,
        endBreak,
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
