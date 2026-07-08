"use client";

import { useEffect, useRef, useState } from "react";

const PENDING_URL = "/api/orders/pending";
const POLL_MS = 4000;
const BEEP_EVERY_MS = 2500;

function getDeviceName() {
  if (typeof window === "undefined") return "Appareil";
  let name = localStorage.getItem("mokaDeviceName");
  if (!name) {
    name = `Appareil ${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem("mokaDeviceName", name);
  }
  return name;
}

// Global, always-mounted on every MÖKA OS device (staff or admin) — regardless
// of which OrderPad section is open — so a brand-new customer order pops on
// every device at once with a looping chime until someone acknowledges it.
export default function NewOrderAlert({ enabled }) {
  const [orders, setOrders] = useState([]);
  const [acking, setAcking] = useState(false);
  const audioCtxRef = useRef(null);
  const beepTimerRef = useRef(null);

  // Poll the lightweight pending endpoint. An inline async call (not a named
  // function reference) keeps this clear of the set-state-in-effect rule.
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;

    async function tick() {
      try {
        const res = await fetch(`${PENDING_URL}?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setOrders(data.orders || []);
      } catch {
        /* transient network error — next tick retries */
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [enabled]);

  const alerting = enabled && orders.length > 0;

  // Looping chime while there's an unacknowledged order. Web Audio (no asset);
  // the context is created lazily and resumed on the button gesture in case
  // the browser suspended it under the autoplay policy.
  useEffect(() => {
    if (!alerting) return undefined;

    function beep() {
      let ctx = audioCtxRef.current;
      if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return;
        ctx = new Ctor();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    }

    beep();
    beepTimerRef.current = setInterval(beep, BEEP_EVERY_MS);
    return () => clearInterval(beepTimerRef.current);
  }, [alerting]);

  async function handleAck() {
    setAcking(true);
    // Resume audio on this user gesture so subsequent beeps (if any) aren't
    // blocked — and it's the moment the browser reliably allows it.
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    const deviceName = getDeviceName();
    try {
      await Promise.allSettled(
        orders.map((o) =>
          fetch("/api/orders/ack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: o.id, deviceName }),
          })
        )
      );
      setOrders([]); // optimistic — other devices clear on their next poll
    } finally {
      setAcking(false);
    }
  }

  if (!alerting) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl bg-[#f5ede0] p-6 shadow-2xl animate-[popIn_0.3s_ease-out]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">🔔</span>
          <h2 className="text-xl font-black text-[#2c1a10]">
            {orders.length > 1 ? `${orders.length} nouvelles commandes` : "Nouvelle commande"}
          </h2>
        </div>
        <p className="text-sm text-[#6b4a3d] mb-4">Une commande client vient d&apos;arriver.</p>

        <div className="space-y-2 max-h-[45vh] overflow-y-auto mb-5">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="font-black text-[#2c1a10]">{o.code}</span>
                <span className="text-xs font-semibold text-[#6b4a3d]">{o.creneau}</span>
              </div>
              <div className="text-sm text-[#2c1a10] mt-0.5">{o.client}</div>
              {o.articles && <div className="text-xs text-[#6b4a3d] mt-1 whitespace-pre-line">{o.articles}</div>}
            </div>
          ))}
        </div>

        <button
          onClick={handleAck}
          disabled={acking}
          className={`w-full py-4 rounded-full font-black text-white text-lg ${
            acking ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          }`}
          style={{ backgroundColor: "#5a7828" }}
        >
          {acking ? "…" : "J'ai vu la commande"}
        </button>
      </div>
    </div>
  );
}
