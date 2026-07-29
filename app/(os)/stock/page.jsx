"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

// Une prépa (ex: "Sauce maison — Prépa") vit dans stockLive comme n'importe
// quel ingrédient brut mais se réapprovisionne en la refaisant (onglet
// Prépas), jamais en la commandant à un fournisseur — même distinction que
// Mon Poste (voir poste/page.jsx isPrepStock).
function isPrepStockItem(item) {
  const cat = String(item.category || item.categorie || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
  return cat.includes("PREPA");
}

function isPrepDone(prep) {
  const s = String(prep.status || "").toLowerCase();
  return s.includes("fait") || s.includes("termine") || s.includes("terminé");
}

function todaySXM() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date());
}

// Best-effort : le nom de la recette (Sold Product Catalogue) est censé
// correspondre au nom du produit préparé, mais rien ne le garantit — beaucoup
// de prépas n'ont pas encore de recette (voir /recettes). Ne bloque jamais la
// complétion de la prépa si aucune correspondance/recette n'est trouvée.
function derivePrepProductName(prepName) {
  return String(prepName || "").replace(/^Pr[ée]parer\s+/i, "").trim();
}

async function deductRecipeIngredients(prepName, quantiteProduite, stockLive) {
  const productName = derivePrepProductName(prepName);
  if (!productName || !(quantiteProduite > 0)) return;
  const soldProductsRes = await fetch("/api/recipes/sold-products");
  if (!soldProductsRes.ok) return;
  const soldProducts = await soldProductsRes.json().catch(() => null);
  const match = Array.isArray(soldProducts)
    ? soldProducts.find((p) => (p.name || "").trim().toLowerCase() === productName.toLowerCase())
    : null;
  if (!match) return;
  const linesRes = await fetch(`/api/recipes/lines?soldProductId=${match.id}`);
  if (!linesRes.ok) return;
  const lines = await linesRes.json().catch(() => null);
  const activeLines = Array.isArray(lines) ? lines.filter((l) => l.active) : [];
  await Promise.all(
    activeLines.map((line) => {
      const stockRow = stockLive.find((s) => s.ingredientId === line.ingredientId);
      if (!stockRow) return null;
      const delta = (Number(line.quantity) || 0) * quantiteProduite;
      const newQty = Math.max(0, (stockRow.quantiteStock || 0) - delta);
      return fetch("/api/stock/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stockRow.id, poidsTotal: newQty, Unite: stockRow.uniteStock, mode: "replace" }),
      });
    })
  );
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

function FilterPills({ options, value, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-3">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
            value === opt ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

const inputClass = "w-full h-11 px-3.5 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]";

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

const EMPTY_PRODUCT_FORM = {
  ingredient: "", categorie: "", zoneStockage: "", uniteStock: "",
  seuilAlerte: "", seuilCritique: "", quantiteActuelle: "",
};

function ProductFormModal({ mode, initial, referentiels, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_PRODUCT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.ingredient.trim()) { setError("Nom requis"); return; }
    setSaving(true);
    setError(null);
    try {
      if (mode === "create") {
        const res = await fetch("/api/settings/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredient: form.ingredient,
            categorie: form.categorie,
            zoneStockage: form.zoneStockage,
            uniteStock: form.uniteStock,
            seuilAlerte: form.seuilAlerte ? Number(form.seuilAlerte) : undefined,
            seuilCritique: form.seuilCritique ? Number(form.seuilCritique) : undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
        const qty = Number(form.quantiteActuelle) || 0;
        if (qty > 0) {
          await fetch("/api/stock/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: form.ingredient, poidsTotal: qty, Unite: form.uniteStock, mode: "replace" }),
          });
        }
      } else {
        const res = await fetch("/api/settings/products", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: initial.id,
            ingredient: form.ingredient,
            categorie: form.categorie,
            zoneStockage: form.zoneStockage,
            uniteStock: form.uniteStock,
            seuilAlerte: form.seuilAlerte ? Number(form.seuilAlerte) : undefined,
            seuilCritique: form.seuilCritique ? Number(form.seuilCritique) : undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={mode === "create" ? "Ajouter un produit" : `Modifier ${initial?.ingredient || ""}`} onClose={onClose}>
      <input value={form.ingredient} onChange={set("ingredient")} placeholder="Nom du produit" className={inputClass} autoFocus />
      <select value={form.categorie} onChange={set("categorie")} className={inputClass}>
        <option value="">Catégorie…</option>
        {referentiels.categories.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
      </select>
      <select value={form.uniteStock} onChange={set("uniteStock")} className={inputClass}>
        <option value="">Unité…</option>
        {referentiels.unites.map((u) => <option key={u.id} value={u.nom}>{u.nom}</option>)}
      </select>
      <select value={form.zoneStockage} onChange={set("zoneStockage")} className={inputClass}>
        <option value="">Zone de stockage…</option>
        {referentiels.zones.map((z) => <option key={z.id} value={z.nom}>{z.nom}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Seuil alerte</label>
          <input type="number" value={form.seuilAlerte} onChange={set("seuilAlerte")} className={inputClass} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Seuil critique</label>
          <input type="number" value={form.seuilCritique} onChange={set("seuilCritique")} className={inputClass} />
        </div>
      </div>
      {mode === "create" && (
        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Quantité actuelle</label>
          <input type="number" value={form.quantiteActuelle} onChange={set("quantiteActuelle")} className={inputClass} />
        </div>
      )}
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl text-[#9a7060] font-bold text-sm cursor-pointer">
          Annuler
        </button>
        <button type="button" onClick={submit} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50">
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </ModalShell>
  );
}

function AdjustQuantityModal({ item, onClose, onSaved }) {
  const [value, setValue] = useState(String(item.quantiteStock ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/stock/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, poidsTotal: Number(value) || 0, Unite: item.uniteStock, mode: "replace" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Ajuster — ${item.name}`} onClose={onClose}>
      <div>
        <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Quantité réelle ({item.uniteStock || "unité"})</label>
        <input type="number" autoFocus value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
      </div>
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl text-[#9a7060] font-bold text-sm cursor-pointer">
          Annuler
        </button>
        <button type="button" onClick={submit} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50">
          {saving ? "…" : "Confirmer"}
        </button>
      </div>
    </ModalShell>
  );
}

function StockLiveTab({ stockLive, referentiels, onRefresh }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [showAdd, setShowAdd] = useState(false);
  const [adjusting, setAdjusting] = useState(null);

  const bruts = useMemo(() => stockLive.filter((i) => !isPrepStockItem(i)), [stockLive]);
  const categories = useMemo(() => ["Toutes", ...new Set(bruts.map((i) => i.category || i.categorie).filter(Boolean))], [bruts]);

  const filtered = useMemo(
    () => bruts.filter((i) => {
      if (!i.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "Toutes" && (i.category || i.categorie) !== categoryFilter) return false;
      return true;
    }),
    [bruts, search, categoryFilter]
  );

  const grouped = useMemo(() => {
    const g = groupBy(filtered, "category");
    Object.keys(g).forEach((k) => { g[k] = sortByUrgency(g[k]); });
    return g;
  }, [filtered]);

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un produit stock…" />
      <FilterPills options={categories} value={categoryFilter} onChange={setCategoryFilter} />

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex-1 h-10 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer"
        >
          + Ajouter un produit
        </button>
        <Link
          href="/parametres?section=categories"
          className="flex-1 h-10 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer flex items-center justify-center"
        >
          + Ajouter une catégorie
        </Link>
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-4">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">{cat} ({items.length})</div>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
                <div className="min-w-0">
                  <div className="font-black text-sm text-[#2c1a10] truncate">{i.name}</div>
                  <div className="text-[11px] text-[#9a7060]">{i.quantiteStock} {i.uniteStock}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge statut={i.statut} />
                  <button
                    type="button"
                    onClick={() => setAdjusting(i)}
                    className="h-8 px-2.5 rounded-lg bg-[#f0e8dc] text-[#2c1a10] text-[10px] font-black cursor-pointer hover:bg-[#e5d5c5] transition-colors"
                  >
                    Ajuster
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="text-center text-sm text-[#9a7060] py-10">Aucun résultat</div>}

      {showAdd && (
        <ProductFormModal
          mode="create"
          referentiels={referentiels}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
      {adjusting && (
        <AdjustQuantityModal item={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); onRefresh(); }} />
      )}
    </div>
  );
}

const EMPTY_PREP_FORM = { produit: "", quantite: "", unite: "kg", priorite: "Normale", station: "Cuisine" };

function AddPrepModal({ referentiels, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_PREP_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!form.produit.trim()) { setError("Nom requis"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/preps/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quantite: Number(form.quantite) || 1, source: "Stock" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Ajouter une prépa" onClose={onClose}>
      <input
        value={form.produit}
        onChange={(e) => setForm((f) => ({ ...f, produit: e.target.value }))}
        placeholder="Nom du produit à préparer"
        className={inputClass}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          value={form.quantite}
          onChange={(e) => setForm((f) => ({ ...f, quantite: e.target.value }))}
          placeholder="Quantité"
          className={inputClass}
        />
        <select value={form.unite} onChange={(e) => setForm((f) => ({ ...f, unite: e.target.value }))} className={inputClass}>
          {referentiels.unites.length > 0
            ? referentiels.unites.map((u) => <option key={u.id} value={u.nom}>{u.nom}</option>)
            : ["kg", "L", "unité"].map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <select value={form.station} onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))} className={inputClass}>
        {["Cuisine", "Bar"].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={form.priorite} onChange={(e) => setForm((f) => ({ ...f, priorite: e.target.value }))} className={inputClass}>
        {["Normale", "Urgente"].map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl text-[#9a7060] font-bold text-sm cursor-pointer">
          Annuler
        </button>
        <button type="button" onClick={submit} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50">
          {saving ? "…" : "Ajouter"}
        </button>
      </div>
    </ModalShell>
  );
}

function PrepasTab({ preps, stockLive, referentiels, onRefresh }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [completingId, setCompletingId] = useState(null);
  const [qtyDraft, setQtyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const filtered = useMemo(
    () => preps.filter((p) => (p.name || "").toLowerCase().includes(search.toLowerCase())),
    [preps, search]
  );
  const aFaire = useMemo(() => filtered.filter((p) => !isPrepDone(p)), [filtered]);
  const faitesAujourdhui = useMemo(
    () => filtered.filter((p) => isPrepDone(p) && (p.dueDate || "").slice(0, 10) === todaySXM()),
    [filtered]
  );

  const startComplete = (prep) => {
    setCompletingId(prep.id);
    setQtyDraft(String(prep.quantity || ""));
    setError(null);
  };

  const confirmComplete = async (prep) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/preps/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ id: prep.id, status: "Fait" }]),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      const produced = parseFloat(qtyDraft) || 0;
      // Best-effort — voir deductRecipeIngredients : n'échoue jamais la
      // complétion de la prépa si aucune recette ne correspond.
      await deductRecipeIngredients(prep.name, produced, stockLive).catch(() => {});
      setCompletingId(null);
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher une prépa…" />

      <button
        type="button"
        onClick={() => setShowAdd(true)}
        className="w-full h-10 mb-4 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer"
      >
        + Ajouter une prépa
      </button>

      <div className="mb-4">
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">À faire ({aFaire.length})</div>
        {aFaire.length === 0 ? (
          <div className="text-sm text-[#9a7060] py-2">Aucune prépa en attente ✓</div>
        ) : (
          <div className="space-y-2">
            {aFaire.map((p) => (
              <div key={p.id} className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-sm text-[#2c1a10] truncate">{p.name}</div>
                    <div className="text-[11px] text-[#9a7060]">
                      {p.quantity} {p.unit} · {p.station}
                      {p.priority === "Urgente" && <span className="text-red-700 font-black"> · Urgente</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => startComplete(p)}
                    className="shrink-0 h-9 px-3 rounded-xl bg-[#5a7828] text-white text-xs font-black cursor-pointer"
                  >
                    Marquer fait
                  </button>
                </div>
                {completingId === p.id && (
                  <div className="mt-2.5 pt-2.5 border-t border-[#e5d5c5] space-y-2">
                    <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">
                      Quantité produite ({p.unit})
                    </label>
                    <input
                      type="number"
                      autoFocus
                      value={qtyDraft}
                      onChange={(e) => setQtyDraft(e.target.value)}
                      className={inputClass}
                    />
                    {error && <div className="text-xs font-bold text-red-600">{error}</div>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setCompletingId(null)} className="flex-1 h-10 rounded-xl text-[#9a7060] font-bold text-xs cursor-pointer">
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmComplete(p)}
                        disabled={busy}
                        className="flex-1 h-10 rounded-xl bg-[#5a7828] text-white font-black text-xs cursor-pointer disabled:opacity-50"
                      >
                        {busy ? "…" : "Confirmer"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="rounded-2xl border border-[#e5d5c5] bg-white overflow-hidden [&::-webkit-details-marker]:hidden">
        <summary className="p-3.5 cursor-pointer flex items-center justify-between gap-2 list-none">
          <span className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Faites aujourd&apos;hui</span>
          <span className="text-xs font-bold text-[#9a7060]">{faitesAujourdhui.length} ▾</span>
        </summary>
        <div className="px-3.5 pb-3.5 space-y-2">
          {faitesAujourdhui.length === 0 ? (
            <div className="text-sm text-[#9a7060] py-2">Aucune prépa terminée aujourd&apos;hui</div>
          ) : (
            faitesAujourdhui.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-[#e5d5c5] p-3">
                <div className="font-bold text-sm text-[#2c1a10]">{p.name}</div>
                <div className="text-[11px] text-[#9a7060] font-semibold">{p.quantity} {p.unit}</div>
              </div>
            ))
          )}
        </div>
      </details>

      {showAdd && (
        <AddPrepModal
          referentiels={referentiels}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

function CatalogueTab({ products, referentiels, onRefresh }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [zoneFilter, setZoneFilter] = useState("Toutes");
  const [editing, setEditing] = useState(null);

  const categories = useMemo(() => ["Toutes", ...new Set(products.map((p) => p.category || p.categorie).filter(Boolean))], [products]);
  const zones = useMemo(() => ["Toutes", ...new Set(products.map((p) => p.zone || p.zoneStockage).filter(Boolean))], [products]);

  const filtered = useMemo(
    () => products.filter((p) => {
      if (!(p.name || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "Toutes" && (p.category || p.categorie) !== categoryFilter) return false;
      if (zoneFilter !== "Toutes" && (p.zone || p.zoneStockage) !== zoneFilter) return false;
      return true;
    }),
    [products, search, categoryFilter, zoneFilter]
  );
  const grouped = useMemo(() => groupBy(filtered, "category"), [filtered]);

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher dans le catalogue…" />
      <FilterPills options={categories} value={categoryFilter} onChange={setCategoryFilter} />
      <FilterPills options={zones} value={zoneFilter} onChange={setZoneFilter} />

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-4">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">{cat} ({items.length})</div>
          <div className="space-y-2">
            {items.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-[#f0e8dc] shrink-0 flex items-center justify-center text-lg">📦</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-black text-sm text-[#2c1a10] truncate">{p.name}</div>
                  <div className="text-[11px] text-[#9a7060]">
                    {p.supplier || "Sans fournisseur"} · {p.uniteCommande || p.unit || "—"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="shrink-0 h-9 px-3 rounded-xl bg-[#f0e8dc] text-[#2c1a10] text-xs font-black cursor-pointer hover:bg-[#e5d5c5] transition-colors"
                >
                  Modifier
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <div className="text-center text-sm text-[#9a7060] py-10">Aucun résultat</div>}

      {editing && (
        <ProductFormModal
          mode="edit"
          initial={{
            id: editing.id,
            ingredient: editing.name,
            categorie: editing.category || editing.categorie || "",
            zoneStockage: editing.zone || editing.zoneStockage || "",
            uniteStock: editing.uniteStock || "",
            seuilAlerte: editing.seuilAlerte ?? "",
            seuilCritique: editing.seuilCritique ?? "",
          }}
          referentiels={referentiels}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

const EMPTY_REFERENTIELS = { categories: [], sousCategories: [], unites: [], zones: [] };

export default function StockPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const { stockLive, products, preps, refreshStock, refreshProducts, refreshPreps } = useAppContext();

  const [tab, setTab] = useState("live");
  const [referentiels, setReferentiels] = useState(EMPTY_REFERENTIELS);

  useEffect(() => {
    if (!isAdmin) router.replace("/manager");
  }, [isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/settings/referentiels")
      .then((r) => r.json())
      .then((data) => setReferentiels({ ...EMPTY_REFERENTIELS, ...data }))
      .catch(() => {});
  }, [isAdmin]);

  if (!isAdmin) return null;

  const refreshAll = () => { refreshStock(); refreshProducts(); refreshPreps(); };

  const tabs = [
    { key: "live", label: "📦 Stock Live" },
    { key: "prepas", label: "🍳 Prépas" },
    { key: "catalogue", label: "📋 Catalogue" },
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

      {tab === "live" && <StockLiveTab stockLive={stockLive} referentiels={referentiels} onRefresh={refreshAll} />}
      {tab === "prepas" && <PrepasTab preps={preps} stockLive={stockLive} referentiels={referentiels} onRefresh={refreshAll} />}
      {tab === "catalogue" && <CatalogueTab products={products} referentiels={referentiels} onRefresh={refreshAll} />}
    </div>
  );
}
