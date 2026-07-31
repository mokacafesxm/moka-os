"use client";

// scan-z secondary source (spec v3) — a photographed Z-report, OCR'd via
// Claude vision, treated as a fallback/reconciliation source only, never
// authoritative over AddicTill/L'Addition. The image is never persisted
// server-side; the signed preflightToken (not the raw OCR values
// themselves) is what gets resubmitted at commit — see
// docs/ARCHITECTURE.md "scan-z secondary source" §0.

import { useState } from "react";
import { parseJsonResponse } from "../../../lib/http/safe-json";

const BLOCKING_REASON_LABELS = {
  SCANZ_DISABLED: "La source scan-z n'est pas activée sur ce serveur (IMPORTS_SCANZ_ENABLED).",
  VALIDATION_ERRORS: "Date, total TTC, ou nombre de tickets illisible ou invalide sur la photo.",
  UNKNOWN_ESTABLISHMENT: "Établissement manquant ou inconnu.",
  DUPLICATE_FILE_ALREADY_COMMITTED: "Cette photo exacte a déjà été importée avec succès.",
  PRECEDENCE_CONFLICT: "Un import AddicTill/L'Addition existe déjà pour ce jour — scan-z ne peut pas le remplacer.",
  SCHEMA_MISMATCH: "Le schéma Notion des bases de pilotage ne correspond pas.",
  PREFLIGHT_TOKEN_INVALID_SIGNATURE: "Jeton de prévisualisation invalide — relancez l'analyse.",
  PREFLIGHT_TOKEN_MALFORMED: "Jeton de prévisualisation invalide — relancez l'analyse.",
  PREFLIGHT_TOKEN_EXPIRED: "La prévisualisation a expiré — relancez l'analyse.",
  PREFLIGHT_TOKEN_FILE_MISMATCH: "La photo a changé depuis l'analyse — relancez l'analyse.",
  PREFLIGHT_TOKEN_ESTABLISHMENT_MISMATCH: "L'établissement a changé depuis l'analyse — relancez l'analyse.",
};

async function postScanZ(url, { image, establishmentKey, preflightToken, finalValues }) {
  const formData = new FormData();
  formData.append("image", image);
  if (establishmentKey) formData.append("establishmentKey", establishmentKey);
  if (preflightToken) formData.append("preflightToken", preflightToken);
  if (finalValues) formData.append("finalValues", JSON.stringify(finalValues));

  const response = await fetch(url, { method: "POST", body: formData });
  const body = await parseJsonResponse(response);
  if (!response.ok) throw new Error(body.error || `Erreur ${response.status}`);
  return body;
}

export default function ScanZPanel({ establishmentKey, establishments }) {
  const [image, setImage] = useState(null);
  const [preflight, setPreflight] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [loadingPreflight, setLoadingPreflight] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);

  // Editable review fields — default to the OCR read, but total_ht/ca_ttc
  // NEVER default to a manufactured value (blank, never 0 or = total_ttc).
  const [dateField, setDateField] = useState("");
  const [ttcField, setTtcField] = useState("");
  const [htField, setHtField] = useState("");
  const [ticketField, setTicketField] = useState("");

  function resetForNewImage(nextImage) {
    setImage(nextImage);
    setPreflight(null);
    setCommitResult(null);
    setError(null);
    setAcknowledged(false);
  }

  async function handlePreflight() {
    if (!image) return;
    setLoadingPreflight(true);
    setError(null);
    setCommitResult(null);
    setAcknowledged(false);
    try {
      const result = await postScanZ("/api/imports/scan-z/preflight", { image, establishmentKey });
      setPreflight(result);
      const raw = result.raw_ocr;
      if (raw) {
        setDateField(raw.date ?? "");
        setTtcField(raw.total_ttc_cents !== null ? (raw.total_ttc_cents / 100).toFixed(2) : "");
        setHtField(""); // never pre-filled — total_ht is never manufactured
        setTicketField(raw.ticket_count !== null ? String(raw.ticket_count) : "");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPreflight(false);
    }
  }

  async function handleCommit() {
    if (!image || !preflight?.preflight_token) return;
    setCommitting(true);
    setError(null);
    try {
      const finalValues = {
        date: dateField || null,
        total_ttc: ttcField !== "" ? Number(ttcField) : null,
        total_ht: htField !== "" ? Number(htField) : null,
        ca_ttc: null,
        ticket_count: ticketField !== "" ? Number(ticketField) : null,
      };
      const result = await postScanZ("/api/imports/scan-z/commit", {
        image,
        establishmentKey,
        preflightToken: preflight.preflight_token,
        finalValues,
      });
      setCommitResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  }

  const requiresAcknowledgement = preflight?.confidence?.requiresAcknowledgement;
  const canCommit =
    preflight?.can_commit && !commitResult?.committed && (!requiresAcknowledgement || acknowledged);

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-amber-300 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/20">
      <p className="text-sm font-medium">
        Photo scan (OCR) — <span className="font-normal text-neutral-500">reconciliation/fallback uniquement, jamais prioritaire sur AddicTill</span>
      </p>

      <label className="block text-sm font-medium">
        Photo du Z (JPEG ou PNG)
        <input
          type="file"
          accept="image/jpeg,image/png"
          className="mt-1 block w-full text-sm"
          onChange={(e) => resetForNewImage(e.target.files?.[0] ?? null)}
        />
      </label>

      {!establishmentKey && <p className="text-xs text-neutral-500">Sélectionnez un établissement ci-dessus.</p>}

      <button
        type="button"
        onClick={handlePreflight}
        disabled={!image || loadingPreflight}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {loadingPreflight ? "Analyse (OCR)…" : "Analyser la photo"}
      </button>

      {error && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {preflight && preflight.scanz_enabled === false && (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {BLOCKING_REASON_LABELS.SCANZ_DISABLED}
        </p>
      )}

      {preflight && preflight.scanz_enabled !== false && (
        <div className="space-y-3 rounded border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          {preflight.raw_ocr && (
            <div className="text-xs text-neutral-500">
              <p>Résumé OCR : {preflight.raw_ocr.resume}</p>
              <p>
                Confiance : rapportée={preflight.raw_ocr.ocr_confidence} · calculée=
                {Math.round((preflight.confidence?.finalConfidence ?? 0) * 100)}%
              </p>
            </div>
          )}

          {preflight.blocking_reasons?.length > 0 && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <p className="font-medium">Import bloqué :</p>
              <ul className="mt-1 list-disc pl-5">
                {preflight.blocking_reasons.map((reason) => (
                  <li key={reason}>{BLOCKING_REASON_LABELS[reason] ?? reason}</li>
                ))}
              </ul>
            </div>
          )}

          {preflight.precedence?.blocked && (
            <div className="rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <p className="font-medium">
                Conflit de source : une ligne « {preflight.precedence.existingSourceSubtype} » (autorité{" "}
                {preflight.precedence.existingAuthority}) existe déjà pour ce jour — scan-z (autorité{" "}
                {preflight.precedence.incomingAuthority}) ne peut pas la remplacer. Aucune substitution possible.
              </p>
              {preflight.precedence.diff?.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {preflight.precedence.diff.map((d) => (
                    <li key={d.field}>
                      {d.field} : {String(d.oldValue)} → {String(d.newValue)} (non appliqué)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {preflight.validation?.warnings?.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-medium">Avertissements :</p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {preflight.validation.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {preflight.can_commit && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-500">
                Vérifiez/corrigez chaque valeur avant de confirmer :
              </p>
              <label className="block text-xs">
                Date
                <input
                  type="date"
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value)}
                  className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </label>
              <label className="block text-xs">
                Total TTC (€)
                <input
                  type="number"
                  step="0.01"
                  value={ttcField}
                  onChange={(e) => setTtcField(e.target.value)}
                  className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </label>
              <label className="block text-xs">
                Total HT (€) — jamais lu automatiquement, laissez vide si inconnu
                <input
                  type="number"
                  step="0.01"
                  placeholder="inconnu"
                  value={htField}
                  onChange={(e) => setHtField(e.target.value)}
                  className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </label>
              <label className="block text-xs">
                Nombre de tickets
                <input
                  type="number"
                  step="1"
                  value={ticketField}
                  onChange={(e) => setTicketField(e.target.value)}
                  className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </label>

              {requiresAcknowledgement && (
                <label className="flex items-start gap-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="mt-0.5"
                  />
                  Plusieurs signaux de fiabilité sont dégradés (qualité image, tickets inhabituels, valeurs
                  incohérentes...). J&apos;ai vérifié ces valeurs sur la caisse/le registre avant de confirmer.
                </label>
              )}

              <button
                type="button"
                onClick={handleCommit}
                disabled={!canCommit || committing}
                className="rounded bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {committing ? "Import…" : "Confirmer l'import scan-z"}
              </button>
            </div>
          )}
        </div>
      )}

      {commitResult && (
        <div
          className={`rounded border p-3 text-sm ${
            commitResult.commit_result === "success"
              ? "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          <p className="font-medium">
            Résultat : {commitResult.commit_result ?? "non exécuté"}
            {commitResult.import_run_id ? ` (Import Run ${commitResult.import_run_id})` : ""}
          </p>
          {commitResult.corrected_fields?.length > 0 && (
            <p className="mt-1 text-xs">Champs corrigés manuellement : {commitResult.corrected_fields.join(", ")}</p>
          )}
          {commitResult.blocking_reasons?.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {commitResult.blocking_reasons.map((reason) => (
                <li key={reason}>{BLOCKING_REASON_LABELS[reason] ?? reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
