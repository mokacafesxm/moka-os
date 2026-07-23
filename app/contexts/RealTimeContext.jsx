"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

const POLL_INTERVAL = 8000;

const RealTimeContext = createContext(null);

export function RealTimeProvider({ children }) {
  const [lastSync, setLastSync] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tick, setTick] = useState(0);
  const subscribers = useRef(new Set());

  useEffect(() => {
    const interval = setInterval(async () => {
      setIsSyncing(true);
      setTick((t) => t + 1);

      const callbacks = Array.from(subscribers.current);
      await Promise.all(
        callbacks.map((fn) =>
          Promise.resolve()
            .then(() => fn())
            .catch((error) => console.error("[RealTimeContext] poll error", error))
        )
      );

      setLastSync(new Date());
      setIsSyncing(false);
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const subscribe = (fn) => {
    subscribers.current.add(fn);
    return () => subscribers.current.delete(fn);
  };

  return (
    <RealTimeContext.Provider
      value={{ lastSync, isSyncing, pollInterval: POLL_INTERVAL, tick, subscribe }}
    >
      {children}
    </RealTimeContext.Provider>
  );
}

export function useRealTime() {
  const ctx = useContext(RealTimeContext);
  if (!ctx) throw new Error("useRealTime must be used within a RealTimeProvider");
  return ctx;
}
