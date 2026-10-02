"use client";

import { useState } from "react";
import ProductsTab from "./_components/ProductsTab";
import CategoriesTab from "./_components/CategoriesTab";
import PromosTab from "./_components/PromosTab";

const TABS = [
  { key: "products", label: "Produits" },
  { key: "categories", label: "Catégories" },
  { key: "promos", label: "Promos" },
];

export default function AdminCataloguePage() {
  const [tab, setTab] = useState("products");

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4 md:max-w-3xl md:mx-auto" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Admin</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">🛍️ Catalogue</h1>
      </div>

      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`h-9 px-4 rounded-full text-xs font-black cursor-pointer ${
              tab === t.key ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#9a7060]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "products" && <ProductsTab />}
      {tab === "categories" && <CategoriesTab />}
      {tab === "promos" && <PromosTab />}
    </div>
  );
}
