"use client";

import { useEffect, useState } from "react";
import PreviewPanel from "./PreviewPanel";
import ScanZPanel from "./ScanZPanel";
import { parseJsonResponse } from "../../../lib/http/safe-json";

// The file is never persisted server-side (see docs/ARCHITECTURE.md "PR4"
// "Stateless upload flow") — it's kept only in this component's state and
// resubmitted with each call (preflight, then commit), exactly like the
// CLI resubmits the same file path to both steps.

async function postFile(url, { file, establishmentKey }) {
  const formData = new FormData();
  formData.append("file", file);
  if (establishmentKey) formData.append("establishmentKey", establishmentKey);

  const response = await fetch(url, { method: "POST", body: formData });
  const body = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(body.error || `Erreur ${response.status}`);
  }
  return body;
}

export default function ImportsClient() {
  const [establishments, setEstablishments] = useState([]);
  const [establishmentKey, setEstablishmentKey] = useState("");
  const [mode, setMode] = useState("file"); // "file" (AddicTill/bank) | "scanz" (secondary source)
  const [file, setFile] = useState(null);
  const [preflight, setPreflight] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [loadingPreflight, setLoadingPreflight] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/imports/establishments")
      .then((res) => res.json())
      .then((data) => setEstablishments(data.establishments || []))
      .catch(() => setError("Impossible de charger la liste des établissements."));
  }, []);

  function resetForNewFile(nextFile) {
    setFile(nextFile);
    setPreflight(null);
    setCommitResult(null);
    setError(null);
  }

  async function handlePreflight() {
    if (!file) return;
    setLoadingPreflight(true);
    setError(null);
    setCommitResult(null);
    try {
      const result = await postFile("/api/imports/preflight", { file, establishmentKey });
      setPreflight(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPreflight(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setCommitting(true);
    setError(null);
    try {
      const result = await postFile("/api/imports/commit", { file, establishmentKey });
      setCommitResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  }

  const canCommit = preflight?.can_commit && !commitResult?.committed;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-xl font-semibold">Imports — MÖKA OS</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Relevés bancaires (Crédit Mutuel) et exports de caisse (AddicTill) vers Notion, avec en complément une
        source secondaire par photo (scan-z, jamais prioritaire sur AddicTill). Rien n&apos;est écrit sans
        confirmation explicite.
      </p>

      <div className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          Établissement
          <select
            className="mt-1 block w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            value={establishmentKey}
            onChange={(e) => setEstablishmentKey(e.target.value)}
          >
            <option value="">Sélectionner…</option>
            {establishments.map((e) => (
              <option key={e.key} value={e.key}>
                {e.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-1 border-b border-neutral-200 text-sm dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`px-3 py-2 ${mode === "file" ? "border-b-2 border-neutral-900 font-medium dark:border-neutral-100" : "text-neutral-500"}`}
          >
            Fichier (AddicTill / relevé bancaire)
          </button>
          <button
            type="button"
            onClick={() => setMode("scanz")}
            className={`px-3 py-2 ${mode === "scanz" ? "border-b-2 border-neutral-900 font-medium dark:border-neutral-100" : "text-neutral-500"}`}
          >
            Photo Z (scan-z)
          </button>
        </div>

        {mode === "file" && (
          <>
            <label className="block text-sm font-medium">
              Fichier (PDF, XLSX ou CSV)
              <input
                type="file"
                accept=".pdf,.xlsx,.csv"
                className="mt-1 block w-full text-sm"
                onChange={(e) => resetForNewFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreflight}
                disabled={!file || loadingPreflight}
                className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {loadingPreflight ? "Analyse…" : "Analyser (aperçu)"}
              </button>

              {preflight && (
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={!canCommit || committing}
                  className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {committing ? "Import…" : "Confirmer l'import"}
                </button>
              )}
            </div>
          </>
        )}

        {error && (
          <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}
      </div>

      {mode === "file" && <PreviewPanel preflight={preflight} commitResult={commitResult} />}
      {mode === "scanz" && <ScanZPanel establishmentKey={establishmentKey} establishments={establishments} />}
    </main>
  );
}
