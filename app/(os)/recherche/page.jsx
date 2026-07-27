"use client";

import { useMemo, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";

function norm(v) {
  return String(v || "").toLowerCase();
}

function ResultGroup({ title, items, renderItem }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-3">
        {title} ({items.length})
      </div>
      <div className="space-y-2">{items.map(renderItem)}</div>
    </div>
  );
}

export default function RecherchePage() {
  const { products, preps, taches } = useAppContext();
  const [query, setQuery] = useState("");

  const q = norm(query).trim();

  const matchedProducts = useMemo(
    () => (q ? products.filter((p) => norm(p.name || p.ingredient).includes(q)) : []),
    [products, q]
  );
  const matchedPreps = useMemo(
    () => (q ? preps.filter((p) => norm(p.name).includes(q)) : []),
    [preps, q]
  );
  const matchedTaches = useMemo(
    () => (q ? taches.filter((t) => norm(t.nom).includes(q)) : []),
    [taches, q]
  );

  const totalResults = matchedProducts.length + matchedPreps.length + matchedTaches.length;

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Recherche</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">Trouver quelque chose</h1>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        placeholder="Chercher un produit, une recette, une tâche..."
        className="w-full h-12 px-4 rounded-2xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
      />

      {!q && (
        <div className="text-center text-sm text-[#9a7060] py-10">Commence à taper pour chercher</div>
      )}

      {q && totalResults === 0 && (
        <div className="text-center text-sm text-[#9a7060] py-10">Aucun résultat pour « {query} »</div>
      )}

      {q && (
        <div className="space-y-3">
          <ResultGroup
            title="Produits"
            items={matchedProducts}
            renderItem={(p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#2c1a10]">{p.name || p.ingredient}</span>
                {p.category && <span className="text-[10px] text-[#9a7060] font-semibold">{p.category}</span>}
              </div>
            )}
          />
          <ResultGroup
            title="Prépas"
            items={matchedPreps}
            renderItem={(p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#2c1a10]">{p.name}</span>
                {p.status && <span className="text-[10px] text-[#9a7060] font-semibold">{p.status}</span>}
              </div>
            )}
          />
          <ResultGroup
            title="Tâches"
            items={matchedTaches}
            renderItem={(t) => (
              <div key={t.id} className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#2c1a10]">{t.nom}</span>
                {t.moment && <span className="text-[10px] text-[#9a7060] font-semibold">{t.moment}</span>}
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
