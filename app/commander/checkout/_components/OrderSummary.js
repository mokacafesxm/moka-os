"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MOKA } from "../../_lib/theme";
import { formatPrice } from "../../_lib/variants";

export default function OrderSummary({ items, total }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3.5 min-h-[44px] cursor-pointer"
      >
        <span className="font-bold text-sm" style={{ color: MOKA.brown }}>
          Récapitulatif · {items.reduce((n, i) => n + i.qty, 0)} article{items.length > 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-black text-sm" style={{ color: MOKA.coral }}>
            {formatPrice(total)}
          </span>
          <ChevronDown
            className="w-4 h-4 transition-transform"
            style={{ color: MOKA.brownLight, transform: open ? "rotate(180deg)" : undefined }}
          />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: `${MOKA.brownLight}22` }}>
          {items.map((item) => (
            <div
              key={`${item.id}::${item.variant || ""}::${(item.extras || []).join("|")}`}
              className="flex items-center justify-between gap-3 pt-3 text-sm"
            >
              <div className="min-w-0">
                <div className="font-semibold truncate" style={{ color: MOKA.brown }}>
                  {item.qty}× {item.name}
                </div>
                {item.variant && (
                  <div className="text-xs truncate" style={{ color: MOKA.brownLight }}>
                    {item.variant}
                  </div>
                )}
                {item.extras?.length > 0 && (
                  <div className="text-xs truncate" style={{ color: MOKA.brownLight }}>
                    {item.extras.join(", ")}
                  </div>
                )}
              </div>
              <div className="font-semibold shrink-0" style={{ color: MOKA.brownLight }}>
                {formatPrice(item.price * item.qty)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
