"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "../../_lib/AdminAuthProvider";
import CategoryForm from "./CategoryForm";

export default function CategoriesTab() {
  const { adminFetch } = useAdminAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(undefined);

  function refresh() {
    setLoading(true);
    adminFetch("/api/admin/categories")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
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
          + Nouvelle catégorie
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-[#9a7060] text-center py-10">…</div>
      ) : categories.length === 0 ? (
        <div className="text-sm text-[#9a7060] text-center py-10">Aucune catégorie.</div>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setOpenId(c.id)}
              className="w-full rounded-2xl border border-[#e5d5c5] bg-white p-3 flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="w-12 h-12 rounded-xl bg-[#f0e8dc] overflow-hidden shrink-0 flex items-center justify-center">
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#9a7060] text-[10px]">—</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-sm text-[#2c1a10] truncate">{c.nom}</div>
                <div className="text-[11px] text-[#9a7060] font-semibold">Ordre {c.ordre}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {openId !== undefined && (
        <CategoryForm
          categoryId={openId}
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
