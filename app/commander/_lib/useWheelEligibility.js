"use client";

import { useEffect, useState } from "react";
import { getScreenResolution } from "./screenResolution";

async function fetchEligibility() {
  const params = new URLSearchParams({ screenResolution: getScreenResolution() });
  const res = await fetch(`/api/wheel/eligibility?${params}`);
  return res.json();
}

export function useWheelEligibility() {
  const [state, setState] = useState({
    loading: true,
    canSpin: false,
    nextResetAt: null,
    activeReward: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetchEligibility()
      .then((data) => {
        if (!cancelled && data) setState({ loading: false, ...data });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function refresh() {
    fetchEligibility()
      .then((data) => {
        if (data) setState({ loading: false, ...data });
      })
      .catch(() => {});
  }

  return { ...state, refresh };
}
