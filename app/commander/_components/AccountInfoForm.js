"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { MOKA } from "../_lib/theme";
import { useCustomer } from "../_lib/CustomerContext";

const inputClass =
  "w-full rounded-2xl border bg-white px-4 py-3 text-sm outline-none min-h-[44px] focus:ring-2 focus:ring-offset-2 focus:ring-[#587F25]";
const inputStyle = { borderColor: MOKA.brownLight, color: MOKA.brown };
const labelClass = "block text-xs font-bold uppercase tracking-wide mb-1.5";

export default function AccountInfoForm({ onBack }) {
  const { signIn } = useCustomer();
  const [form, setForm] = useState(null); // null while loading
  const [telephone, setTelephone] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/profile")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || data.error) return;
        setForm({ prenom: data.prenom || "", nom: data.nom || "", email: data.email || "" });
        setTelephone(data.telephone || "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.prenom.trim()) {
      setError("Le prénom est requis.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Impossible d'enregistrer.");
        return;
      }
      // Keep the header greeting in sync with the (possibly changed) prénom.
      signIn(data.prenom, telephone);
      setNotice("Informations enregistrées.");
    } catch {
      setError("Impossible de contacter le serveur, réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 pt-4 pb-12">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold mb-4 cursor-pointer -ml-1" style={{ color: MOKA.brown }}>
        <ChevronLeft className="w-4 h-4" />
        Retour
      </button>
      <h2 className="text-lg font-black mb-4" style={{ color: MOKA.brown }}>
        Mes informations
      </h2>

      {form === null ? (
        <p className="text-sm" style={{ color: MOKA.brownLight }}>
          Chargement…
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="info-prenom" className={labelClass} style={{ color: MOKA.brownLight }}>
              Prénom
            </label>
            <input
              id="info-prenom"
              required
              value={form.prenom}
              onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="info-nom" className={labelClass} style={{ color: MOKA.brownLight }}>
              Nom
            </label>
            <input
              id="info-nom"
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="info-email" className={labelClass} style={{ color: MOKA.brownLight }}>
              Email <span className="font-normal lowercase">(facultatif)</span>
            </label>
            <input
              id="info-email"
              type="email"
              placeholder="vous@exemple.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="info-tel" className={labelClass} style={{ color: MOKA.brownLight }}>
              Téléphone
            </label>
            <input
              id="info-tel"
              value={telephone}
              readOnly
              className={`${inputClass} cursor-not-allowed`}
              style={{ ...inputStyle, backgroundColor: MOKA.placeholderTan, color: MOKA.brownLight }}
            />
            <p className="text-xs mt-1.5" style={{ color: MOKA.brownLight }}>
              Le téléphone est ton identifiant de connexion et ne peut pas être modifié ici.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold" style={{ color: "#8C2F2F" }}>
              {error}
            </p>
          )}
          {notice && (
            <p className="text-sm font-semibold" style={{ color: MOKA.green }}>
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className={`w-full py-3.5 rounded-full font-bold text-white flex items-center justify-center min-h-[44px] ${
              saving ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            }`}
            style={{ backgroundColor: MOKA.coral }}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      )}
    </div>
  );
}
