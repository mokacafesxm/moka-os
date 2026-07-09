"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Receipt } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { formatPrice } from "../_lib/variants";

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_STYLE = {
  "Récupérée": { color: MOKA.green, backgroundColor: `${MOKA.green}1a` },
  "Prête": { color: MOKA.coral, backgroundColor: `${MOKA.coral}1a` },
};
const DEFAULT_STATUS_STYLE = { color: MOKA.brownLight, backgroundColor: MOKA.placeholderTan };

function OrderCard({ order }) {
  return (
    <div className="bg-white rounded-2xl px-4 py-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-sm" style={{ color: MOKA.brown }}>
            {order.code}
          </p>
          <p className="text-xs" style={{ color: MOKA.brownLight }}>
            {formatDate(order.createdAt)}
          </p>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
          style={STATUS_STYLE[order.prepStatus] || DEFAULT_STATUS_STYLE}
        >
          {order.prepStatus}
        </span>
      </div>

      {order.articles && (
        <p className="text-sm mt-2 whitespace-pre-line" style={{ color: MOKA.brown }}>
          {order.articles}
        </p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: `${MOKA.brownLight}33` }}>
        <span className="text-xs" style={{ color: MOKA.brownLight }}>
          Total payé
        </span>
        <span className="font-black text-sm" style={{ color: MOKA.brown }}>
          {formatPrice(order.total)}
        </span>
      </div>
    </div>
  );
}

// "Mes commandes" sub-screen — every past order for the connected client
// (matched by phone), newest first. Same focused-sub-screen pattern as
// AccountPromos / AccountInfoForm (own back button, replaces the account menu).
export default function AccountOrders({ onBack }) {
  const [orders, setOrders] = useState(null); // null = loading

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/orders")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setOrders(data.orders || []);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="px-4 pt-4 pb-12">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold mb-4 cursor-pointer -ml-1" style={{ color: MOKA.brown }}>
        <ChevronLeft className="w-4 h-4" />
        Retour
      </button>
      <h2 className="text-lg font-black mb-4" style={{ color: MOKA.brown }}>
        Mes commandes
      </h2>

      {orders === null ? (
        <p className="text-sm" style={{ color: MOKA.brownLight }}>
          Chargement…
        </p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center">
          <Receipt className="w-8 h-8 mx-auto mb-2" style={{ color: MOKA.brownLight }} />
          <p className="font-semibold" style={{ color: MOKA.brown }}>
            Aucune commande pour l&apos;instant
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
