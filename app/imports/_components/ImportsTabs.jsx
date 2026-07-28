"use client";

// 4 tabs sur ?type= — chacun son formulaire d'upload + historique du
// dernier import de ce type. Sans `type` du tout (accès legacy/CLI), on
// retombe sur l'ImportsClient existant (AddicTill export + scan-z),
// inchangé — cette page ne le remplace pas, elle ajoute une entrée dédiée
// pour la procédure de gestion quotidienne (voir ManagerHome).

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ImportsClient from "./ImportsClient";

const TABS = [
  { key: "daily", label: "📊 Quotidien" },
  { key: "weekly", label: "📈 Hebdo" },
  { key: "bank", label: "🏦 Bancaire" },
  { key: "inventory", label: "📦 Inventaire" },
];

function formatDate(dateStr) {
  if (!dateStr) return "jamais";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(dateStr));
}

function UploadCard({ title, description, accept, endpoint, buildResultView, onDone }) {
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!file) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setResult(data);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div>
        <div className="font-black text-sm">{title}</div>
        <div className="text-xs text-neutral-500">{description}</div>
      </div>

      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 py-8 px-4 cursor-pointer text-center dark:border-neutral-700 dark:bg-neutral-950">
        <span className="text-2xl">📄</span>
        <span className="text-sm font-bold">{file ? file.name : "Choisir un fichier"}</span>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(null); }}
        />
      </label>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-600">{error}</div>}
      {result && buildResultView(result)}

      <button
        type="button"
        onClick={submit}
        disabled={!file || sending}
        className="w-full h-11 rounded-xl bg-neutral-900 text-white text-sm font-black disabled:opacity-50 cursor-pointer dark:bg-white dark:text-neutral-900"
      >
        {sending ? "Import en cours…" : "Importer"}
      </button>
    </div>
  );
}

function LastImportBadge({ label, lastDate, extra }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <span className="text-neutral-500">{label} : </span>
      <span className="font-bold">{formatDate(lastDate)}</span>
      {extra}
    </div>
  );
}

function SummaryPanel({ type }) {
  const [lastDate, setLastDate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch(`/api/imports/summary?type=${type}`).then((r) => r.json()).then((d) => setLastDate(d.lastDate || null)).catch(() => {});
  }, [type, refreshKey]);

  const isDaily = type === "daily";

  return (
    <div className="space-y-3">
      <LastImportBadge label="Dernier import" lastDate={lastDate} />
      <UploadCard
        title={isDaily ? "📊 Synthèse Quotidienne AddicTill" : "📈 Palmarès Produits AddicTill"}
        description={
          isDaily
            ? "Export AddicTill \"Synthèse quotidienne\" (.xlsx) — met à jour le CA, tickets et TVA du jour dans MOKA_Sales_History."
            : "Export AddicTill \"Palmarès produits\" (.xlsx, feuilles Produits + Rubriques) — même import Excel que la synthèse, le type est détecté automatiquement selon le contenu du fichier."
        }
        accept=".xlsx"
        endpoint="/api/imports/summary"
        onDone={() => setRefreshKey((k) => k + 1)}
        buildResultView={(result) => (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-xs text-green-800 space-y-1 dark:bg-green-950 dark:border-green-900 dark:text-green-200">
            <div className="font-black">✅ Import réussi ({result.reportType === "daily_summary" ? "Synthèse quotidienne" : "Palmarès produits"})</div>
            {result.summary?.caTtc !== undefined && <div>CA TTC : {result.summary.caTtc?.toLocaleString("fr-FR")} €</div>}
            {result.summary?.nbTickets !== undefined && <div>Tickets : {result.summary.nbTickets}</div>}
            {result.summary?.produitStar && <div>Produit star : {result.summary.produitStar}</div>}
            {result.warnings?.length > 0 && <div className="text-amber-700 dark:text-amber-400">{result.warnings.length} avertissement(s)</div>}
          </div>
        )}
      />
    </div>
  );
}

function BankPanel() {
  const [info, setInfo] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/imports/bank").then((r) => r.json()).then(setInfo).catch(() => {});
  }, [refreshKey]);

  return (
    <div className="space-y-3">
      <LastImportBadge
        label="Dernier import"
        lastDate={info?.lastDate}
        extra={info?.solde !== null && info?.solde !== undefined ? ` · Solde : ${info.solde.toLocaleString("fr-FR")} €` : ""}
      />
      <UploadCard
        title="🏦 Relevé Crédit Mutuel"
        description="PDF ou Excel du relevé bancaire — un PDF est lu par Claude Vision (solde + transactions), un Excel par ses colonnes Date/Libellé/Montant. Les transactions sont ajoutées dans MOKA_Banque."
        accept=".pdf,.xlsx,image/*"
        endpoint="/api/imports/bank"
        onDone={() => setRefreshKey((k) => k + 1)}
        buildResultView={(result) => (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-xs text-green-800 space-y-1 dark:bg-green-950 dark:border-green-900 dark:text-green-200">
            <div className="font-black">✅ {result.transactionsImportees} transaction(s) importée(s)</div>
            {result.soldeFinal !== null && <div>Solde final relevé : {result.soldeFinal?.toLocaleString("fr-FR")} €</div>}
            {result.transactionsIgnorees > 0 && <div>{result.transactionsIgnorees} ligne(s) ignorée(s) (date/montant illisible)</div>}
          </div>
        )}
      />
    </div>
  );
}

function InventoryPanel() {
  return (
    <div className="space-y-3">
      <UploadCard
        title="📦 Importer inventaire"
        description="Excel/CSV avec colonnes Produit, Quantité réelle, Unité — comparé au stock théorique (stockLive), écarts et alertes affichés ci-dessous."
        accept=".xlsx,.csv"
        endpoint="/api/imports/inventory"
        buildResultView={(result) => (
          <div className="space-y-2">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:border-amber-900 dark:text-amber-200">
              <div className="font-black">{result.nbLignes} produit(s) comparé(s) · {result.nbAlertes} alerte(s) · {result.totalPertes.toLocaleString("fr-FR")} en perte cumulée</div>
            </div>
            <div className="rounded-xl border border-neutral-200 divide-y dark:border-neutral-800 dark:divide-neutral-800 max-h-80 overflow-y-auto">
              {result.ecarts.map((e, i) => (
                <div key={i} className={`p-2.5 text-xs flex items-center justify-between gap-2 ${e.alerte ? "bg-red-50 dark:bg-red-950" : ""}`}>
                  <div className="min-w-0">
                    <div className="font-bold truncate">{e.produit}</div>
                    <div className="text-neutral-500">
                      {e.introuvableEnStock ? "Introuvable dans le stock" : `Théorique ${e.quantiteTheorique} → Réel ${e.quantiteReelle} ${e.unite}`}
                    </div>
                  </div>
                  {e.ecart !== null && (
                    <span className={`font-black shrink-0 ${e.ecart < 0 ? "text-red-600" : "text-green-600"}`}>
                      {e.ecart > 0 ? "+" : ""}{e.ecart}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      />
    </div>
  );
}

export default function ImportsTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  if (!type) return <ImportsClient />;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => router.push(`/imports?type=${t.key}`)}
            className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer transition-colors ${
              type === t.key
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-white border border-neutral-200 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type === "daily" && <SummaryPanel type="daily" />}
      {type === "weekly" && <SummaryPanel type="weekly" />}
      {type === "bank" && <BankPanel />}
      {type === "inventory" && <InventoryPanel />}
      {!TABS.some((t) => t.key === type) && (
        <div className="text-sm text-neutral-500 text-center py-10">Type d&apos;import inconnu : {type}</div>
      )}
    </div>
  );
}
