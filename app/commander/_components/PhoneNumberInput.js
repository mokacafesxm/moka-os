"use client";

import { useState } from "react";
import { COUNTRY_CODES, DEFAULT_COUNTRY_ISO } from "../_lib/phoneCountryCodes";

const DEFAULT_COUNTRY = COUNTRY_CODES.find((c) => c.iso === DEFAULT_COUNTRY_ISO);

// Composes a clean E.164 string (dial code + digits only, no spaces) from a
// country-code dropdown and a local-number field — the two are combined on
// every change so the parent always receives the exact string Twilio and
// Notion expect, regardless of how the customer formats their local number.
export default function PhoneNumberInput({ onChange, inputId = "phone-local", inputClassName, inputStyle }) {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [localNumber, setLocalNumber] = useState("");

  function emit(nextCountry, nextLocal) {
    const digitsOnly = nextLocal.replace(/\D/g, "");
    onChange(digitsOnly ? `${nextCountry.dialCode}${digitsOnly}` : "");
  }

  function handleCountryChange(e) {
    const next = COUNTRY_CODES.find((c) => c.iso === e.target.value) || DEFAULT_COUNTRY;
    setCountry(next);
    emit(next, localNumber);
  }

  function handleLocalChange(e) {
    setLocalNumber(e.target.value);
    emit(country, e.target.value);
  }

  return (
    <div className="flex gap-2">
      <label htmlFor="phone-country" className="sr-only">
        Indicatif
      </label>
      <select
        id="phone-country"
        value={country.iso}
        onChange={handleCountryChange}
        className="rounded-full border bg-white px-3 text-sm outline-none min-h-[44px] shrink-0 focus:ring-2 focus:ring-offset-2 focus:ring-[#587F25]"
        style={inputStyle}
        aria-label="Indicatif téléphonique"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag} {c.dialCode}
          </option>
        ))}
      </select>
      <label htmlFor={inputId} className="sr-only">
        Numéro de téléphone
      </label>
      <input
        id={inputId}
        required
        type="tel"
        inputMode="tel"
        placeholder="690 12 34 56"
        value={localNumber}
        onChange={handleLocalChange}
        className={`flex-1 min-w-0 ${inputClassName}`}
        style={inputStyle}
      />
    </div>
  );
}
