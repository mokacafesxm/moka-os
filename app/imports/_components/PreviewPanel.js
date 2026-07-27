"use client";

const BLOCKING_REASON_LABELS = {
  UNKNOWN_FILE_TYPE: "Type de fichier non reconnu (PDF/XLSX/CSV attendu).",
  CLASSIFICATION_REJECTED: "Document non reconnu automatiquement.",
  CLASSIFICATION_REVIEW_REQUIRED: "Document ambigu — vérification manuelle requise.",
  VALIDATION_ERRORS: "Erreurs de validation bloquantes (voir la liste ci-dessous).",
  UNKNOWN_ESTABLISHMENT: "Établissement manquant ou inconnu.",
  DUPLICATE_FILE_ALREADY_COMMITTED: "Ce fichier exact a déjà été importé avec succès.",
  SCHEMA_MISMATCH: "Le schéma Notion des bases de pilotage ne correspond pas (voir détails).",
};

function rowCount(rows) {
  if (!rows) return 0;
  return Object.values(rows).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
}

export default function PreviewPanel({ preflight, commitResult }) {
  if (!preflight) return null;

  const result = commitResult ?? preflight;
  const hasErrors = preflight.validation?.errors?.length > 0;
  const hasWarnings = preflight.validation?.warnings?.length > 0;

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-neutral-100 px-2 py-1 font-mono text-xs dark:bg-neutral-800">
          {preflight.source_type ?? "unknown"} / {preflight.source_subtype ?? "unknown"}
        </span>
        {preflight.report_kind && (
          <span className="rounded bg-neutral-100 px-2 py-1 font-mono text-xs dark:bg-neutral-800">
            {preflight.report_kind}
          </span>
        )}
        <span className="rounded bg-neutral-100 px-2 py-1 font-mono text-xs dark:bg-neutral-800">
          {rowCount(preflight.rows)} ligne(s) à écrire
        </span>
        {preflight.classification && (
          <span className="text-xs text-neutral-500">
            classification: {preflight.classification.classified_by} (
            {Math.round(preflight.classification.confidence * 100)}%)
          </span>
        )}
      </div>

      {result.blocking_reasons?.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Import bloqué :</p>
          <ul className="mt-1 list-disc pl-5">
            {result.blocking_reasons.map((reason) => (
              <li key={reason}>{BLOCKING_REASON_LABELS[reason] ?? reason}</li>
            ))}
          </ul>
        </div>
      )}

      {hasErrors && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Erreurs de validation ({preflight.validation.errors.length}) :</p>
          <ul className="mt-1 list-disc pl-5 font-mono text-xs">
            {preflight.validation.errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {hasWarnings && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">Avertissements non bloquants ({preflight.validation.warnings.length}) :</p>
          <ul className="mt-1 list-disc pl-5 font-mono text-xs">
            {preflight.validation.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {preflight.duplicate_check_error && (
        <p className="text-xs text-neutral-500">
          Vérification des doublons indisponible ({preflight.duplicate_check_error}) — la prévisualisation reste
          valable, mais la validation finale sera refaite lors de la confirmation.
        </p>
      )}

      {preflight.unmapped_products?.length > 0 && (
        <div className="rounded border border-neutral-300 bg-neutral-50 p-3 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
          <p className="font-medium">Produits sans correspondance MÖKA ({preflight.unmapped_products.length}) :</p>
          <p className="mt-1 text-xs">{preflight.unmapped_products.join(", ")}</p>
        </div>
      )}

      {commitResult && (
        <div
          className={`rounded border p-3 ${
            commitResult.commit_result === "success"
              ? "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200"
              : "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          <p className="font-medium">
            Résultat : {commitResult.commit_result ?? "non exécuté"}
            {commitResult.import_run_id ? ` (Import Run ${commitResult.import_run_id})` : ""}
          </p>
          {commitResult.row_summary && (
            <p className="mt-1 font-mono text-xs">
              créées: {commitResult.row_summary.created} · mises à jour: {commitResult.row_summary.updated} ·
              inchangées: {commitResult.row_summary.skipped} · échouées: {commitResult.row_summary.failed}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
