"use client";

import { useState } from "react";
import { User, Bell, ChevronRight } from "lucide-react";
import { MOKA } from "../_lib/theme";

// No real auth backend yet — this is a visual mock (mirrors how the location
// selector was built ahead of real multi-restaurant support). Submitting the
// form just flips to a "connected" state locally.
export default function AccountView() {
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [form, setForm] = useState({ prenom: "", email: "", password: "" });

  function handleSubmit(e) {
    e.preventDefault();
    setName(form.prenom.trim() || "MÖKA");
    setConnected(true);
  }

  const inputClass =
    "w-full rounded-full border bg-white px-5 py-3.5 text-sm outline-none min-h-[44px] focus:ring-2 focus:ring-offset-2 focus:ring-[#587F25]";
  const inputStyle = { borderColor: MOKA.brownLight, color: MOKA.brown };

  return (
    <div className="px-4 pt-4 pb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: MOKA.brown }}
          >
            {connected ? (
              <span className="text-white font-bold">{name.slice(0, 1).toUpperCase()}</span>
            ) : (
              <User className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-black truncate" style={{ color: MOKA.brown }}>
              {connected ? `Bonjour, ${name}` : "Bonjour"}
            </div>
            <div className="text-xs truncate" style={{ color: MOKA.brownLight }}>
              {connected ? "Ravi de vous revoir" : "Connectez-vous pour continuer"}
            </div>
          </div>
        </div>
        <button
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-white shadow-sm cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" style={{ color: MOKA.brown }} />
        </button>
      </div>

      {connected ? (
        <div className="space-y-2">
          {["Mes commandes", "Mes informations", "Favoris"].map((label) => (
            <button
              key={label}
              className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3.5 min-h-[44px] text-left font-semibold cursor-pointer"
              style={{ color: MOKA.brown }}
            >
              {label}
              <ChevronRight className="w-4 h-4" style={{ color: MOKA.brownLight }} />
            </button>
          ))}
          <button
            onClick={() => setConnected(false)}
            className="w-full mt-4 py-3.5 rounded-full font-bold cursor-pointer min-h-[44px]"
            style={{ color: MOKA.coral, backgroundColor: "white" }}
          >
            Se déconnecter
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder="Prénom"
            value={form.prenom}
            onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
          <input
            required
            type="password"
            placeholder="Mot de passe"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
          <button
            type="submit"
            className="w-full py-3.5 rounded-full font-bold text-white cursor-pointer min-h-[44px]"
            style={{ backgroundColor: MOKA.coral }}
          >
            Se connecter
          </button>
          <p className="text-center text-xs pt-1" style={{ color: MOKA.brownLight }}>
            Pas de compte ?{" "}
            <span className="underline font-semibold" style={{ color: MOKA.brown }}>
              Créer un compte
            </span>
          </p>
        </form>
      )}
    </div>
  );
}
