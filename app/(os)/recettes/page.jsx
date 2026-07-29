"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";

const STATUS_LABEL = { mapped: "Mappée", unmapped: "Non mappée", not_required: "Non requise" };
const STATUS_COLOR = { mapped: "#5a7828", unmapped: "#b91c1c", not_required: "#9a7060" };
const FAMILLES = ["Toutes", "Bar", "Cuisine", "Desserts", "Basics"];

function computeStatus(product, lines) {
  if (product.requiresRecipe === false) return "not_required";
  const activeLines = lines.filter((l) => l.soldProductId === product.id && l.active);
  return activeLines.length === 0 ? "unmapped" : "mapped";
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-black text-[#2c1a10]">{title}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] font-black cursor-pointer shrink-0">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const EMPTY_FICHE_FORM = { nom: "", famille: "Bar", photoUrl: "", pdfUrl: "" };

function AddFicheModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FICHE_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!form.nom.trim()) { setError("Nom requis"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/fiches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
    <ModalShell title="Nouvelle fiche" onClose={onClose}>
      <input
        value={form.nom}
        onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
        placeholder="Nom commercial"
        className={inputClass}
        autoFocus
      />
      <select value={form.famille} onChange={(e) => setForm((f) => ({ ...f, famille: e.target.value }))} className={inputClass}>
        {FAMILLES.filter((f) => f !== "Toutes").map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <input
        value={form.photoUrl}
        onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
        placeholder="URL de la photo (optionnel)"
        className={inputClass}
      />
      <input
        value={form.pdfUrl}
        onChange={(e) => setForm((f) => ({ ...f, pdfUrl: e.target.value }))}
        placeholder="URL du PDF (optionnel)"
        className={inputClass}
      />
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl text-[#9a7060] font-bold text-sm cursor-pointer">
          Annuler
        </button>
        <button type="button" onClick={submit} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50">
          {saving ? "…" : "Créer"}
        </button>
      </div>
    </ModalShell>
  );
}

function FicheDetailModal({ fiche, soldProducts, lines, ingredientsById, onClose }) {
  const [zoomed, setZoomed] = useState(false);

  const matchedProduct = useMemo(
    () => soldProducts.find((p) => normalizeName(p.name) === normalizeName(fiche.nom)) || null,
    [soldProducts, fiche.nom]
  );
  const matchedLines = useMemo(
    () => (matchedProduct ? lines.filter((l) => l.soldProductId === matchedProduct.id && l.active) : []),
    [lines, matchedProduct]
  );

  if (zoomed && fiche.photoUrl) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center" onClick={() => setZoomed(false)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fiche.photoUrl} alt={fiche.nom} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }

  return (
    <ModalShell title={fiche.nom} onClose={onClose}>
      <div>
        <span
          className="text-[10px] font-black px-2 py-1 rounded-lg"
          style={{ color: "#5a7828", background: "#f0f7e5" }}
        >
          {fiche.famille || "Sans famille"}
        </span>
      </div>

      {fiche.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fiche.photoUrl}
          alt={fiche.nom}
          onClick={() => setZoomed(true)}
          className="w-full max-h-72 object-contain rounded-xl bg-white cursor-zoom-in"
        />
      ) : fiche.pdfUrl ? (
        <div className="space-y-2">
          <iframe src={fiche.pdfUrl} title={fiche.nom} className="w-full h-64 rounded-xl border border-[#e5d5c5] bg-white" />
          <a href={fiche.pdfUrl} target="_blank" rel="noreferrer" className="block text-center text-xs font-bold text-[#5a7828] underline">
            Ouvrir le PDF ↗
          </a>
        </div>
      ) : (
        <div className="text-sm text-[#9a7060] text-center py-4">Aucun visuel pour cette fiche</div>
      )}

      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
        <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-2">Ingrédients</div>
        {matchedLines.length === 0 ? (
          <div className="text-sm text-[#9a7060] py-1">Aucune composition liée pour l&apos;instant</div>
        ) : (
          <div className="space-y-2">
            {matchedLines.map((line) => (
              <div key={line.id} className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#2c1a10]">{ingredientsById[line.ingredientId] || line.ingredientId}</span>
                <span className="text-xs text-[#9a7060] font-semibold">{line.quantity} {line.unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function FicheCard({ fiche, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3 rounded-2xl border border-[#e5d5c5] bg-white p-3 text-left cursor-pointer w-full"
    >
      {fiche.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fiche.photoUrl} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-xl bg-[#f0e8dc] shrink-0 flex items-center justify-center text-lg">
          {fiche.pdfUrl ? "📄" : "🖼"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-black text-sm text-[#2c1a10] truncate">{fiche.nom}</div>
        <div className="text-[11px] text-[#9a7060] font-semibold">{fiche.famille || "Sans famille"}</div>
      </div>
    </button>
  );
}

export default function RecettesPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();

  const [soldProducts, setSoldProducts] = useState([]);
  const [lines, setLines] = useState([]);
  const [ingredientsById, setIngredientsById] = useState({});
  const [fiches, setFiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("Toutes");
  const [showAddFiche, setShowAddFiche] = useState(false);
  const [ficheDetail, setFicheDetail] = useState(null);

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  const loadAll = () => {
    setLoading(true);
    setError(null);
    return Promise.all([
      fetch("/api/recipes/sold-products").then((r) => r.json().then((data) => ({ ok: r.ok, data }))),
      fetch("/api/recipes/lines").then((r) => r.json().then((data) => ({ ok: r.ok, data }))),
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/fiches").then((r) => r.json()),
    ])
      .then(([soldProductsRes, linesRes, productsData, fichesData]) => {
        if (!soldProductsRes.ok) throw new Error(soldProductsRes.data?.error || "Erreur chargement produits");
        if (!linesRes.ok) throw new Error(linesRes.data?.error || "Erreur chargement lignes de recette");
        setSoldProducts(Array.isArray(soldProductsRes.data) ? soldProductsRes.data : []);
        setLines(Array.isArray(linesRes.data) ? linesRes.data : []);
        setFiches(Array.isArray(fichesData) ? fichesData : []);
        const ingredients = Array.isArray(productsData) ? productsData : [];
        const map = {};
        for (const ing of ingredients) map[ing.id] = ing.ingredient || ing.name;
        setIngredientsById(map);
      })
      .catch((err) => {
        setError(
          err.message?.includes("CONFIG_MISSING")
            ? "Recettes non configurées — bases Notion pas encore créées"
            : err.message
        );
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
  }, [isAdmin]);

  const selectedProduct = useMemo(
    () => soldProducts.find((p) => p.id === selectedId) || null,
    [soldProducts, selectedId]
  );
  const selectedLines = useMemo(
    () => lines.filter((l) => l.soldProductId === selectedId && l.active),
    [lines, selectedId]
  );
  const filteredProducts = useMemo(
    () => soldProducts.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [soldProducts, search]
  );
  const filteredFiches = useMemo(
    () => fiches.filter((f) => {
      if (!normalizeName(f.nom).includes(normalizeName(search))) return false;
      if (familyFilter !== "Toutes" && f.famille !== familyFilter) return false;
      return true;
    }),
    [fiches, search, familyFilter]
  );

  if (!isAdmin) return null;

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div className="flex items-center gap-2">
        {selectedProduct && (
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-xs font-bold text-[#9a7060] underline cursor-pointer"
          >
            ← Recettes
          </button>
        )}
      </div>

      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Recettes</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">
          {selectedProduct ? selectedProduct.name : "Fiches techniques"}
        </h1>
      </div>

      {loading && <div className="text-center text-sm text-[#9a7060] py-10">Chargement…</div>}

      {!loading && error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-500">
          {error}
        </div>
      )}

      {!loading && !error && !selectedProduct && (
        <div className="space-y-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une fiche ou une recette…"
            className="w-full h-11 px-4 rounded-2xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
          />

          <div>
            <div className="flex gap-2 overflow-x-auto pb-3">
              {FAMILLES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFamilyFilter(f)}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
                    familyFilter === f ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowAddFiche(true)}
              className="w-full h-10 mb-3 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer"
            >
              + Nouvelle fiche
            </button>

            {filteredFiches.length === 0 ? (
              <div className="text-center text-sm text-[#9a7060] py-6">Aucune fiche pour cette famille</div>
            ) : (
              <div className="space-y-2">
                {filteredFiches.map((fiche) => (
                  <FicheCard key={fiche.id} fiche={fiche} onSelect={() => setFicheDetail(fiche)} />
                ))}
              </div>
            )}
          </div>

          <details className="rounded-2xl border border-[#e5d5c5] bg-white overflow-hidden [&::-webkit-details-marker]:hidden">
            <summary className="p-4 cursor-pointer flex items-center justify-between gap-2 list-none">
              <span className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Toutes les recettes</span>
              <span className="text-xs font-bold text-[#9a7060]">Mapping ingrédients ▾</span>
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-2">
              {soldProducts.length === 0 && (
                <div className="text-center text-sm text-[#9a7060] py-6">Aucun produit vendu créé pour l&apos;instant</div>
              )}
              {soldProducts.length > 0 && filteredProducts.length === 0 && (
                <div className="text-center text-sm text-[#9a7060] py-6">Aucun résultat</div>
              )}
              {filteredProducts.map((product) => {
                const status = computeStatus(product, lines);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setSelectedId(product.id)}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#faf5ef] border border-[#e5d5c5] text-left cursor-pointer"
                  >
                    <div>
                      <div className="font-black text-sm text-[#2c1a10]">{product.name}</div>
                      <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
                        {product.productKey}{product.category ? ` · ${product.category}` : ""}
                        {!product.active && " · archivé"}
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                      style={{ color: STATUS_COLOR[status], background: `${STATUS_COLOR[status]}1a` }}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </button>
                );
              })}
            </div>
          </details>
        </div>
      )}

      {!loading && !error && selectedProduct && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
            <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Identité</div>
            <div className="mt-1 text-sm font-bold text-[#2c1a10]">{selectedProduct.productKey}</div>
            <div className="text-xs text-[#9a7060] mt-0.5">
              {selectedProduct.category || "Sans catégorie"} · {selectedProduct.active ? "Actif" : "Archivé"}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
            <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-2">Composition</div>
            {selectedLines.length === 0 ? (
              <div className="text-sm text-[#9a7060] py-2">Aucune ligne — recette non mappée</div>
            ) : (
              <div className="space-y-2">
                {selectedLines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#2c1a10]">
                      {ingredientsById[line.ingredientId] || line.ingredientId}
                    </span>
                    <span className="text-xs text-[#9a7060] font-semibold">{line.quantity} {line.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showAddFiche && (
        <AddFicheModal onClose={() => setShowAddFiche(false)} onSaved={() => { setShowAddFiche(false); loadAll(); }} />
      )}
      {ficheDetail && (
        <FicheDetailModal
          fiche={ficheDetail}
          soldProducts={soldProducts}
          lines={lines}
          ingredientsById={ingredientsById}
          onClose={() => setFicheDetail(null)}
        />
      )}
    </div>
  );
}
