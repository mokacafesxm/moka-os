"use client";

// 4 tabs sur ?type= — chacun son formulaire d'upload + historique du
// dernier import de ce type. Sans `type` du tout (accès legacy/CLI), on
// retombe sur l'ImportsClient existant (AddicTill export + scan-z),
// inchangé — cette page ne le remplace pas, elle ajoute une entrée dédiée
// pour la procédure de gestion quotidienne (voir ManagerHome).
//
// Refonte mobile (31 jul 2026, retour iPhone) : cette page était restée sur
// le style neutral-gray/dark-mode générique de l'échafaudage initial —
// jamais alignée sur la palette MÖKA (#f7efe4/#2c1a10/#e5d5c5) et le pattern
// pill-nav déjà en place partout ailleurs dans (os) (stock, recettes,
// commandes). Reprise complète : onglets pill scrollables au lieu d'une
// grille qui ne tient pas sur iPhone, dropzone géante remplacée par un
// bouton compact + aperçu une ligne, erreur avec actions concrètes, bouton
// Importer sticky bottom (safe-area), palette MÖKA.

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ImportsClient from "./ImportsClient";
import { parseJsonResponse } from "../../../lib/http/safe-json";

const TABS = [
  { key: "daily", label: "Quotidien", emoji: "📊" },
  { key: "weekly", label: "Hebdo", emoji: "📈" },
  { key: "bank", label: "Bancaire", emoji: "🏦" },
  { key: "inventory", label: "Inventaire", emoji: "📦" },
];

function formatDate(dateStr) {
  if (!dateStr) return "jamais";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(dateStr));
}

// État d'upload partagé par les 3 panneaux (Quotidien/Hebdo partagent déjà
// le même SummaryPanel, Bancaire et Inventaire ont chacun le leur) — extrait
// pour que le bouton "Importer" puisse vivre en dehors de la carte de choix
// de fichier, en barre sticky bottom, tout en gardant accès à file/sending.
function useUploadFlow(endpoint, onDone) {
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const pickFile = (f) => {
    setFile(f);
    setResult(null);
    setError(null);
  };

  const submit = async () => {
    if (!file) return;
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setResult(data);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return { file, pickFile, sending, result, error, submit };
}

function FilePickerRow({ title, description, accept, file, onPick }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4 space-y-3">
      <div>
        <div className="font-black text-sm text-[#2c1a10]">{title}</div>
        <div className="text-xs text-[#9a7060] mt-0.5">{description}</div>
      </div>

      <label className="flex items-center gap-3 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 h-12 cursor-pointer active:scale-[0.99] transition-all">
        <span className="text-lg shrink-0">📄</span>
        <span className="text-sm font-black text-[#2c1a10] shrink-0">Choisir un fichier</span>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />
      </label>

      {file && (
        <div className="flex items-center gap-2 rounded-xl bg-[#f0f7e5] px-3.5 py-2.5">
          <span className="text-sm shrink-0">✅</span>
          <span className="text-xs font-bold text-[#5a7828] truncate">{file.name}</span>
        </div>
      )}
    </div>
  );
}

// Erreur avec actions concrètes plutôt qu'un texte brut sans suite —
// "Réessayer" relance le même fichier, "Signaler ce fichier" pré-remplit un
// mail (pas de backend de signalement dédié, un mailto reste l'action la
// plus honnête à ce stade plutôt qu'un bouton qui ne ferait rien).
function ErrorBanner({ message, fileName, onRetry }) {
  const reportHref = `mailto:mokacafe.sxm@gmail.com?subject=${encodeURIComponent(
    `Échec import — ${fileName || "fichier"}`
  )}&body=${encodeURIComponent(`Fichier : ${fileName || "?"}\nErreur : ${message}`)}`;

  return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 space-y-2.5">
      <div className="text-xs font-bold text-red-700">{message}</div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 h-9 rounded-lg bg-white border border-red-200 text-red-700 text-xs font-black cursor-pointer"
        >
          Réessayer
        </button>
        <a
          href={reportHref}
          className="flex-1 h-9 rounded-lg bg-white border border-red-200 text-red-700 text-xs font-black cursor-pointer flex items-center justify-center"
        >
          Signaler ce fichier
        </a>
      </div>
    </div>
  );
}

function LastImportBadge({ label, lastDate, extra }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-[#faf5ef] p-3.5 text-sm">
      <span className="text-[#9a7060]">{label} : </span>
      <span className="font-bold text-[#2c1a10]">{formatDate(lastDate)}</span>
      {extra}
    </div>
  );
}

// Barre du bouton "Importer" — sticky bottom + safe-area, cohérent avec le
// pattern déjà utilisé par ReceiveModal ailleurs dans MOKA OS.
function StickyImportBar({ disabled, sending, onSubmit }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5d5c5] bg-[#f7efe4]/95 backdrop-blur px-4 pt-3"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-2xl mx-auto">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || sending}
          className="w-full h-12 rounded-2xl bg-[#2c1a10] text-white text-sm font-black disabled:opacity-40 cursor-pointer active:scale-[0.98] transition-all"
        >
          {sending ? "Import en cours…" : "Importer"}
        </button>
      </div>
    </div>
  );
}

function SummaryPanel({ type }) {
  const [lastDate, setLastDate] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const flow = useUploadFlow("/api/imports/summary", () => setRefreshKey((k) => k + 1));
  const isDaily = type === "daily";

  useEffect(() => {
    fetch(`/api/imports/summary?type=${type}`).then((r) => r.json()).then((d) => setLastDate(d.lastDate || null)).catch(() => {});
  }, [type, refreshKey]);

  return (
    <>
      <div className="space-y-3">
        <LastImportBadge label="Dernier import" lastDate={lastDate} />
        <FilePickerRow
          title={isDaily ? "📊 Synthèse Quotidienne AddicTill" : "📈 Palmarès Produits AddicTill"}
          description={
            isDaily
              ? "Export AddicTill \"Synthèse quotidienne\" (.xlsx) — met à jour le CA, tickets et TVA du jour dans MOKA_Sales_History."
              : "Export AddicTill \"Palmarès produits\" (.xlsx, feuilles Produits + Rubriques) — même import Excel que la synthèse, le type est détecté automatiquement selon le contenu du fichier."
          }
          accept=".xlsx"
          file={flow.file}
          onPick={flow.pickFile}
        />
        {flow.error && <ErrorBanner message={flow.error} fileName={flow.file?.name} onRetry={flow.submit} />}
        {flow.result && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-xs text-green-800 space-y-1">
            <div className="font-black">✅ Import réussi ({flow.result.reportType === "daily_summary" ? "Synthèse quotidienne" : "Palmarès produits"})</div>
            {flow.result.summary?.caTtc !== undefined && <div>CA TTC : {flow.result.summary.caTtc?.toLocaleString("fr-FR")} €</div>}
            {flow.result.summary?.nbTickets !== undefined && <div>Tickets : {flow.result.summary.nbTickets}</div>}
            {flow.result.summary?.produitStar && <div>Produit star : {flow.result.summary.produitStar}</div>}
            {flow.result.warnings?.length > 0 && <div className="text-amber-700">{flow.result.warnings.length} avertissement(s)</div>}
          </div>
        )}
      </div>
      <StickyImportBar disabled={!flow.file} sending={flow.sending} onSubmit={flow.submit} />
    </>
  );
}

function BankPanel() {
  const [info, setInfo] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const flow = useUploadFlow("/api/imports/bank", () => setRefreshKey((k) => k + 1));

  useEffect(() => {
    fetch("/api/imports/bank").then((r) => r.json()).then(setInfo).catch(() => {});
  }, [refreshKey]);

  return (
    <>
      <div className="space-y-3">
        <LastImportBadge
          label="Dernier import"
          lastDate={info?.lastDate}
          extra={info?.solde !== null && info?.solde !== undefined ? ` · Solde : ${info.solde.toLocaleString("fr-FR")} €` : ""}
        />
        <FilePickerRow
          title="🏦 Relevé Crédit Mutuel"
          description="PDF ou Excel du relevé bancaire — un PDF est lu par Claude Vision (solde + transactions), un Excel par ses colonnes Date/Libellé/Montant. Les transactions sont ajoutées dans MOKA_Banque."
          accept=".pdf,.xlsx,image/*"
          file={flow.file}
          onPick={flow.pickFile}
        />
        {flow.error && <ErrorBanner message={flow.error} fileName={flow.file?.name} onRetry={flow.submit} />}
        {flow.result && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-xs text-green-800 space-y-1">
            <div className="font-black">✅ {flow.result.transactionsImportees} transaction(s) importée(s)</div>
            {flow.result.soldeFinal !== null && <div>Solde final relevé : {flow.result.soldeFinal?.toLocaleString("fr-FR")} €</div>}
            {flow.result.transactionsIgnorees > 0 && <div>{flow.result.transactionsIgnorees} ligne(s) ignorée(s) (date/montant illisible)</div>}
          </div>
        )}
      </div>
      <StickyImportBar disabled={!flow.file} sending={flow.sending} onSubmit={flow.submit} />
    </>
  );
}

function InventoryPanel() {
  const flow = useUploadFlow("/api/imports/inventory");

  return (
    <>
      <div className="space-y-3">
        <FilePickerRow
          title="📦 Importer inventaire"
          description="Excel/CSV avec colonnes Produit, Quantité réelle, Unité — comparé au stock théorique (stockLive), écarts et alertes affichés ci-dessous."
          accept=".xlsx,.csv"
          file={flow.file}
          onPick={flow.pickFile}
        />
        {flow.error && <ErrorBanner message={flow.error} fileName={flow.file?.name} onRetry={flow.submit} />}
        {flow.result && (
          <div className="space-y-2">
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <div className="font-black">{flow.result.nbLignes} produit(s) comparé(s) · {flow.result.nbAlertes} alerte(s) · {flow.result.totalPertes.toLocaleString("fr-FR")} en perte cumulée</div>
            </div>
            <div className="rounded-xl border border-[#e5d5c5] divide-y divide-[#e5d5c5] max-h-80 overflow-y-auto">
              {flow.result.ecarts.map((e, i) => (
                <div key={i} className={`p-2.5 text-xs flex items-center justify-between gap-2 ${e.alerte ? "bg-red-50" : ""}`}>
                  <div className="min-w-0">
                    <div className="font-bold text-[#2c1a10] truncate">{e.produit}</div>
                    <div className="text-[#9a7060]">
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
      </div>
      <StickyImportBar disabled={!flow.file} sending={flow.sending} onSubmit={flow.submit} />
    </>
  );
}

export default function ImportsTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  if (!type) return <ImportsClient />;

  return (
    <div className="min-h-dvh" style={{ background: "#f7efe4" }}>
      <div
        className="max-w-2xl mx-auto p-4 space-y-4"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top))", paddingBottom: "104px" }}
      >
        <h1 className="text-lg font-black text-[#2c1a10]">📥 Import de données</h1>

        <div className="bg-white/70 rounded-2xl p-1.5 border border-[#e5d5c5]">
          <div className="flex gap-1.5 overflow-x-auto flex-nowrap snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const active = type === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => router.push(`/imports?type=${t.key}`)}
                  className={`shrink-0 snap-start flex items-center gap-1.5 h-10 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer transition-all ${
                    active ? "px-4 bg-[#2c1a10] text-white" : "px-3 text-[#6b4a3d]"
                  }`}
                >
                  <span>{t.emoji}</span>
                  {active && <span>{t.label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {type === "daily" && <SummaryPanel type="daily" />}
        {type === "weekly" && <SummaryPanel type="weekly" />}
        {type === "bank" && <BankPanel />}
        {type === "inventory" && <InventoryPanel />}
        {!TABS.some((t) => t.key === type) && (
          <div className="text-sm text-[#9a7060] text-center py-10">Type d&apos;import inconnu : {type}</div>
        )}
      </div>
    </div>
  );
}
