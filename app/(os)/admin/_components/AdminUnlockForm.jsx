"use client";

import { useState } from "react";
import { useAdminAuth } from "../_lib/AdminAuthProvider";

export default function AdminUnlockForm() {
  const { unlock, authFailed } = useAdminAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) return;
    unlock(username, password);
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4" style={{ background: "#f7efe4" }}>
      <form onSubmit={handleSubmit} className="w-full max-w-xs rounded-2xl border border-[#e5d5c5] bg-white p-6">
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Admin</div>
        <h1 className="text-lg font-black text-[#2c1a10] -mt-0.5 mb-4">Accès backoffice</h1>

        <div className="space-y-2.5">
          <input
            type="text"
            autoComplete="username"
            placeholder="Identifiant"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] text-sm text-[#2c1a10] outline-none focus:border-[#2c1a10]"
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-[#e5d5c5] text-sm text-[#2c1a10] outline-none focus:border-[#2c1a10]"
          />
        </div>

        {authFailed && (
          <div className="text-xs font-semibold text-red-700 mt-3">Identifiants invalides, réessaie.</div>
        )}

        <button
          type="submit"
          className="w-full h-11 mt-4 rounded-xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer"
        >
          Entrer
        </button>
      </form>
    </div>
  );
}
