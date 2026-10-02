"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../_lib/AdminAuthProvider";
import OrdersFilterBar from "./_components/OrdersFilterBar";
import OrdersStatsHeader from "./_components/OrdersStatsHeader";
import OrdersTable from "./_components/OrdersTable";
import OrderDetailDrawer from "./_components/OrderDetailDrawer";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function defaultFilters() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to), status: "", q: "" };
}

export default function AdminCommandesPage() {
  const { adminFetch } = useAdminAuth();
  const [filters, setFilters] = useState(defaultFilters);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openOrderId, setOpenOrderId] = useState(null);

  function refresh() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
    if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59`).toISOString());
    if (filters.status) params.set("status", filters.status);
    if (filters.q) params.set("q", filters.q);

    adminFetch(`/api/admin/orders?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders || []);
        setStats(data.stats || null);
      })
      .catch(() => {
        setOrders([]);
        setStats(null);
      })
      .finally(() => setLoading(false));
  }

  // Date/statut appliqués immédiatement ; la recherche texte est débattue
  // (300ms) pour ne pas relancer une requête Notion à chaque frappe.
  useEffect(() => {
    const t = setTimeout(refresh, filters.q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.from, filters.to, filters.status, filters.q]);

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4 md:max-w-3xl md:mx-auto" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Admin</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">🧾 Historique des commandes</h1>
      </div>

      <OrdersStatsHeader stats={stats} />

      <OrdersFilterBar filters={filters} onChange={setFilters} />

      <OrdersTable orders={orders} loading={loading} onOpen={setOpenOrderId} />

      {openOrderId && (
        <OrderDetailDrawer orderId={openOrderId} onClose={() => setOpenOrderId(null)} onStatusChanged={refresh} />
      )}
    </div>
  );
}
