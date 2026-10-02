"use client";

// "Extras" groups (see app/commander/_lib/extras.js): independent add-on
// groups, each single or multi-select, each option optionally carrying a
// free-text sub-field (e.g. "Egg Your Way" → "Cuisson souhaitée"). Edited
// as-is — unlike Variantes, this shape already matches a flat
// groups-of-options structure, no simplification needed.

function updateGroups(groups, i, patch) {
  return groups.map((g, idx) => (idx === i ? { ...g, ...patch } : g));
}

export default function ExtrasEditor({ extras, onChange }) {
  function addGroup() {
    onChange([...extras, { name: "Nouveau groupe", type: "single", options: [] }]);
  }

  function removeGroup(i) {
    onChange(extras.filter((_, idx) => idx !== i));
  }

  function addOption(i) {
    const group = extras[i];
    onChange(updateGroups(extras, i, { options: [...group.options, { label: "", price: 0 }] }));
  }

  function updateOption(i, j, patch) {
    const group = extras[i];
    const options = group.options.map((o, idx) => (idx === j ? { ...o, ...patch } : o));
    onChange(updateGroups(extras, i, { options }));
  }

  function removeOption(i, j) {
    const group = extras[i];
    onChange(updateGroups(extras, i, { options: group.options.filter((_, idx) => idx !== j) }));
  }

  return (
    <div className="space-y-3">
      {extras.map((group, i) => (
        <div key={i} className="rounded-xl border border-[#e5d5c5] p-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={group.name}
              onChange={(e) => onChange(updateGroups(extras, i, { name: e.target.value }))}
              placeholder="Nom du groupe (ex. Choose Your Protein)"
              className="flex-1 h-9 px-3 rounded-xl border border-[#e5d5c5] text-sm font-semibold"
            />
            <select
              value={group.type}
              onChange={(e) => onChange(updateGroups(extras, i, { type: e.target.value }))}
              className="h-9 px-2 rounded-xl border border-[#e5d5c5] text-xs"
            >
              <option value="single">Un seul choix</option>
              <option value="multi">Plusieurs choix</option>
            </select>
            <button
              type="button"
              onClick={() => removeGroup(i)}
              className="w-9 h-9 rounded-xl border border-[#e5d5c5] text-[#9a7060] cursor-pointer shrink-0"
            >
              ×
            </button>
          </div>

          <div className="space-y-1.5 pl-1">
            {group.options.map((opt, j) => (
              <div key={j} className="space-y-1">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => updateOption(i, j, { label: e.target.value })}
                    placeholder="Libellé (ex. Bacon)"
                    className="flex-1 h-8 px-2 rounded-lg border border-[#e5d5c5] text-xs"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={opt.price}
                    onChange={(e) => updateOption(i, j, { price: Number(e.target.value) })}
                    placeholder="Prix"
                    className="w-20 h-8 px-2 rounded-lg border border-[#e5d5c5] text-xs"
                  />
                  <label className="flex items-center gap-1 text-[10px] font-semibold text-[#9a7060] shrink-0">
                    <input
                      type="checkbox"
                      checked={!!opt.freeText}
                      onChange={(e) => updateOption(i, j, { freeText: e.target.checked })}
                    />
                    Texte libre
                  </label>
                  <button
                    type="button"
                    onClick={() => removeOption(i, j)}
                    className="w-7 h-7 rounded-lg border border-[#e5d5c5] text-[#9a7060] cursor-pointer shrink-0"
                  >
                    ×
                  </button>
                </div>
                {opt.freeText && (
                  <input
                    type="text"
                    value={opt.freeTextLabel || ""}
                    onChange={(e) => updateOption(i, j, { freeTextLabel: e.target.value })}
                    placeholder="Label du champ (ex. Cuisson souhaitée)"
                    className="w-full h-8 px-2 ml-0 rounded-lg border border-[#e5d5c5] text-xs"
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addOption(i)}
              className="h-7 px-2.5 rounded-lg border border-dashed border-[#e5d5c5] text-[11px] font-black text-[#9a7060] cursor-pointer"
            >
              + Option
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        className="h-9 px-3 rounded-xl border border-dashed border-[#e5d5c5] text-xs font-black text-[#9a7060] cursor-pointer"
      >
        + Groupe d&apos;extras
      </button>
    </div>
  );
}
