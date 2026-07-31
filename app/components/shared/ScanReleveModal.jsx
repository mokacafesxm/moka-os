"use client";

// Scan relevé bancaire — extraction + revue avant écriture dans
// MOKA_Banque. Totalement indépendant du Stock et du scan facture
// fournisseur (voir FactureScanModal) : trois flux qui ne se touchent pas.

import { useMemo, useState } from "react";

const CATEGORIES = ["Fournisseur", "Salaires", "Charges", "Recettes", "Autre"];
const CATEGORIE_COLOR = {
  Fournisseur: "bg-orange-50 text-orange-700",
  Salaires: "bg-blue-50 text-blue-700",
  Charges: "bg-red-50 text-red-700",
  Recettes: "bg-green-50 text-green-700",
  Autre: "bg-[#f0e8dc] text-[#9a7060]",
};

function formatEuros(value) {
  return `${(Number(value) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const inputClass = "w-full h-10 px-3 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]";

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ChoiceStep({ onFile, onClose }) {
  return (
    <div className="space-y-2">
      <label className="w-full h-12 rounded-2xl bg-[#2c1a10] text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all">
        📷 Photographier le relevé
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      </label>
      <label className="w-full h-12 rounded-2xl border border-[#e5d5c5] bg-white text-[#2c1a10] font-black text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-all">
        📁 Uploader PDF ou image
        <input type="file" accept=".pdf,image/*" className="hidden" onChange={onFile} />
      </label>
      <button type="button" onClick={onClose} className="w-full h-11 text-[#9a7060] font-bold text-sm cursor-pointer">
        Annuler
      </button>
    </div>
  );
}

function TransactionRow({ t, onChange, onRemove }) {
  const set = (k) => (e) => onChange({ ...t, [k]: e.target.value });
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input value={t.libelle} onChange={set("libelle")} className={`${inputClass} flex-1`} placeholder="Libellé" />
        <button type="button" onClick={onRemove} className="w-8 h-8 shrink-0 rounded-lg bg-red-50 text-red-600 font-black text-sm cursor-pointer">×</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="date" value={t.date || ""} onChange={set("date")} className={inputClass} />
        <input type="number" value={t.montant ?? ""} onChange={set("montant")} className={inputClass} placeholder="Montant" />
        <select value={t.type || "crédit"} onChange={set("type")} className={inputClass}>
          <option value="crédit">Crédit</option>
          <option value="débit">Débit</option>
        </select>
      </div>
      <select value={t.categorie || "Autre"} onChange={set("categorie")} className={`${inputClass} ${CATEGORIE_COLOR[t.categorie] || ""}`}>
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}

export default function ScanReleveModal({ onClose, onSaved }) {
  const [step, setStep] = useState("choice"); // choice | loading | review | saving
  const [error, setError] = useState(null);
  const [banque, setBanque] = useState("");
  const [compte, setCompte] = useState("");
  const [periode, setPeriode] = useState({ debut: "", fin: "" });
  const [soldeInitial, setSoldeInitial] = useState(null);
  const [soldeFinal, setSoldeFinal] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categorieFilter, setCategorieFilter] = useState("Toutes");

  const totalCredits = useMemo(
    () => transactions.filter((t) => t.type === "crédit").reduce((s, t) => s + (Number(t.montant) || 0), 0),
    [transactions]
  );
  const totalDebits = useMemo(
    () => transactions.filter((t) => t.type === "débit").reduce((s, t) => s + (Number(t.montant) || 0), 0),
    [transactions]
  );
  const filteredTransactions = useMemo(
    () => (categorieFilter === "Toutes" ? transactions : transactions.filter((t) => (t.categorie || "Autre") === categorieFilter)),
    [transactions, categorieFilter]
  );

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep("loading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/scan-releve", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || `Erreur ${res.status}`);

      setBanque(data.banque || "");
      setCompte(data.compte || "");
      setPeriode({ debut: data.periode?.debut || "", fin: data.periode?.fin || "" });
      setSoldeInitial(data.solde_initial ?? null);
      setSoldeFinal(data.solde_final ?? null);
      setTransactions(
        Array.isArray(data.transactions)
          ? data.transactions.map((t) => ({
              date: t.date || "",
              libelle: t.libelle || "",
              montant: Math.abs(Number(t.montant) || 0),
              type: t.type === "débit" ? "débit" : "crédit",
              categorie: t.categorie || "Autre",
            }))
          : []
      );
      setStep("review");
    } catch (err) {
      setError(err.message);
      setStep("choice");
    }
  };

  const updateTransaction = (i, next) => setTransactions((list) => list.map((t, idx) => (idx === i ? next : t)));
  const removeTransaction = (i) => setTransactions((list) => list.filter((_, idx) => idx !== i));

  const save = async () => {
    const valid = transactions.filter((t) => t.date && String(t.libelle || "").trim());
    if (valid.length === 0) { setError("Aucune transaction à enregistrer"); return; }
    setStep("saving");
    setError(null);
    try {
      const periodeStr = periode.debut && periode.fin ? `${periode.debut.slice(0, 7)} / ${periode.fin.slice(0, 7)}` : "";
      const res = await fetch("/api/banque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: valid, banque, compte, periode: periodeStr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      onSaved?.();
    } catch (err) {
      setError(err.message);
      setStep("review");
    }
  };

  return (
    <ModalShell title="🏦 Scanner un relevé bancaire" onClose={onClose}>
      {error && <div className="text-xs font-bold text-red-600 -mt-1">{error}</div>}

      {step === "choice" && <ChoiceStep onFile={handleFile} onClose={onClose} />}

      {(step === "loading" || step === "saving") && (
        <div className="py-10 text-center">
          <div className="text-sm font-bold text-[#9a7060]">
            {step === "loading" ? "Lecture du relevé…" : "Enregistrement…"}
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Banque</label>
              <input value={banque} onChange={(e) => setBanque(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">Compte</label>
              <input value={compte} onChange={(e) => setCompte(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-[#e5d5c5] p-3.5 grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-[#9a7060]">Période</span><div className="font-bold text-[#2c1a10]">{periode.debut || "?"} → {periode.fin || "?"}</div></div>
            <div><span className="text-[#9a7060]">Solde</span><div className="font-bold text-[#2c1a10]">{soldeInitial != null ? formatEuros(soldeInitial) : "—"} → {soldeFinal != null ? formatEuros(soldeFinal) : "—"}</div></div>
            <div><span className="text-[#9a7060]">Total crédits</span><div className="font-black text-[#5a7828]">{formatEuros(totalCredits)}</div></div>
            <div><span className="text-[#9a7060]">Total débits</span><div className="font-black text-red-700">{formatEuros(totalDebits)}</div></div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {["Toutes", ...CATEGORIES].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategorieFilter(c)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap ${
                  categorieFilter === c ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-sm text-[#9a7060] py-4 text-center">Aucune transaction</div>
          ) : (
            <div className="space-y-2">
              {transactions.map((t, i) => {
                if (categorieFilter !== "Toutes" && (t.categorie || "Autre") !== categorieFilter) return null;
                return <TransactionRow key={i} t={t} onChange={(next) => updateTransaction(i, next)} onRemove={() => removeTransaction(i)} />;
              })}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl text-[#9a7060] font-bold text-sm cursor-pointer">
              Annuler
            </button>
            <button type="button" onClick={save} className="flex-1 h-11 rounded-xl bg-[#5a7828] text-white font-black text-sm cursor-pointer">
              ✅ Enregistrer dans MÖKA OS
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
