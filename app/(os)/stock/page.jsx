"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";
import { resolveOperationId, clearOperationId } from "../../../lib/stock/operation-id";

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
function isConfigurerStatut(s) {
  return String(s || "").toLowerCase().includes("configurer");
}
function statutBucket(s) {
  if (isCritiqueStatut(s)) return "Critique";
  if (isAlerteStatut(s)) return "Bas";
  if (isConfigurerStatut(s)) return "À configurer";
  return "OK";
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
// Stock Prépas), jamais en la commandant à un fournisseur — même distinction
// que Mon Poste (voir poste/page.jsx isPrepStock). Audit Prompt 5 (30 jul
// 2026) : cette détection dépendait de stockLive[i].category, qui venait du
// champ Categorie propre au Stock — vide sur ~97% des lignes en pratique
// (voir /api/stock/route.js). category vient maintenant de l'ingrédient lié
// (fiable), donc cette même fonction redevient correcte sans changement ici.
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

// Best-effort : le nom de la recette (Sold Product Catalogue / Recettes
// Batch) est censé correspondre au nom du produit préparé, mais rien ne le
// garantit — beaucoup de prépas n'ont pas encore de recette. Ne bloque
// jamais la complétion de la prépa si aucune correspondance/recette n'est
// trouvée.
function derivePrepProductName(prepName) {
  return String(prepName || "").replace(/^Pr[ée]parer\s+/i, "").trim();
}

// Cherche d'abord une recette batch dans le NOUVEAU système (Prompt 4,
// MOKA_Recettes_Batch via /api/recettes/mapped) — c'est la source pensée
// pour ce cas précis (une prépa -> ses ingrédients bruts + quantité produite
// par lot). L'ancien système (/api/recipes/lines, voir deductFromLegacyRecipe)
// reste en repli pour les prépas qui n'ont qu'une recette dans l'ancien
// système "recettes menu", jamais migrée.
async function findBatchRecipeForPrep(prepName) {
  const productName = derivePrepProductName(prepName);
  if (!productName) return null;
  const res = await fetch(`/api/recettes/mapped?type=batch`);
  if (!res.ok) return null;
  const list = await res.json().catch(() => null);
  if (!Array.isArray(list)) return null;
  const norm = (s) => String(s || "").trim().toLowerCase();
  return list.find((r) => norm(r.nom) === norm(productName)) || null;
}

async function deductFromBatchRecipe(recipe, producedQty, stockLive) {
  const batchSize = Number(recipe.quantiteProduite) || 1;
  const ratio = batchSize > 0 ? producedQty / batchSize : 0;
  const ingredientLines = (recipe.lignes || []).filter((l) => l.kind === "ingredient");
  await Promise.all(
    ingredientLines.map((line) => {
      const stockRow = stockLive.find((s) => s.ingredientId === line.id);
      if (!stockRow) return null;
      const delta = (Number(line.qty) || 0) * ratio;
      const newQty = Math.max(0, (stockRow.quantiteStock || 0) - delta);
      return fetch("/api/stock/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stockRow.id, poidsTotal: newQty, Unite: stockRow.uniteStock, mode: "replace" }),
      });
    })
  );
}

async function deductFromLegacyRecipe(prepName, producedQty, stockLive) {
  const productName = derivePrepProductName(prepName);
  if (!productName) return;
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
      const delta = (Number(line.quantity) || 0) * producedQty;
      const newQty = Math.max(0, (stockRow.quantiteStock || 0) - delta);
      return fetch("/api/stock/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: stockRow.id, poidsTotal: newQty, Unite: stockRow.uniteStock, mode: "replace" }),
      });
    })
  );
}

async function deductRecipeIngredients(prepName, producedQty, stockLive) {
  if (!(producedQty > 0)) return;
  const batchRecipe = await findBatchRecipeForPrep(prepName).catch(() => null);
  if (batchRecipe) {
    await deductFromBatchRecipe(batchRecipe, producedQty, stockLive).catch(() => {});
  } else {
    await deductFromLegacyRecipe(prepName, producedQty, stockLive).catch(() => {});
  }
}

// Ajoute la quantité produite au stock de la prépa elle-même — l'étape qui
// manquait avant Prompt 5 (la déduction des ingrédients bruts existait déjà,
// mais rien ne créditait le stock de la prépa terminée). mode "add" est
// idempotency-guardé côté API (voir lib/stock/apply-addition.js) ; on suit
// exactement le même pattern client que la réception manuelle rapide
// (app/(os)/page.js + lib/stock/operation-id.js) pour bénéficier de la même
// protection contre un double-ajout en cas de retry réseau.
async function addProducedQtyToPrepStock(prepName, producedQty, prepId, stockLive) {
  const productName = derivePrepProductName(prepName) || prepName;
  if (!productName || !(producedQty > 0)) return;
  const norm = (s) => String(s || "").trim().toLowerCase();
  const existing = stockLive.find((s) => norm(s.name) === norm(productName));
  const storage = typeof window !== "undefined" ? window.sessionStorage : null;
  const operationId = resolveOperationId(prepId, storage) || `${Date.now()}`;
  const res = await fetch("/api/stock/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: existing?.id || null,
      name: productName,
      poidsTotal: producedQty,
      Unite: existing?.uniteStock || "",
      mode: "add",
      idempotencyKey: `manual-receipt:${operationId}:${prepId}`,
    }),
  }).catch(() => null);
  if (res?.ok) clearOperationId(prepId, storage);
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
  seuilAlerte: "", seuilCritique: "", quantiteActuelle: "", visibleOrderPad: true,
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
        // "visibleOrderPad" doit toujours être renvoyé explicitement : le
        // writer /api/settings/products (mode partial) le remet à true par
        // défaut si le champ est absent de la requête, ce qui réactiverait
        // silencieusement un produit désactivé via le badge "Actif" à chaque
        // simple modification de nom/catégorie/seuils.
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
            visibleOrderPad: form.visibleOrderPad !== false,
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
        body: JSON.stringify({ id: item.id || undefined, name: item.name, poidsTotal: Number(value) || 0, Unite: item.uniteStock, mode: "replace" }),
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

function ActifToggle({ item, onToggled }) {
  const [busy, setBusy] = useState(false);
  const active = item.visibleOrderPad !== false;

  const toggle = async () => {
    setBusy(true);
    try {
      await fetch("/api/settings/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.ingredientId, visibleOrderPad: !active }),
      });
      onToggled();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || !item.ingredientId}
      title={active ? "Désactiver (masquer sans supprimer)" : "Réactiver"}
      className={`h-8 px-2.5 rounded-lg text-[10px] font-black cursor-pointer transition-colors disabled:opacity-40 ${
        active ? "bg-[#f0f7e5] text-[#5a7828] hover:bg-[#e3f0d0]" : "bg-[#f0e8dc] text-[#9a7060] hover:bg-[#e5d5c5]"
      }`}
    >
      {busy ? "…" : active ? "Actif" : "Inactif"}
    </button>
  );
}

// Fusionne le catalogue (MOKA_Ingredients_Master, source des métadonnées :
// fournisseur, unité de commande, photo, seuils, Actif) avec les niveaux
// live (MOKA_Stock_Produits_Notion, source de la quantité et du statut) —
// c'était les deux moitiés d'un même produit, éclatées en deux onglets
// séparés avant Prompt 5. On part du catalogue (source canonique des
// produits réels) et on rattache le stock par ingredientId : ça exclut
// naturellement les lignes Stock orphelines sans relation ingrédient
// (audit Prompt 5 — une poignée de lignes "NEW ORDER : ..." résiduelles
// dans MOKA_Stock_Produits_Notion, jamais nettoyées) et couvre aussi un
// produit tout juste créé dont la ligne Stock n'existe pas encore.
function mergeCatalogueStock(products, stockLive) {
  const stockByIngredient = new Map();
  stockLive.forEach((s) => { if (s.ingredientId) stockByIngredient.set(s.ingredientId, s); });

  return products.map((p) => {
    const stock = stockByIngredient.get(p.id) || null;
    return {
      ingredientId: p.id,
      id: stock?.id || null,
      name: p.name,
      category: p.category || p.categorie || "",
      zone: p.zone || p.zoneStockage || "",
      supplier: p.supplier || "",
      uniteStock: stock?.uniteStock || p.uniteStock || "",
      uniteCommande: p.uniteCommande || "",
      photo: p.photo || "",
      quantiteStock: stock?.quantiteStock ?? 0,
      statut: stock?.statut || "⚪ À configurer",
      visibleOrderPad: p.visibleOrderPad !== false,
      isPrep: isPrepStockItem({ category: p.category || p.categorie }),
    };
  });
}

const STATUS_FILTERS = ["Toutes", "Critique", "Bas", "OK", "À configurer"];

function StockCatalogueTab({ products, stockLive, referentiels, onRefresh }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Toutes");
  const [statusFilter, setStatusFilter] = useState("Toutes");
  const [showInactive, setShowInactive] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [editing, setEditing] = useState(null);

  const merged = useMemo(() => mergeCatalogueStock(products, stockLive), [products, stockLive]);
  const bruts = useMemo(() => merged.filter((i) => !i.isPrep), [merged]);
  const categories = useMemo(() => ["Toutes", ...new Set(bruts.map((i) => i.category).filter(Boolean))], [bruts]);

  const filtered = useMemo(
    () => bruts.filter((i) => {
      if (!showInactive && !i.visibleOrderPad) return false;
      if (!i.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "Toutes" && i.category !== categoryFilter) return false;
      if (statusFilter !== "Toutes" && statutBucket(i.statut) !== statusFilter) return false;
      return true;
    }),
    [bruts, search, categoryFilter, statusFilter, showInactive]
  );

  const grouped = useMemo(() => {
    const g = groupBy(filtered, "category");
    Object.keys(g).forEach((k) => { g[k] = sortByUrgency(g[k]); });
    return g;
  }, [filtered]);

  return (
    <div>
      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un produit…" />
      <FilterPills options={categories} value={categoryFilter} onChange={setCategoryFilter} />
      <FilterPills options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex-1 h-10 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer"
        >
          + Nouveau produit
        </button>
        <Link
          href="/parametres?section=categories"
          className="flex-1 h-10 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer flex items-center justify-center"
        >
          + Catégorie
        </Link>
        <button
          type="button"
          onClick={() => setShowInactive((v) => !v)}
          className={`shrink-0 h-10 px-3 rounded-xl text-xs font-black cursor-pointer ${
            showInactive ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
          }`}
        >
          Inactifs
        </button>
      </div>

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="mb-4">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">{cat} ({items.length})</div>
          <div className="space-y-2">
            {items.map((i) => (
              <div
                key={i.ingredientId}
                className={`flex items-center gap-3 rounded-2xl border border-[#e5d5c5] bg-white p-3.5 ${!i.visibleOrderPad ? "opacity-50" : ""}`}
              >
                {i.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.photo} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-xl bg-[#f0e8dc] shrink-0 flex items-center justify-center text-lg">📦</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-black text-sm text-[#2c1a10] truncate">{i.name}</div>
                  <div className="text-[11px] text-[#9a7060]">
                    {i.quantiteStock} {i.uniteStock || "—"} · {i.supplier || "Sans fournisseur"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge statut={i.statut} />
                  <button
                    type="button"
                    onClick={() => setAdjusting(i)}
                    className="h-8 px-2.5 rounded-lg bg-[#f0e8dc] text-[#2c1a10] text-[10px] font-black cursor-pointer hover:bg-[#e5d5c5] transition-colors"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(i)}
                    className="h-8 px-2.5 rounded-lg bg-[#f0e8dc] text-[#2c1a10] text-[10px] font-black cursor-pointer hover:bg-[#e5d5c5] transition-colors"
                  >
                    ✏️
                  </button>
                  <ActifToggle item={i} onToggled={onRefresh} />
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
      {editing && (
        <ProductFormModal
          mode="edit"
          initial={{
            id: editing.ingredientId,
            ingredient: editing.name,
            categorie: editing.category || "",
            zoneStockage: editing.zone || "",
            uniteStock: editing.uniteStock || "",
            seuilAlerte: "",
            seuilCritique: "",
            visibleOrderPad: editing.visibleOrderPad,
          }}
          referentiels={referentiels}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onRefresh(); }}
        />
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

function StockPrepasTab({ products, stockLive, preps, referentiels, onRefresh }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [qtyDraft, setQtyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const merged = useMemo(() => mergeCatalogueStock(products, stockLive), [products, stockLive]);
  const prepStockItems = useMemo(
    () => sortByUrgency(merged.filter((i) => i.isPrep && i.name.toLowerCase().includes(search.toLowerCase()))),
    [merged, search]
  );

  const filteredPreps = useMemo(
    () => preps.filter((p) => (p.name || "").toLowerCase().includes(search.toLowerCase())),
    [preps, search]
  );
  const aFaire = useMemo(() => filteredPreps.filter((p) => !isPrepDone(p)), [filteredPreps]);
  const faitesAujourdhui = useMemo(
    () => filteredPreps.filter((p) => isPrepDone(p) && (p.dueDate || "").slice(0, 10) === todaySXM()),
    [filteredPreps]
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
      // Best-effort — voir deductRecipeIngredients / addProducedQtyToPrepStock :
      // n'échoue jamais la complétion de la prépa si aucune recette ne
      // correspond ou si l'ajout au stock échoue.
      await deductRecipeIngredients(prep.name, produced, stockLive).catch(() => {});
      await addProducedQtyToPrepStock(prep.name, produced, prep.id, stockLive).catch(() => {});
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

      <div className="mb-4">
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">
          Niveaux de stock ({prepStockItems.length})
        </div>
        {prepStockItems.length === 0 ? (
          <div className="text-sm text-[#9a7060] py-2">Aucune prépa suivie en stock</div>
        ) : (
          <div className="space-y-2">
            {prepStockItems.map((i) => (
              <div key={i.ingredientId} className="flex items-center justify-between gap-2 rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
                <div className="min-w-0">
                  <div className="font-black text-sm text-[#2c1a10] truncate">{i.name}</div>
                  <div className="text-[11px] text-[#9a7060]">{i.quantiteStock} {i.uniteStock || "—"}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge statut={i.statut} />
                  <button
                    type="button"
                    onClick={() => setAdjusting(i)}
                    className="h-8 px-2.5 rounded-lg bg-[#f0e8dc] text-[#2c1a10] text-[10px] font-black cursor-pointer hover:bg-[#e5d5c5] transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
      {adjusting && (
        <AdjustQuantityModal item={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); onRefresh(); }} />
      )}
    </div>
  );
}

const EMPTY_REFERENTIELS = { categories: [], sousCategories: [], unites: [], zones: [] };

export default function StockPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const { stockLive, products, preps, refreshStock, refreshProducts, refreshPreps } = useAppContext();

  const [tab, setTab] = useState("catalogue");
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
    { key: "catalogue", label: "📦 Stock & Catalogue" },
    { key: "prepas", label: "🍳 Stock Prépas" },
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

      {tab === "catalogue" && (
        <StockCatalogueTab products={products} stockLive={stockLive} referentiels={referentiels} onRefresh={refreshAll} />
      )}
      {tab === "prepas" && (
        <StockPrepasTab products={products} stockLive={stockLive} preps={preps} referentiels={referentiels} onRefresh={refreshAll} />
      )}
    </div>
  );
}
