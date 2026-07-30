"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { isCloudinaryConfigured, uploadToCloudinary } from "../../../lib/cloudinary";

const UNITE_OPTIONS = ["g", "kg", "mL", "L", "pièce", "portion"];

const STATUS_LABEL = { mapped: "Mappée", unmapped: "Non mappée", not_required: "Non requise" };
const STATUS_COLOR = { mapped: "#5a7828", unmapped: "#b91c1c", not_required: "#9a7060" };
const ZONE_OPTIONS = ["Bar", "Cuisine", "Desserts", "Basics", "Toutes"];
const FAMILLE_COLOR = { Bar: "#5a7828", Cuisine: "#d97706", Desserts: "#b91c1c", Basics: "#9a7060", Toutes: "#2c1a10" };

function familleColor(nom) {
  return FAMILLE_COLOR[nom] || "#6b4a3d";
}

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

// Zoom pincé main — le viewport global a userScalable=false (app/layout.js,
// pour éviter un zoom accidentel du reste de l'UI). Un `touch-action:
// pinch-zoom` CSS seul ne suffit pas : iOS Safari honore le verrou du
// viewport meta globalement et ignore ce réglage par élément — donc pas de
// pinch natif possible ici, on calcule nous-mêmes la distance entre les
// deux doigts et on applique un transform scale(). Double-tap réinitialise.
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

const EMPTY_RECETTE_FORM = { nom: "", famille: "", photoUrl: "", pdfUrl: "" };

function RecetteFormModal({ mode, initial, familles, onClose, onSaved }) {
  const [form, setForm] = useState(initial || { ...EMPTY_RECETTE_FORM, famille: familles[0]?.nom || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const cloudinaryReady = isCloudinaryConfigured();

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadToCloudinary(file);
      setForm((f) => ({ ...f, photoUrl: url }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const submit = async () => {
    if (!form.nom.trim()) { setError("Nom requis"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/recettes", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "create" ? form : { id: initial.id, ...form }),
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
    <ModalShell title={mode === "create" ? "Nouvelle recette" : `Modifier ${initial?.nom || ""}`} onClose={onClose}>
      <input
        value={form.nom}
        onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
        placeholder="Nom"
        className={inputClass}
        autoFocus
      />
      <select value={form.famille} onChange={(e) => setForm((f) => ({ ...f, famille: e.target.value }))} className={inputClass}>
        <option value="">Famille…</option>
        {familles.map((f) => <option key={f.id} value={f.nom}>{f.emoji ? `${f.emoji} ` : ""}{f.nom}</option>)}
      </select>
      {cloudinaryReady && (
        <label className="flex items-center justify-center h-11 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-sm font-bold cursor-pointer">
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
          {uploading ? "Envoi…" : "📷 Uploader une photo"}
        </label>
      )}
      <input
        value={form.photoUrl}
        onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
        placeholder={cloudinaryReady ? "…ou colle une URL directement" : "https://..."}
        className={inputClass}
      />
      <input
        value={form.pdfUrl}
        onChange={(e) => setForm((f) => ({ ...f, pdfUrl: e.target.value }))}
        placeholder="Lien vers la fiche PDF…"
        className={inputClass}
      />
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl text-[#9a7060] font-bold text-sm cursor-pointer">
          Annuler
        </button>
        <button type="button" onClick={submit} disabled={saving} className="flex-1 h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50">
          {saving ? "…" : "Enregistrer"}
        </button>
      </div>
    </ModalShell>
  );
}

function NewCollectionModal({ onClose, onSaved }) {
  const [nom, setNom] = useState("");
  const [emoji, setEmoji] = useState("");
  const [zone, setZone] = useState("Bar");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!nom.trim()) { setError("Nom requis"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/recettes/familles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, emoji, zone }),
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
    <ModalShell title="Nouvelle collection" onClose={onClose}>
      <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className={inputClass} autoFocus />
      <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 2))} placeholder="Emoji (optionnel)" className={inputClass} />
      <select value={zone} onChange={(e) => setZone(e.target.value)} className={inputClass}>
        {ZONE_OPTIONS.map((z) => <option key={z} value={z}>{z}</option>)}
      </select>
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

function RecetteModal({ recette, familles, soldProducts, lines, ingredientsById, onClose, onSaved }) {
  const [zoomed, setZoomed] = useState(false);
  const [editing, setEditing] = useState(false);

  const matchedProduct = useMemo(
    () => soldProducts.find((p) => normalizeName(p.name) === normalizeName(recette.nom)) || null,
    [soldProducts, recette.nom]
  );
  const matchedLines = useMemo(
    () => (matchedProduct ? lines.filter((l) => l.soldProductId === matchedProduct.id && l.active) : []),
    [lines, matchedProduct]
  );

  if (zoomed && recette.photoUrl) {
    return <ZoomablePhoto src={recette.photoUrl} alt={recette.nom} onClose={() => setZoomed(false)} />;
  }

  if (editing) {
    return (
      <RecetteFormModal
        mode="edit"
        initial={{ id: recette.id, nom: recette.nom, famille: recette.famille, photoUrl: recette.photoUrl, pdfUrl: recette.pdfUrl }}
        familles={familles}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); onSaved(); onClose(); }}
      />
    );
  }

  return (
    <ModalShell title={recette.nom} onClose={onClose}>
      <div>
        <span
          className="text-[10px] font-black px-2 py-1 rounded-lg"
          style={{ color: familleColor(recette.famille), background: `${familleColor(recette.famille)}1a` }}
        >
          {recette.famille || "Sans famille"}
        </span>
      </div>

      {recette.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recette.photoUrl}
          alt={recette.nom}
          onClick={() => setZoomed(true)}
          className="w-full max-h-72 object-contain rounded-xl bg-white cursor-zoom-in"
        />
      ) : recette.pdfUrl ? (
        <div className="space-y-2">
          <a
            href={recette.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-center h-11 leading-[44px] rounded-xl bg-[#2c1a10] text-white text-sm font-black"
          >
            📄 Voir la fiche PDF
          </a>
          {/* L'aperçu iframe reste affiché même si l'hébergeur du PDF bloque
              l'affichage en iframe (X-Frame-Options) — un navigateur ne peut
              pas détecter ce blocage en JS pour cacher l'iframe
              conditionnellement, donc le bouton ci-dessus est le vrai
              fallback ("📄 Télécharger la fiche" en second recours). */}
          <iframe src={recette.pdfUrl} title={recette.nom} className="w-full h-64 rounded-xl border border-[#e5d5c5] bg-white" />
          <a href={recette.pdfUrl} target="_blank" rel="noreferrer" className="block text-center text-xs font-bold text-[#5a7828] underline">
            📄 Télécharger la fiche
          </a>
        </div>
      ) : (
        <div className="text-sm text-[#9a7060] text-center py-4">Aucun visuel pour cette recette</div>
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

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full h-11 rounded-xl bg-[#f0e8dc] text-[#2c1a10] font-black text-sm cursor-pointer"
      >
        Modifier
      </button>
    </ModalShell>
  );
}

function RecetteCard({ recette, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-2xl border border-[#e5d5c5] bg-white overflow-hidden text-left cursor-pointer active:scale-[0.98] transition-transform"
    >
      {recette.photoUrl ? (
        <div className="w-full aspect-[3/4] bg-[#f0e8dc]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recette.photoUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-[3/4] bg-[#f0e8dc] flex items-center justify-center text-3xl">
          {recette.pdfUrl ? "📄" : "🖼"}
        </div>
      )}
      <div className="p-2.5">
        <div className="font-black text-sm text-[#2c1a10] truncate">{recette.nom}</div>
        <span
          className="inline-block mt-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
          style={{ color: familleColor(recette.famille), background: `${familleColor(recette.famille)}1a` }}
        >
          {recette.famille || "Sans famille"}
        </span>
      </div>
    </button>
  );
}

// ── Tab "Recettes mappées" — sous-section A (menu) et B (batch/prépas) ────

function ligneName(kind, id, ingredients, batchRecettes) {
  if (kind === "batch") return batchRecettes.find((b) => b.id === id)?.nom || "?";
  return ingredients.find((i) => i.id === id)?.ingredient || ingredients.find((i) => i.id === id)?.name || "?";
}

// Select groupé "--- Ingrédients ---" / "--- Prépas/Batch ---" — un
// ingrédient de recette (menu ou batch) peut être soit un ingrédient brut
// (MOKA_Ingredients_Master), soit — seulement pour les recettes menu — une
// autre recette batch déjà définie (ex: Smashed Avocado utilise la Base
// Guacamole comme "ingrédient"). Les recettes batch elles-mêmes ne peuvent
// référencer que des ingrédients bruts (voir `allowBatch`).
function LigneAdder({ ingredients, batchRecettes, allowBatch, onAdd }) {
  const [kind, setKind] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("g");

  const add = () => {
    if (!kind || !qty) return;
    const [k, id] = kind.split(":");
    onAdd({ kind: k, id, name: ligneName(k, id, ingredients, batchRecettes), qty: Number(qty), unit });
    setKind("");
    setQty("");
  };

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="flex-1 min-w-[140px] h-10 px-2.5 rounded-lg border border-[#e5d5c5] bg-white text-xs font-semibold text-[#2c1a10] outline-none">
        <option value="">Ingrédient…</option>
        <optgroup label="--- Ingrédients ---">
          {ingredients.map((i) => <option key={`ing-${i.id}`} value={`ingredient:${i.id}`}>{i.ingredient || i.name}</option>)}
        </optgroup>
        {allowBatch && batchRecettes.length > 0 && (
          <optgroup label="--- Prépas/Batch ---">
            {batchRecettes.map((b) => <option key={`batch-${b.id}`} value={`batch:${b.id}`}>{b.nom}</option>)}
          </optgroup>
        )}
      </select>
      <input type="number" min="0" step="0.1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qté" className="w-16 h-10 px-2 rounded-lg border border-[#e5d5c5] bg-white text-xs font-semibold text-[#2c1a10] outline-none" />
      <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-20 h-10 px-1.5 rounded-lg border border-[#e5d5c5] bg-white text-xs font-semibold text-[#2c1a10] outline-none">
        {UNITE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <button type="button" onClick={add} className="h-10 px-3 rounded-lg bg-[#5a7828] text-white text-xs font-black cursor-pointer">+</button>
    </div>
  );
}

function LigneList({ lignes, onRemove }) {
  if (lignes.length === 0) return <div className="text-sm text-[#9a7060] py-1">Aucun ingrédient pour l&apos;instant</div>;
  return (
    <div className="space-y-1.5">
      {lignes.map((l, i) => (
        <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-[#faf5ef] px-2.5 py-2">
          <span className="text-sm font-bold text-[#2c1a10]">
            {l.kind === "batch" && "🍲 "}{l.name}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-[#9a7060] font-semibold">{l.qty} {l.unit}</span>
            <button type="button" onClick={() => onRemove(i)} className="w-6 h-6 rounded-md bg-[#fee2e2] text-red-700 text-xs font-black cursor-pointer">×</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MenuMappingModal({ product, mappedEntry, ingredients, batchRecettes, onClose, onSaved }) {
  const [lignes, setLignes] = useState(mappedEntry?.lignes || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/recettes/mapped", {
        method: mappedEntry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mappedEntry
            ? { id: mappedEntry.id, lignes }
            : { type: "menu", nom: product.name, soldProductId: product.id, lignes }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={product.name} onClose={onClose}>
      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5 space-y-3">
        <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Composition</div>
        <LigneList lignes={lignes} onRemove={(i) => setLignes((cur) => cur.filter((_, idx) => idx !== i))} />
        <LigneAdder ingredients={ingredients} batchRecettes={batchRecettes} allowBatch onAdd={(l) => setLignes((cur) => [...cur, l])} />
      </div>
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
      <button type="button" onClick={save} disabled={saving} className="w-full h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50">
        {saving ? "…" : "Enregistrer"}
      </button>
    </ModalShell>
  );
}

const EMPTY_BATCH_FORM = { nom: "", quantiteProduite: "", uniteProduite: "kg", lignes: [] };

function BatchFormModal({ initial, ingredients, onClose, onSaved }) {
  const [form, setForm] = useState(initial || EMPTY_BATCH_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!form.nom.trim()) { setError("Nom requis"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/recettes/mapped", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          initial
            ? { id: initial.id, nom: form.nom, lignes: form.lignes, quantiteProduite: form.quantiteProduite, uniteProduite: form.uniteProduite }
            : { type: "batch", ...form }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={initial ? `Modifier ${initial.nom}` : "Nouvelle recette batch"} onClose={onClose}>
      <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Nom de la prépa (ex: Guacamole)" className={inputClass} autoFocus />
      <div className="flex gap-2">
        <input type="number" min="0" step="0.1" value={form.quantiteProduite} onChange={(e) => setForm((f) => ({ ...f, quantiteProduite: e.target.value }))} placeholder="Qté produite / lot" className={inputClass} />
        <select value={form.uniteProduite} onChange={(e) => setForm((f) => ({ ...f, uniteProduite: e.target.value }))} className={inputClass}>
          {UNITE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5 space-y-3">
        <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Ingrédients bruts</div>
        <LigneList lignes={form.lignes} onRemove={(i) => setForm((f) => ({ ...f, lignes: f.lignes.filter((_, idx) => idx !== i) }))} />
        <LigneAdder ingredients={ingredients} batchRecettes={[]} allowBatch={false} onAdd={(l) => setForm((f) => ({ ...f, lignes: [...f.lignes, l] }))} />
      </div>
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
      <button type="button" onClick={save} disabled={saving} className="w-full h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50">
        {saving ? "…" : "Enregistrer"}
      </button>
    </ModalShell>
  );
}

function BatchCard({ batch, onSelect, onDelete }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5 flex items-center justify-between gap-2">
      <button type="button" onClick={onSelect} className="flex-1 text-left cursor-pointer min-w-0">
        <div className="font-black text-sm text-[#2c1a10] truncate">🍲 {batch.nom}</div>
        <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
          {batch.quantiteProduite ? `${batch.quantiteProduite} ${batch.uniteProduite || ""} / lot · ` : ""}
          {batch.lignes.length} ingrédient{batch.lignes.length > 1 ? "s" : ""}
        </div>
      </button>
      <button type="button" onClick={onDelete} className="w-8 h-8 shrink-0 rounded-lg bg-[#fee2e2] text-red-700 cursor-pointer">🗑</button>
    </div>
  );
}

function FichesTab({ recettesList, familles, ingredients, loading, onOpenNewCollection, onOpenNewRecette, onSelectRecette }) {
  const [album, setAlbum] = useState(null); // null = grille des familles, sinon nom de famille

  const countByFamille = useMemo(() => {
    const map = {};
    for (const r of recettesList) map[r.famille] = (map[r.famille] || 0) + 1;
    return map;
  }, [recettesList]);

  const albumRecettes = useMemo(
    () => (album ? recettesList.filter((r) => r.famille === album) : []),
    [recettesList, album]
  );

  if (loading) return <div className="text-center text-sm text-[#9a7060] py-10">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onOpenNewCollection} className="px-4 py-2 rounded-xl border border-[#e5d5c5] bg-white text-sm font-black text-[#2c1a10] cursor-pointer">
          + Collection
        </button>
        <button type="button" onClick={onOpenNewRecette} className="px-4 py-2 rounded-xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer">
          + Recette
        </button>
      </div>

      {!album ? (
        familles.length === 0 ? (
          <div className="text-center text-sm text-[#9a7060] py-10">Aucune collection pour l&apos;instant</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {familles.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAlbum(f.nom)}
                className="rounded-2xl border border-[#e5d5c5] bg-white p-5 text-center cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className="text-4xl mb-2">{f.emoji || "📁"}</div>
                <div className="font-black text-sm text-[#2c1a10]">{f.nom}</div>
                <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
                  {countByFamille[f.nom] || 0} fiche{(countByFamille[f.nom] || 0) > 1 ? "s" : ""}
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <button type="button" onClick={() => setAlbum(null)} className="text-xs font-bold text-[#9a7060] underline cursor-pointer">
            ← Collections
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{familles.find((f) => f.nom === album)?.emoji}</span>
            <h2 className="text-lg font-black text-[#2c1a10]">{album}</h2>
          </div>
          {albumRecettes.length === 0 ? (
            <div className="text-center text-sm text-[#9a7060] py-10">Aucune fiche dans cette collection</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {albumRecettes.map((recette) => (
                <RecetteCard key={recette.id} recette={recette} onSelect={() => onSelectRecette(recette)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MappedTab({ soldProducts, lines, mappedMenu, ingredients, batchRecettes, loading, onRefresh }) {
  const [subTab, setSubTab] = useState("menu"); // "menu" | "batch"
  const [menuModal, setMenuModal] = useState(null); // { product, mappedEntry }
  const [batchModal, setBatchModal] = useState(null); // {} = create, entry = edit
  const [pendingDeleteBatch, setPendingDeleteBatch] = useState(null);

  const mappedByProduct = useMemo(
    () => Object.fromEntries(mappedMenu.map((m) => [m.soldProductId, m])),
    [mappedMenu]
  );

  const deleteBatch = async (batch) => {
    if (pendingDeleteBatch !== batch.id) { setPendingDeleteBatch(batch.id); return; }
    setPendingDeleteBatch(null);
    await fetch(`/api/recettes/mapped?id=${batch.id}`, { method: "DELETE" });
    onRefresh();
  };

  if (loading) return <div className="text-center text-sm text-[#9a7060] py-10">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 bg-white/60 rounded-2xl p-1.5 border border-[#e5d5c5]">
        {[{ key: "menu", label: "🍽 Recettes menu" }, { key: "batch", label: "🍲 Recettes batch" }].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={`flex-1 h-10 rounded-xl text-xs font-black cursor-pointer transition-colors ${
              subTab === t.key ? "bg-[#2c1a10] text-white" : "text-[#6b4a3d]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "menu" ? (
        <div className="space-y-2">
          {soldProducts.length === 0 && (
            <div className="text-center text-sm text-[#9a7060] py-6">Aucun produit vendu créé pour l&apos;instant</div>
          )}
          {soldProducts.map((product) => {
            const mappedEntry = mappedByProduct[product.id];
            const legacyStatus = computeStatus(product, lines);
            const nbLignes = mappedEntry?.lignes?.length || 0;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => setMenuModal({ product, mappedEntry })}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#e5d5c5] text-left cursor-pointer"
              >
                <div>
                  <div className="font-black text-sm text-[#2c1a10]">{product.name}</div>
                  <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
                    {product.productKey}{product.category ? ` · ${product.category}` : ""}
                  </div>
                </div>
                <span
                  className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                  style={nbLignes > 0 ? { color: "#5a7828", background: "#5a78281a" } : { color: STATUS_COLOR[legacyStatus], background: `${STATUS_COLOR[legacyStatus]}1a` }}
                >
                  {nbLignes > 0 ? `${nbLignes} ingrédient${nbLignes > 1 ? "s" : ""}` : STATUS_LABEL[legacyStatus]}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <button type="button" onClick={() => setBatchModal({})} className="w-full h-11 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-sm font-black cursor-pointer">
            + Nouvelle recette batch
          </button>
          {batchRecettes.length === 0 ? (
            <div className="text-center text-sm text-[#9a7060] py-10">Aucune recette batch pour l&apos;instant</div>
          ) : (
            <div className="space-y-2">
              {batchRecettes.map((b) => (
                <BatchCard
                  key={b.id}
                  batch={b}
                  onSelect={() => setBatchModal(b)}
                  onDelete={() => deleteBatch(b)}
                />
              ))}
            </div>
          )}
          {pendingDeleteBatch && (
            <div className="text-center text-xs font-bold text-red-600">Tapez 🗑 à nouveau pour confirmer la suppression</div>
          )}
        </div>
      )}

      {menuModal && (
        <MenuMappingModal
          product={menuModal.product}
          mappedEntry={menuModal.mappedEntry}
          ingredients={ingredients}
          batchRecettes={batchRecettes}
          onClose={() => setMenuModal(null)}
          onSaved={onRefresh}
        />
      )}
      {batchModal && (
        <BatchFormModal
          initial={batchModal.id ? batchModal : null}
          ingredients={ingredients}
          onClose={() => setBatchModal(null)}
          onSaved={onRefresh}
        />
      )}
    </div>
  );
}

export default function RecettesPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();

  const [tab, setTab] = useState("fiches"); // "fiches" | "mapped"
  const [soldProducts, setSoldProducts] = useState([]);
  const [lines, setLines] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [ingredientsById, setIngredientsById] = useState({});
  const [recettesList, setRecettesList] = useState([]);
  const [familles, setFamilles] = useState([]);
  const [mappedMenu, setMappedMenu] = useState([]);
  const [batchRecettes, setBatchRecettes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [showNewRecette, setShowNewRecette] = useState(false);
  const [recetteDetail, setRecetteDetail] = useState(null);

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
      fetch("/api/recettes").then((r) => r.json()),
      fetch("/api/recettes/familles").then((r) => r.json()),
      fetch("/api/recettes/mapped?type=menu").then((r) => r.json()).catch(() => []),
      fetch("/api/recettes/mapped?type=batch").then((r) => r.json()).catch(() => []),
    ])
      .then(([soldProductsRes, linesRes, productsData, recettesData, famillesData, mappedMenuData, mappedBatchData]) => {
        if (!soldProductsRes.ok) throw new Error(soldProductsRes.data?.error || "Erreur chargement produits");
        if (!linesRes.ok) throw new Error(linesRes.data?.error || "Erreur chargement lignes de recette");
        setSoldProducts(Array.isArray(soldProductsRes.data) ? soldProductsRes.data : []);
        setLines(Array.isArray(linesRes.data) ? linesRes.data : []);
        setRecettesList(Array.isArray(recettesData) ? recettesData : []);
        setFamilles(Array.isArray(famillesData) ? famillesData : []);
        setMappedMenu(Array.isArray(mappedMenuData) ? mappedMenuData : []);
        setBatchRecettes(Array.isArray(mappedBatchData) ? mappedBatchData : []);
        const list = Array.isArray(productsData) ? productsData : [];
        setIngredients(list);
        const map = {};
        for (const ing of list) map[ing.id] = ing.ingredient || ing.name;
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

  if (!isAdmin) return null;

  return (
    <div className="min-h-dvh" style={{ background: "#f7efe4" }}>
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-black text-[#2c1a10]">Recettes</h1>
      </div>

      <div className="px-4 mb-3">
        <div className="flex gap-1.5 bg-white/60 rounded-2xl p-1.5 border border-[#e5d5c5]">
          {[{ key: "fiches", label: "📋 Fiches techniques" }, { key: "mapped", label: "🍳 Recettes mappées" }].map((t) => (
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
      </div>

      <div className="px-4 pb-4">
        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-500">{error}</div>
        ) : tab === "fiches" ? (
          <FichesTab
            recettesList={recettesList}
            familles={familles}
            ingredients={ingredients}
            loading={loading}
            onOpenNewCollection={() => setShowNewCollection(true)}
            onOpenNewRecette={() => setShowNewRecette(true)}
            onSelectRecette={setRecetteDetail}
          />
        ) : (
          <MappedTab
            soldProducts={soldProducts}
            lines={lines}
            mappedMenu={mappedMenu}
            ingredients={ingredients}
            batchRecettes={batchRecettes}
            loading={loading}
            onRefresh={loadAll}
          />
        )}
      </div>

      {showNewCollection && (
        <NewCollectionModal onClose={() => setShowNewCollection(false)} onSaved={() => { setShowNewCollection(false); loadAll(); }} />
      )}
      {showNewRecette && (
        <RecetteFormModal
          mode="create"
          familles={familles}
          onClose={() => setShowNewRecette(false)}
          onSaved={() => { setShowNewRecette(false); loadAll(); }}
        />
      )}
      {recetteDetail && (
        <RecetteModal
          recette={recetteDetail}
          familles={familles}
          soldProducts={soldProducts}
          lines={lines}
          ingredientsById={ingredientsById}
          onClose={() => setRecetteDetail(null)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
