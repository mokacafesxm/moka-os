"use client";

// "Variantes" is technically an N-dimension cartesian array (see
// app/commander/_lib/variants.js), but every real product in Notion today
// uses at most one dimension (Taille, Parfum, "Pick One"…) — this editor
// only supports that single-dimension case. A product that genuinely has
// multi-dimension variants (none currently do) is shown read-only instead
// of risking a silent data-loss save.

function isMultiDimension(variantes) {
  return variantes.some((v) => (v.options || []).length > 1);
}

function dimensionName(variantes) {
  return variantes[0]?.options?.[0]?.name || "";
}

function toRows(variantes) {
  return variantes.map((v) => ({ value: v.options?.[0]?.value || "", price: v.price || "" }));
}

function fromRows(name, rows) {
  return rows
    .filter((r) => r.value.trim())
    .map((r) => ({ price: String(r.price || 0), options: [{ name, value: r.value }] }));
}

export default function VariantesEditor({ variantes, onChange }) {
  if (variantes.length > 0 && isMultiDimension(variantes)) {
    return (
      <div className="rounded-xl bg-amber-50 text-amber-800 text-xs font-semibold p-3">
        Ce produit a des variantes multi-dimensions (plusieurs options combinées) — non éditables ici pour éviter
        de perdre des données. Modifie-les directement dans Notion.
      </div>
    );
  }

  const name = dimensionName(variantes);
  const rows = toRows(variantes);
  const active = variantes.length > 0;

  function setName(newName) {
    onChange(fromRows(newName, rows));
  }

  function setRow(i, patch) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(fromRows(name, next));
  }

  function addRow() {
    onChange(fromRows(name || "Option", [...rows, { value: "", price: "" }]));
  }

  function removeRow(i) {
    onChange(fromRows(name, rows.filter((_, idx) => idx !== i)));
  }

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => onChange(fromRows("Option", [{ value: "", price: "" }]))}
        className="h-9 px-3 rounded-xl border border-dashed border-[#e5d5c5] text-xs font-black text-[#9a7060] cursor-pointer"
      >
        + Ajouter des variantes (ex. Taille, Parfum)
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom de la dimension (ex. Parfum)"
        className="w-full h-9 px-3 rounded-xl border border-[#e5d5c5] text-sm"
      />
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={r.value}
            onChange={(e) => setRow(i, { value: e.target.value })}
            placeholder="Valeur (ex. Mango)"
            className="flex-1 h-9 px-3 rounded-xl border border-[#e5d5c5] text-sm"
          />
          <input
            type="number"
            step="0.01"
            value={r.price}
            onChange={(e) => setRow(i, { price: e.target.value })}
            placeholder="Prix"
            className="w-24 h-9 px-3 rounded-xl border border-[#e5d5c5] text-sm"
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            className="w-9 h-9 rounded-xl border border-[#e5d5c5] text-[#9a7060] cursor-pointer"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="h-8 px-3 rounded-xl border border-dashed border-[#e5d5c5] text-xs font-black text-[#9a7060] cursor-pointer"
      >
        + Valeur
      </button>
    </div>
  );
}
