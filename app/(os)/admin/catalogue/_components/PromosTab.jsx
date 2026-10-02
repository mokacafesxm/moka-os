"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../../_lib/AdminAuthProvider";
import PromoForm from "./PromoForm";

export default function PromosTab() {
  const { adminFetch } = useAdminAuth();
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(undefined);

  function refresh() {
    setLoading(true);
    adminFetch("/api/admin/promos")
      .then((r) => r.json())
      .then((data) => setPromos(Array.isArray(data) ? data : []))
      .catch(() => setPromos([]))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="h-10 px-4 rounded-xl bg-[#2c1a10] text-white text-xs font-black cursor-pointer"
        >
          + Nouvelle promo
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-[#9a7060] text-center py-10">…</div>
      ) : promos.length === 0 ? (
        <div className="text-sm text-[#9a7060] text-center py-10">Aucune promo.</div>
      ) : (
        <div className="space-y-2">
          {promos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenId(p.id)}
              className="w-full rounded-2xl border border-[#e5d5c5] bg-white p-3 flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="w-12 h-12 rounded-xl bg-[#f0e8dc] overflow-hidden shrink-0 flex items-center justify-center">
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#9a7060] text-[10px]">—</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-sm text-[#2c1a10] truncate">{p.nom}</div>
                <div className="text-[11px] text-[#9a7060] font-semibold truncate">{p.lien || "—"} · Ordre {p.ordre}</div>
              </div>
              <span
                className={`text-[9px] font-black px-2 py-1 rounded-full shrink-0 ${
                  p.actif ? "bg-green-50 text-green-700" : "bg-[#f0e8dc] text-[#9a7060]"
                }`}
              >
                {p.actif ? "Actif" : "Inactif"}
              </span>
            </button>
          ))}
        </div>
      )}

      {openId !== undefined && (
        <PromoForm
          promoId={openId}
          onClose={() => setOpenId(undefined)}
          onSaved={() => {
            setOpenId(undefined);
            refresh();
          }}
        />
      )}
    </div>
  );
}
