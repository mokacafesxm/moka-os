"use client";

import { CheckCircle2 } from "lucide-react";
import { MOKA } from "../../_lib/theme";

export default function SuccessStep({ orderCode, slotLabel, onDone }) {
  return (
    <div className="px-6 py-16 flex flex-col items-center text-center">
      <CheckCircle2 className="w-16 h-16 mb-4" style={{ color: MOKA.green }} strokeWidth={1.5} />
      <p className="text-sm font-semibold" style={{ color: MOKA.brownLight }}>
        Merci ! Votre commande a été envoyée à l&apos;équipe MÖKA.
      </p>
      <p className="text-3xl font-black mt-3 tracking-wide" style={{ color: MOKA.brown }}>
        {orderCode}
      </p>
      <p className="text-sm mt-1" style={{ color: MOKA.brownLight }}>
        Retrait : {slotLabel}
      </p>
      <button
        onClick={onDone}
        className="mt-8 px-8 py-3.5 rounded-full font-bold text-white cursor-pointer min-h-[44px]"
        style={{ backgroundColor: MOKA.coral }}
      >
        Retour au menu
      </button>
    </div>
  );
}
