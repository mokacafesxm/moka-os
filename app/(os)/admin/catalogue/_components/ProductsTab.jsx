"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../../_lib/AdminAuthProvider";
import ProductForm from "./ProductForm";

function formatEuros(n) {
  return `${(n || 0).toFixed(2).replace(".", ",")}€`;
}

export default function ProductsTab() {
  const { adminFetch } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(undefined); // undefined = fermé, null = création, id = édition

  function refresh() {
    setLoading(true);
    Promise.all([
      adminFetch("/api/admin/products").then((r) => r.json()),
      adminFetch("/api/admin/categories").then((r) => r.json()),
    ])
      .then(([p, c]) => {
        setProducts(Array.isArray(p) ? p : []);
        setCategories(Array.isArray(c) ? c : []);
      })
      .catch(() => {
        setProducts([]);
        setCategories([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  const categoryNames = useMemo(() => categories.map((c) => c.nom), [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory && p.categorie !== activeCategory) return false;
      if (q && !p.nom.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, activeCategory, query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un produit…"
          className="flex-1 h-10 px-3 rounded-xl border border-[#e5d5c5] text-sm bg-white"
        />
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="h-10 px-4 rounded-xl bg-[#2c1a10] text-white text-xs font-black cursor-pointer shrink-0"
        >
          + Nouveau
        </button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory("")}
          className={`shrink-0 h-8 px-3 rounded-full text-xs font-black cursor-pointer ${
            activeCategory === "" ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#9a7060]"
          }`}
        >
          Toutes
        </button>
        {categoryNames.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActiveCategory(c)}
            className={`shrink-0 h-8 px-3 rounded-full text-xs font-black cursor-pointer whitespace-nowrap ${
              activeCategory === c ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#9a7060]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-[#9a7060] text-center py-10">…</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-[#9a7060] text-center py-10">Aucun produit.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenId(p.id)}
              className="w-full rounded-2xl border border-[#e5d5c5] bg-white p-3 flex items-center gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
            >
              <div className="w-12 h-12 rounded-xl bg-[#f0e8dc] overflow-hidden shrink-0 flex items-center justify-center">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#9a7060] text-[10px]">—</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-sm text-[#2c1a10] truncate">{p.nom}</div>
                <div className="text-[11px] text-[#9a7060] font-semibold">{p.categorie || "—"}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="font-black text-sm text-[#2c1a10]">{formatEuros(p.prix)}</span>
                {!p.disponible && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#f0e8dc] text-[#9a7060]">
                    Indisponible
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {openId !== undefined && (
        <ProductForm
          productId={openId}
          categoryNames={categoryNames}
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
