"use client";

import { useRef } from "react";

// 4-box numeric PIN input, auto-advance to the next box on entry, back on
// Backspace — shared by PinSetupModal (create/confirm) and PinEntryModal
// (splash re-login).
export default function PinDigits({ digits, onChange, autoFocusFirst, disabled }) {
  const inputRefs = useRef([]);

  const handleChange = (index, rawValue) => {
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    onChange(next);
    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex gap-3 justify-center">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocusFirst && i === 0}
          value={digits[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-14 h-14 rounded-xl border border-[#e5d5c5] bg-white text-center text-2xl font-black text-[#2c1a10] outline-none focus:border-[#5a7828] disabled:opacity-50"
        />
      ))}
    </div>
  );
}
