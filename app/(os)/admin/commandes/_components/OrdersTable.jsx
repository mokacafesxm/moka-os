import { STATUS_COLOR, formatDateHeure, formatEuros, paymentLabel } from "../_lib/format";

export default function OrdersTable({ orders, loading, onOpen }) {
  if (loading) {
    return <div className="text-sm text-[#9a7060] text-center py-10">…</div>;
  }
  if (!orders.length) {
    return <div className="text-sm text-[#9a7060] text-center py-10">Aucune commande pour ces filtres.</div>;
  }

  return (
    <div className="space-y-2">
      {orders.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onOpen(o.id)}
          className="w-full rounded-2xl border border-[#e5d5c5] bg-white p-3.5 text-left cursor-pointer active:scale-[0.99] transition-transform"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-black text-sm text-[#2c1a10] truncate">
                {o.code} · {o.client || "—"}
              </div>
              <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
                {formatDateHeure(o.createdAt)} · {paymentLabel(o.stripePaymentIntent)}
                {o.reward ? ` · 🎁 ${o.reward}` : ""}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="font-black text-sm text-[#2c1a10]">{formatEuros(o.total)}</span>
              <span className={`text-[9px] font-black px-2 py-1 rounded-full ${STATUS_COLOR[o.prepStatus] || ""}`}>
                {o.prepStatus || "—"}
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
