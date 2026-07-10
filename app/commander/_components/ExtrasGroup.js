"use client";

import { MOKA } from "../_lib/theme";
import { formatPrice } from "../_lib/variants";

// One optional add-on group (e.g. "Sirop", "Choose Your Protein") — distinct
// from the mandatory Variantes segmented control: every option shows its own
// price delta, nothing is selected by default, and a "single" group can be
// cleared back to none by tapping the selected chip again. "multi" groups
// allow any number of independent selections. An option with `freeText: true`
// reveals a text input (not a closed list) once selected, for details a fixed
// list can't capture (e.g. how the customer wants their egg cooked).
export default function ExtrasGroup({ group, selected, freeText, onToggle, onFreeTextChange }) {
  const isSelected = (label) => (group.type === "multi" ? selected.includes(label) : selected === label);

  function handleClick(label) {
    onToggle(label, group.type);
  }

  return (
    <div className="mt-5">
      <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: MOKA.brownLight }}>
        {group.name} <span className="normal-case font-normal">(optionnel)</span>
      </div>
      <div className="flex flex-col gap-2">
        {group.options.map((option) => {
          const active = isSelected(option.label);
          return (
            <div key={option.label}>
              <button
                type="button"
                onClick={() => handleClick(option.label)}
                aria-pressed={active}
                className="w-full flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold cursor-pointer min-h-[44px] transition-colors"
                style={
                  active
                    ? { backgroundColor: MOKA.coral, color: "white" }
                    : { backgroundColor: "white", color: MOKA.brown, border: `1px solid ${MOKA.brownLight}33` }
                }
              >
                <span>{option.label}</span>
                <span className="shrink-0 ml-2" style={{ color: active ? "white" : MOKA.brownLight }}>
                  {option.price > 0 ? `+${formatPrice(option.price)}` : "Gratuit"}
                </span>
              </button>

              {option.freeText && active && (
                <input
                  type="text"
                  value={freeText[option.label] || ""}
                  onChange={(e) => onFreeTextChange(option.label, e.target.value)}
                  placeholder={option.freeTextLabel || "Précise ta demande"}
                  className="w-full mt-2 rounded-full border bg-white px-4 py-2.5 text-sm outline-none min-h-[40px] focus:ring-2 focus:ring-offset-2 focus:ring-[#587F25]"
                  style={{ borderColor: MOKA.brownLight, color: MOKA.brown }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
