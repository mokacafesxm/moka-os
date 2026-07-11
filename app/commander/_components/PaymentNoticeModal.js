"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useModalA11y } from "../_lib/useModalA11y";

const SESSION_KEY = "moka-payment-notice-shown";

// Temporary banner while the Stripe Live switchover is finalized. Purely
// gated by a flag passed down from the server (env var PAYMENT_UNAVAILABLE_NOTICE
// read in app/commander/page.js) so it can be turned off from Vercel alone,
// no redeploy-of-logic needed — just flip the env var and redeploy.
export default function PaymentNoticeModal({ enabled }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setOpen(true);
  }, [enabled]);

  function close() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  }

  const dialogRef = useModalA11y(close, open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-notice-title"
        tabIndex={-1}
        className="relative w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 animate-sheet-up outline-none"
        style={{ backgroundColor: MOKA.cream }}
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: MOKA.placeholderTan }}
        >
          <AlertCircle className="w-5 h-5" style={{ color: MOKA.coral }} />
        </div>

        <h2 id="payment-notice-title" className="text-lg font-black mb-2" style={{ color: MOKA.brown }}>
          Paiement momentanément indisponible
        </h2>

        <p className="text-sm leading-relaxed mb-6" style={{ color: MOKA.brownLight }}>
          Nous sommes désolés, le paiement est momentanément indisponible sur le site. Mais les
          récompenses sont valables en boutique.
        </p>

        <button
          onClick={close}
          className="w-full py-3.5 rounded-2xl font-bold text-white cursor-pointer min-h-[44px]"
          style={{ backgroundColor: MOKA.coral }}
        >
          Continuer
        </button>
      </div>
    </div>
  );
}
