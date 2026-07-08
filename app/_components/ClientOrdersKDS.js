"use client";

import { useEffect, useState } from "react";

const BOARD_URL = "/api/orders/board";
const POLL_MS = 5000;

// Columns match the Notion "Statut préparation" options. Each non-terminal
// column's card shows the button that advances it one step.
const COLUMNS = [
  { status: "Nouvelle", title: "Nouvelles", accent: "#c0562f", action: "Commencer" },
  { status: "En préparation", title: "En préparation", accent: "#b8860b", action: "Prête" },
  { status: "Prête", title: "Prêtes", accent: "#5a7828", action: "Récupérée" },
  { status: "Récupérée", title: "Récupérées", accent: "#6b4a3d", action: null },
];

function OrderCard({ order, accent, action, onAdvance, busy }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-black text-[#2c1a10] text-sm">{order.code}</span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: accent }}>
          {order.creneau}
        </span>
      </div>
      <div className="text-xs font-semibold text-[#2c1a10] mt-0.5">{order.client}</div>
      {order.articles && <div className="text-[11px] text-[#6b4a3d] mt-1 whitespace-pre-line leading-tight">{order.articles}</div>}
      <div className="text-[11px] font-bold text-[#2c1a10] mt-1">{Number(order.total || 0).toFixed(2)}€</div>
      {order.acknowledgedBy && <div className="text-[10px] text-[#9a7060] mt-0.5">Vu par {order.acknowledgedBy}</div>}
      {action && (
        <button
          onClick={() => onAdvance(order)}
          disabled={busy}
          className={`w-full mt-2 py-2 rounded-full text-xs font-black text-white ${busy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
          style={{ backgroundColor: accent }}
        >
          {action} →
        </button>
      )}
    </div>
  );
}

export default function ClientOrdersKDS() {
  const [orders, setOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    async function tick() {
      try {
        const res = await fetch(`${BOARD_URL}?t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setOrders(data.orders || []);
          setLoaded(true);
        }
      } catch {
        /* transient — next tick retries */
      }
    }
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  async function advance(order) {
    setBusyId(order.id);
    try {
      const res = await fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, prepStatus: data.status } : o)));
      }
    } finally {
      setBusyId(null);
    }
  }

  const byStatus = (status) => orders.filter((o) => o.prepStatus === status);

  return (
    <div className="p-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const list = byStatus(col.status);
          return (
            <div key={col.status} className="rounded-3xl bg-[#efe4d3] p-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="font-black text-[#2c1a10] text-sm">{col.title}</h3>
                <span className="text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: col.accent }}>
                  {list.length}
                </span>
              </div>
              <div className="space-y-2 min-h-[60px]">
                {list.map((o) => (
                  <OrderCard key={o.id} order={o} accent={col.accent} action={col.action} onAdvance={advance} busy={busyId === o.id} />
                ))}
                {loaded && list.length === 0 && <p className="text-[11px] text-[#9a7060] text-center py-3">—</p>}
              </div>
            </div>
          );
        })}
      </div>
      {loaded && orders.length === 0 && (
        <p className="text-center text-sm text-[#6b4a3d] mt-8">Aucune commande client aujourd&apos;hui.</p>
      )}
    </div>
  );
}
