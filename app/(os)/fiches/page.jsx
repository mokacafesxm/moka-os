"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStaffContext } from "../../contexts/StaffContext";

const FAMILLE_COLOR = { Bar: "#5a7828", Cuisine: "#d97706", Desserts: "#b91c1c", Basics: "#9a7060", Toutes: "#2c1a10" };
function familleColor(nom) {
  return FAMILLE_COLOR[nom] || "#6b4a3d";
}
function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

// Fiches visibles par poste — un poste voit toujours "Basics"/"Toutes" en
// plus de sa propre zone (Sprint /recettes, FAMILLES_PAR_POSTE côté API).
const ZONES_PAR_POSTE = {
  Bar: ["Bar", "Basics", "Toutes"],
  Cuisine: ["Cuisine", "Desserts", "Basics", "Toutes"],
};

function ZoomablePhoto({ src, alt, onClose }) {
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const pinchRef = useRef({ active: false, startDist: 0, startScale: 1 });

  const dist = (touches) => {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 2) return;
    pinchRef.current = { active: true, startDist: dist(e.touches), startScale: scale };
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    setOrigin({ x: (midX / rect.width) * 100, y: (midY / rect.height) * 100 });
  };

  const handleTouchMove = (e) => {
    if (!pinchRef.current.active || e.touches.length !== 2) return;
    e.preventDefault();
    const ratio = dist(e.touches) / pinchRef.current.startDist;
    setScale(Math.min(4, Math.max(1, pinchRef.current.startScale * ratio)));
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) pinchRef.current.active = false;
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black flex items-center justify-center overflow-hidden"
      style={{ touchAction: "pinch-zoom" }}
      onClick={() => { if (scale === 1) onClose(); }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={() => setScale((s) => (s > 1 ? 1 : 2))}
        style={{ transform: `scale(${scale})`, transformOrigin: `${origin.x}% ${origin.y}%` }}
        className="max-w-full max-h-full object-contain select-none touch-none"
      />
      {scale > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setScale(1); }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/90 text-[#2c1a10] text-xs font-black cursor-pointer"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}

function FicheCard({ fiche, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-2xl border border-[#e5d5c5] bg-white overflow-hidden text-left cursor-pointer active:scale-[0.98] transition-transform"
    >
      {fiche.photoUrl ? (
        <div className="w-full aspect-[4/3] bg-[#f0e8dc]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fiche.photoUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-[4/3] flex items-center justify-center text-3xl" style={{ background: "#f7efe4" }}>
          📄
        </div>
      )}
      <div className="p-2.5">
        <div className="font-black text-sm text-[#2c1a10] truncate">{fiche.nom}</div>
        <span
          className="inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
          style={{ color: familleColor(fiche.famille), background: `${familleColor(fiche.famille)}1a` }}
        >
          {fiche.famille || "Sans famille"}
        </span>
      </div>
    </button>
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
    return <ZoomablePhoto src={fiche.photoUrl} alt={fiche.nom} onClose={() => setZoomed(false)} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div
        className="relative w-full sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-black text-[#2c1a10]">{fiche.nom}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] font-black cursor-pointer shrink-0">×</button>
        </div>

        <div>
          <span
            className="text-[10px] font-black px-2 py-1 rounded-lg"
            style={{ color: familleColor(fiche.famille), background: `${familleColor(fiche.famille)}1a` }}
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
          <a
            href={fiche.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-center h-11 leading-[44px] rounded-xl bg-[#2c1a10] text-white text-sm font-black"
          >
            📄 Voir PDF
          </a>
        ) : (
          <div className="text-sm text-[#9a7060] text-center py-4">Aucun visuel pour cette fiche</div>
        )}

        {matchedLines.length > 0 && (
          <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
            <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-2">Ingrédients</div>
            <div className="space-y-2">
              {matchedLines.map((line) => (
                <div key={line.id} className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#2c1a10]">{ingredientsById[line.ingredientId] || line.ingredientId}</span>
                  <span className="text-xs text-[#9a7060] font-semibold">{line.quantity} {line.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FichesPage() {
  const { poste } = useStaffContext();

  const [familles, setFamilles] = useState([]);
  const [fiches, setFiches] = useState([]);
  const [soldProducts, setSoldProducts] = useState([]);
  const [lines, setLines] = useState([]);
  const [ingredientsById, setIngredientsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetch("/api/recettes/familles").then((r) => r.json()),
      fetch("/api/recettes").then((r) => r.json()),
      fetch("/api/recipes/sold-products").then((r) => r.json()).catch(() => []),
      fetch("/api/recipes/lines").then((r) => r.json()).catch(() => []),
      fetch("/api/products").then((r) => r.json()).catch(() => []),
    ])
      .then(([famillesData, fichesData, soldProductsData, linesData, productsData]) => {
        if (ignore) return;
        setFamilles(Array.isArray(famillesData) ? famillesData : []);
        setFiches(Array.isArray(fichesData) ? fichesData : []);
        setSoldProducts(Array.isArray(soldProductsData) ? soldProductsData : []);
        setLines(Array.isArray(linesData) ? linesData : []);
        const ingredients = Array.isArray(productsData) ? productsData : [];
        const map = {};
        for (const ing of ingredients) map[ing.id] = ing.ingredient || ing.name;
        setIngredientsById(map);
      })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  const zones = ZONES_PAR_POSTE[poste] || [];
  const fichesVisibles = fiches.filter((f) => zones.includes(f.famille));
  const famillesById = Object.fromEntries(familles.map((f) => [f.nom, f]));

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">{poste}</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">📋 Fiches techniques</h1>
      </div>

      {loading ? (
        <div className="text-center text-sm text-[#9a7060] py-12">Chargement…</div>
      ) : fichesVisibles.length === 0 ? (
        <div className="text-center text-sm text-[#9a7060] py-12">Aucune fiche pour l&apos;instant</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {fichesVisibles.map((f) => (
            <FicheCard key={f.id} fiche={{ ...f, famille: famillesById[f.famille]?.nom || f.famille }} onSelect={() => setSelected(f)} />
          ))}
        </div>
      )}

      {selected && (
        <FicheDetailModal
          fiche={selected}
          soldProducts={soldProducts}
          lines={lines}
          ingredientsById={ingredientsById}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
