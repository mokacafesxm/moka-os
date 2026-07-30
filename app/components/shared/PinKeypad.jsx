"use client";

import { useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "←"];

// Clavier numérique visuel — remplace PinDigits (boîtes + clavier système)
// partout où un staff saisit un PIN à 4 chiffres : SplashScreen (vérif à la
// connexion) et /profil (création/modification). Gère son propre état ;
// le parent force un reset en changeant `key` sur l'instance (même pattern
// que PinDigits avant lui).
export default function PinKeypad({ onComplete, disabled }) {
  const [digits, setDigits] = useState([]);

  const press = (key) => {
    if (disabled) return;
    if (key === "←") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    if (key === "*") return; // touche de remplissage, sans fonction
    if (digits.length >= 4) return;
    const next = [...digits, key];
    setDigits(next);
    if (next.length === 4) onComplete(next.join(""));
  };

  return (
    <div style={{ background: "#f7efe4" }} className="rounded-2xl p-4">
      <div className="flex items-center justify-center gap-3 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="w-3 h-3 rounded-full"
            style={{ background: i < digits.length ? "#2c1a10" : "#e5d5c5" }}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 justify-items-center">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => press(key)}
            className="w-16 h-16 rounded-2xl bg-white border border-[#e5d5c5] text-xl font-black text-[#2c1a10] cursor-pointer disabled:opacity-50 active:scale-[0.95] transition-transform"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
