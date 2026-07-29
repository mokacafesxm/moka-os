"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";

const STATUS_LABEL = { mapped: "Mappée", unmapped: "Non mappée", not_required: "Non requise" };
const STATUS_COLOR = { mapped: "#5a7828", unmapped: "#b91c1c", not_required: "#9a7060" };

function computeStatus(product, lines) {
  if (product.requiresRecipe === false) return "not_required";
  const activeLines = lines.filter((l) => l.soldProductId === product.id && l.active);
  return activeLines.length === 0 ? "unmapped" : "mapped";
}

export default function RecettesPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();

  const [soldProducts, setSoldProducts] = useState([]);
  const [lines, setLines] = useState([]);
  const [ingredientsById, setIngredientsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/recipes/sold-products").then((r) => r.json().then((data) => ({ ok: r.ok, data }))),
      fetch("/api/recipes/lines").then((r) => r.json().then((data) => ({ ok: r.ok, data }))),
      fetch("/api/products").then((r) => r.json()),
    ])
      .then(([soldProductsRes, linesRes, productsData]) => {
        if (ignore) return;
        if (!soldProductsRes.ok) throw new Error(soldProductsRes.data?.error || "Erreur chargement produits");
        if (!linesRes.ok) throw new Error(linesRes.data?.error || "Erreur chargement lignes de recette");
        setSoldProducts(Array.isArray(soldProductsRes.data) ? soldProductsRes.data : []);
        setLines(Array.isArray(linesRes.data) ? linesRes.data : []);
        const ingredients = Array.isArray(productsData) ? productsData : [];
        const map = {};
        for (const ing of ingredients) map[ing.id] = ing.ingredient || ing.name;
        setIngredientsById(map);
      })
      .catch((err) => {
        if (ignore) return;
        setError(
          err.message?.includes("CONFIG_MISSING")
            ? "Recettes non configurées — bases Notion pas encore créées"
            : err.message
        );
      })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [isAdmin]);

  const selectedProduct = useMemo(
    () => soldProducts.find((p) => p.id === selectedId) || null,
    [soldProducts, selectedId]
  );
  const selectedLines = useMemo(
    () => lines.filter((l) => l.soldProductId === selectedId && l.active),
    [lines, selectedId]
  );
  // UX audit (28 jul 2026) — liste potentiellement longue sans recherche,
  // contrairement à Stock/Catalogue qui en ont déjà une. Même pattern ici.
  const filteredProducts = useMemo(
    () => soldProducts.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())),
    [soldProducts, search]
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
          {selectedProduct ? selectedProduct.name : "Fiche recette"}
        </h1>
      </div>

      {loading && <div className="text-center text-sm text-[#9a7060] py-10">Chargement…</div>}

      {!loading && error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-500">
          {error}
        </div>
      )}

      {!loading && !error && !selectedProduct && (
        <div className="space-y-2">
          {soldProducts.length > 0 && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une recette…"
              className="w-full h-11 px-4 rounded-2xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] mb-1"
            />
          )}
          {soldProducts.length === 0 && (
            <div className="text-center text-sm text-[#9a7060] py-10">Aucun produit vendu créé pour l'instant</div>
          )}
          {soldProducts.length > 0 && filteredProducts.length === 0 && (
            <div className="text-center text-sm text-[#9a7060] py-10">Aucun résultat</div>
          )}
          {filteredProducts.map((product) => {
            const status = computeStatus(product, lines);
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedId(product.id)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#e5d5c5] text-left cursor-pointer"
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
    </div>
  );
}
