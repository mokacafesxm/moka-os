"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

function groupBy(list, key) {
  const groups = {};
  for (const item of list) {
    const k = item[key] || "Sans catégorie";
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

// UX audit (28 jul 2026) — Stock était le seul écran dont tout le rôle est
// de montrer un statut, sans jamais colorer ce statut. Le champ existe déjà
// (i.statut) ; on l'utilise enfin pour trier et colorer au lieu de le
// laisser en texte gris uniforme.
function isCritiqueStatut(s) {
  return String(s || "").toLowerCase().includes("critique");
}
function isAlerteStatut(s) {
  return String(s || "").toLowerCase().includes("stock bas") || String(s || "").toLowerCase().includes("alerte");
}
function statutRank(s) {
  if (isCritiqueStatut(s)) return 0;
  if (isAlerteStatut(s)) return 1;
  return 2;
}
function sortByUrgency(items) {
  return [...items].sort((a, b) => statutRank(a.statut) - statutRank(b.statut));
}

function StatusBadge({ statut }) {
  const critique = isCritiqueStatut(statut);
  const alerte = isAlerteStatut(statut);
  const style = critique
    ? "bg-red-50 text-red-700"
    : alerte
    ? "bg-orange-50 text-orange-700"
    : "bg-[#f0e8dc] text-[#9a7060]";
  return (
    <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 whitespace-nowrap ${style}`}>
      {statut}
    </span>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-11 px-4 rounded-2xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] mb-3"
    />
  );
}

function StockLiveTab({ stockLive }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => stockLive.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())),
    [stockLive, search]
  );
  const grouped = useMemo(() => {
    const g = groupBy(filtered, "zone");
    Object.keys(g).forEach((k) => { g[k] = sortByUrgency(g[k]); });
    return g;
  }, [filtered]);

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un produit stock…" />
      {Object.entries(grouped).map(([zone, items]) => (
        <div key={zone} className="mb-4">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">{zone || "Sans zone"} ({items.length})</div>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
                <div>
                  <div className="font-black text-sm text-[#2c1a10]">{i.name}</div>
                  <div className="text-[11px] text-[#9a7060]">{i.quantiteStock} {i.uniteStock}</div>
                </div>
                <StatusBadge statut={i.statut} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="text-center text-sm text-[#9a7060] py-10">Aucun résultat</div>}
    </div>
  );
}

function CatalogueTab({ products }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () => products.filter((p) => (p.name || "").toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );
  const grouped = useMemo(() => groupBy(filtered, "category"), [filtered]);

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher dans le catalogue…" />
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-4">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">{cat} ({items.length})</div>
          <div className="space-y-2">
            {items.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
                <div>
                  <div className="font-black text-sm text-[#2c1a10]">{p.name}</div>
                  <div className="text-[11px] text-[#9a7060]">{p.supplier || "Sans fournisseur"}</div>
                </div>
                <span className="text-[10px] font-bold text-[#9a7060] shrink-0">{p.uniteCommande || p.unit}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="text-center text-sm text-[#9a7060] py-10">Aucun résultat</div>}
    </div>
  );
}

function InventaireTab({ stockLive }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");

  const filtered = useMemo(() => stockLive.filter((i) => {
    if (!i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === "Critiques") return isCritiqueStatut(i.statut);
    if (statusFilter === "Stock bas") return isAlerteStatut(i.statut);
    return true;
  }), [stockLive, search, statusFilter]);

  const grouped = useMemo(() => {
    const g = groupBy(filtered, "category");
    Object.keys(g).forEach((k) => { g[k] = sortByUrgency(g[k]); });
    return g;
  }, [filtered]);
  const critCount = stockLive.filter((i) => isCritiqueStatut(i.statut)).length;
  const alertCount = stockLive.filter((i) => isAlerteStatut(i.statut)).length;

  return (
    <div>
      {/* Ces deux flux IA restent dans l'ancienne app pour l'instant — pas
          réimplémentés ici, juste liés (voir résumé de fin de sprint). */}
      <div className="flex gap-3 mb-3">
        <a href="/" className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-white border border-[#e5d5c5] cursor-pointer">
          <span className="text-xl">📸</span>
          <span className="text-[10px] font-black text-[#2c1a10]">Scanner facture</span>
        </a>
        <a href="/" className="flex-1 flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-white border border-[#e5d5c5] cursor-pointer">
          <span className="text-xl">🧾</span>
          <span className="text-[10px] font-black text-[#2c1a10]">Scanner Z caisse</span>
        </a>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher une prépa…" />

      <div className="flex gap-2 overflow-x-auto pb-3">
        {[
          ["Tous", "Tout", null],
          ["Critiques", "🔴 Critiques", critCount],
          ["Stock bas", "🟠 Stock bas", alertCount],
        ].map(([val, label, count]) => (
          <button
            key={val}
            type="button"
            onClick={() => setStatusFilter(val)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
              statusFilter === val ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
            }`}
          >
            {label}
            {count > 0 && <span className="bg-white/20 px-1 rounded-md text-[9px] font-black">{count}</span>}
          </button>
        ))}
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-4">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">{cat} ({items.length})</div>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
                <div>
                  <div className="font-black text-sm text-[#2c1a10]">{i.name}</div>
                  <div className="text-[11px] text-[#9a7060]">{i.quantiteStock} {i.uniteStock}</div>
                </div>
                <StatusBadge statut={i.statut} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="text-center text-sm text-[#9a7060] py-10">Aucun résultat</div>}
    </div>
  );
}

export default function StockPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const { stockLive, products } = useAppContext();

  const [tab, setTab] = useState("live");

  useEffect(() => {
    if (!isAdmin) router.replace("/manager");
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  const tabs = [
    { key: "live", label: "📦 Stock Live" },
    { key: "catalogue", label: "📋 Catalogue" },
    { key: "inventaire", label: "🗂 Inventaire" },
  ];

  return (
    <div className="min-h-dvh px-4 py-4" style={{ background: "#f7efe4" }}>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Admin</div>
      <h1 className="text-xl font-black text-[#2c1a10] mb-4">Stock</h1>

      <div className="flex gap-1.5 mb-4 bg-white/60 rounded-2xl p-1.5 border border-[#e5d5c5]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 h-10 rounded-xl text-xs font-black cursor-pointer transition-colors ${
              tab === t.key ? "bg-[#2c1a10] text-white" : "text-[#6b4a3d]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "live" && <StockLiveTab stockLive={stockLive} />}
      {tab === "catalogue" && <CatalogueTab products={products} />}
      {tab === "inventaire" && <InventaireTab stockLive={stockLive} />}
    </div>
  );
}
