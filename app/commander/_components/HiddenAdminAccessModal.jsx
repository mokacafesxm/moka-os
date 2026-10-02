"use client";

import { useState } from "react";
import { MOKA } from "../_lib/theme";

// No label, no "Admin" wording anywhere in here on purpose — if a curious
// customer ever triggers this by accident, an unlabeled masked field gives
// away nothing about what it is or what it's for.
export default function HiddenAdminAccessModal({ onClose }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.href = data.redirectUrl;
        return;
      }
      setError(data.error || "Code incorrect.");
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
      setPin("");
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-3xl p-6"
        style={{ backgroundColor: MOKA.cream }}
      >
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full h-12 px-4 rounded-xl border text-center text-lg tracking-[0.5em] outline-none bg-white"
          style={{ borderColor: MOKA.brownLight, color: MOKA.brown }}
        />
        {error && (
          <div className="text-xs font-semibold text-center mt-2" style={{ color: MOKA.coral }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !pin}
          className="w-full h-11 mt-4 rounded-xl text-white text-sm font-bold cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: MOKA.brown }}
        >
          {loading ? "…" : "Valider"}
        </button>
      </form>
    </div>
  );
}
