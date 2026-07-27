#!/usr/bin/env node
'use strict';

/**
 * MÖKA importer CLI — PR1 + PR2A + PR3 + PR4 scope.
 *
 * Default (dry-run) mode: detect -> [registry lookup] -> extract -> classify
 * -> [bank/AddicTill parser preview] for every file in imports/incoming/ (or
 * a single --file), and prints/logs the result. No file is ever moved, no
 * import-registry.json entry is ever written, and no Notion call is made.
 *
 * --commit mode (PR4): re-runs the exact same analysis through
 * lib/importer/notion/commit-pipeline.js (shared with the web API — see
 * docs/ARCHITECTURE.md "PR4") and, only if nothing blocks, writes the
 * pilotage rows and an Import Run record to Notion. Requires
 * --establishment (never inferred) and either an interactive TTY
 * confirmation or the explicit --yes flag — never runs unattended without
 * one of those two.
 *
 * Usage:
 *   npm run importer                                    # scan imports/incoming/ (dry-run)
 *   npm run importer -- --file path/to.pdf              # analyze a single file
 *   npm run importer -- --file palmares.xlsx \
 *     --period-start 2026-01-01 --period-end 2026-07-16  # AddicTill product ranking only —
 *                                                          # never inferred, 'unknown' if omitted
 *   npm run importer -- --file synthese.xlsx --commit --establishment moka-sxm
 *   npm run importer -- --file synthese.xlsx --commit --establishment moka-sxm --yes  # non-interactive
 *
 * --scan-z mode (secondary source, behind IMPORTS_SCANZ_ENABLED, default
 * false): a photographed Z-report, OCR'd via Claude vision, treated as a
 * fallback/reconciliation source only — never authoritative over AddicTill/
 * L'Addition (see docs/ARCHITECTURE.md "scan-z secondary source"). ALWAYS
 * requires interactive confirmation — --yes is never honored for scan-z,
 * even if passed, and there is no override of any kind for a source-
 * precedence conflict, from any surface.
 *   npm run importer -- --scan-z photo.jpg --establishment moka-sxm
 */

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const os = require('node:os');

const { detectFileType } = require('../lib/importer/detect');
const { extractContent } = require('../lib/importer/extract');
const { classifyDocument, resolveClassificationStatus } = require('../lib/importer/classify');
const { computeFileHash, readRegistry, findByHash, writeRegistry, upsertEntry } = require('../lib/importer/registry');
const { createRunLogger, writeRunLog } = require('../lib/importer/logger');
const { parseBankStatement } = require('../lib/importer/parsers/bank-statement');
const { parsePosAddictill } = require('../lib/importer/parsers/pos-addictill');
const { runCommit, runScanZPreflight, runScanZCommit, isScanZEnabled } = require('../lib/importer/notion/commit-pipeline');

const INCOMING_DIR = path.join(process.cwd(), 'imports', 'incoming');
const REGISTRY_PATH = path.join(process.cwd(), 'imports', 'import-registry.json');

/**
 * @param {number|null} cents
 * @returns {string}
 */
function formatCentsOrNull(cents) {
  return cents === null ? 'inconnu' : (cents / 100).toFixed(2);
}

/**
 * @param {string[]} argv
 * @returns {{file: string|null, commit: boolean, establishment: string|null, yes: boolean, periodStart: string|null, periodEnd: string|null, unsupported: string[]}}
 */
function parseArgs(argv) {
  let file = null;
  let commit = false;
  let establishment = null;
  let yes = false;
  let periodStart = null;
  let periodEnd = null;
  let scanZ = null;
  const unsupported = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') {
      file = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--commit') {
      commit = true;
    } else if (arg === '--establishment') {
      establishment = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--yes') {
      yes = true;
    } else if (arg === '--period-start') {
      periodStart = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--period-end') {
      periodEnd = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--scan-z') {
      scanZ = argv[i + 1] ?? null;
      i += 1;
    } else {
      unsupported.push(arg);
    }
  }

  return { file, commit, establishment, yes, periodStart, periodEnd, scanZ, unsupported };
}

/**
 * Prompts for a single field, showing the OCR-read value as the default —
 * pressing Enter keeps it, typing a value overrides it. This is the CLI's
 * (deliberately minimal) equivalent of the UI's editable review fields.
 * @param {string} label
 * @param {string} defaultDisplay
 * @returns {Promise<string>}
 */
function promptField(label, defaultDisplay) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`  ${label} [${defaultDisplay}] : `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Interactive TTY confirmation — never auto-approves. Returns false
 * immediately (no prompt) when stdin isn't a TTY, since an unattended
 * process could never actually answer it.
 * @param {string} question
 * @returns {Promise<boolean>}
 */
function confirmInteractively(question) {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

/**
 * Runs a single file through the shared commit-pipeline (PR4) and prints a
 * human-readable summary. Mirrors the JSON the web API returns for the
 * same call — see app/api/imports/commit/route.js.
 * @param {string} filePath
 * @param {string} establishmentKey
 * @param {ReturnType<typeof readRegistry>} registry
 * @returns {Promise<void>}
 */
async function commitFile(filePath, establishmentKey, registry) {
  const sourceFile = path.basename(filePath);
  console.log(`• ${sourceFile}`);

  const result = await runCommit({
    filePath,
    originalFilename: sourceFile,
    establishmentKey,
    initiatedVia: 'cli',
    initiatedBy: os.userInfo().username,
  });

  console.log(`  type de document    : ${result.source_type ?? 'unknown'} / ${result.source_subtype ?? 'unknown'}`);
  if (result.report_kind) console.log(`  type de rapport     : ${result.report_kind}`);
  console.log(`  établissement       : ${result.establishment ? result.establishment.name : 'inconnu'}`);

  if (result.validation?.errors?.length > 0) {
    for (const validationError of result.validation.errors) {
      console.log(`  erreur validation   : ${validationError}`);
    }
  }
  if (result.validation?.warnings?.length > 0) {
    for (const warning of result.validation.warnings) {
      console.log(`  avertissement       : ${warning}`);
    }
  }

  if (!result.can_commit) {
    console.log(`  BLOQUÉ              : ${result.blocking_reasons.join(', ')}`);
    console.log('');
    return;
  }

  console.log('  → confirmé pour commit, envoi à Notion…');
  console.log(`  résultat            : ${result.commit_result ?? 'non exécuté'}`);
  if (result.import_run_id) console.log(`  import run          : ${result.import_run_id}`);
  if (result.row_summary) {
    console.log(
      `  lignes              : créées=${result.row_summary.created} mises à jour=${result.row_summary.updated} ` +
        `inchangées=${result.row_summary.skipped} échouées=${result.row_summary.failed}`
    );
  }

  if (result.commit_result === 'success') {
    const fileHash = computeFileHash(filePath);
    const updated = upsertEntry(registry, {
      file_hash: fileHash,
      original_filename: sourceFile,
      processed_at: new Date().toISOString(),
      source_type: result.source_type,
      status: 'success',
      import_run_id: result.import_run_id,
      destination_path: null,
    });
    writeRegistry(updated, REGISTRY_PATH);
    Object.assign(registry, updated);
  }

  console.log('');
}

/**
 * @param {string|null} explicitFile
 * @returns {string[]} absolute file paths to analyze
 */
function resolveTargetFiles(explicitFile) {
  if (explicitFile) {
    return [path.resolve(explicitFile)];
  }
  if (!fs.existsSync(INCOMING_DIR)) {
    return [];
  }
  return fs
    .readdirSync(INCOMING_DIR)
    .filter((name) => !name.startsWith('.'))
    .map((name) => path.join(INCOMING_DIR, name))
    .filter((filePath) => fs.statSync(filePath).isFile());
}

/**
 * Analyzes a single file through detect -> registry lookup -> extract ->
 * classify, never throwing — extraction/classification failures become a
 * 'rejected' status with a reason, matching the guard-rail order in
 * AGENTS.md (file type -> file_hash -> extraction -> classification -> ...).
 * @param {string} filePath
 * @param {ReturnType<typeof readRegistry>} registry
 * @param {{periodStart?: string|null, periodEnd?: string|null}} [posOptions] - forwarded to the AddicTill product-ranking parser only
 * @returns {Promise<Object>} a RunFileEntry-shaped result, plus a `notes` array for CLI display
 */
async function analyzeFile(filePath, registry, posOptions = {}) {
  const sourceFile = path.basename(filePath);
  const notes = [];

  const detection = detectFileType(filePath);
  if (detection.file_type === 'unknown') {
    return {
      source_file: sourceFile,
      file_hash: computeFileHash(filePath),
      detected_file_type: detection.file_type,
      detected_document_type: 'unknown',
      classification_confidence: 0,
      classified_by: 'rules',
      status: 'rejected',
      pos_source_hint: null,
      bank_statement_preview: null,
      pos_export_preview: null,
      warnings: [],
      errors: ['Type de fichier non supporté ou extension/signature incohérente.'],
    };
  }

  const fileHash = computeFileHash(filePath);
  const existing = findByHash(registry, fileHash);
  if (existing && existing.status === 'success') {
    notes.push(
      `Déjà traité le ${existing.processed_at} (run ${existing.import_run_id}) — ignoré.`
    );
    return {
      source_file: sourceFile,
      file_hash: fileHash,
      detected_file_type: detection.file_type,
      detected_document_type: 'unknown',
      classification_confidence: 0,
      classified_by: 'rules',
      status: 'duplicate',
      pos_source_hint: null,
      bank_statement_preview: null,
      pos_export_preview: null,
      warnings: [],
      errors: [],
      notes,
    };
  }

  let extraction;
  try {
    extraction = await extractContent(filePath, detection.file_type);
  } catch (error) {
    return {
      source_file: sourceFile,
      file_hash: fileHash,
      detected_file_type: detection.file_type,
      detected_document_type: 'unknown',
      classification_confidence: 0,
      classified_by: 'rules',
      status: 'rejected',
      pos_source_hint: null,
      bank_statement_preview: null,
      pos_export_preview: null,
      warnings: [],
      errors: [`Échec d'extraction: ${error.message}`],
    };
  }

  let classification;
  try {
    classification = await classifyDocument(extraction);
  } catch (error) {
    return {
      source_file: sourceFile,
      file_hash: fileHash,
      detected_file_type: detection.file_type,
      detected_document_type: 'unknown',
      classification_confidence: 0,
      classified_by: 'rules',
      status: 'rejected',
      pos_source_hint: null,
      bank_statement_preview: null,
      pos_export_preview: null,
      warnings: [],
      errors: [`Échec de classification: ${error.message}`],
    };
  }

  const status = resolveClassificationStatus(classification);
  if (!process.env.ANTHROPIC_API_KEY && classification.classified_by === 'rules' && status !== 'auto') {
    notes.push('ANTHROPIC_API_KEY absent : classification limitée aux règles locales.');
  }

  // PR2A preview only: read-only parse + validation, never written to the
  // registry or Notion, never changes `status` or moves the file. Wrapped
  // so a parser bug degrades to an informational note, never crashes the run.
  let bankStatementSummary = null;
  if (classification.document_type === 'bank_statement') {
    try {
      const { statement, validation } = parseBankStatement(extraction);
      bankStatementSummary = {
        bank_name: statement.bank_name,
        currency: statement.currency,
        opening_balance_cents: statement.opening_balance_cents,
        closing_balance_cents: statement.closing_balance_cents,
        total_debits_cents: statement.total_debits_cents,
        total_credits_cents: statement.total_credits_cents,
        printed_total_debits_cents: statement.printed_total_debits_cents,
        printed_total_credits_cents: statement.printed_total_credits_cents,
        transaction_count: statement.transactions.length,
        valid: validation.valid,
        validation_errors: validation.errors,
        validation_warnings: validation.warnings,
      };
    } catch (error) {
      notes.push(`Aperçu parseur bancaire indisponible: ${error.message}`);
    }
  }

  // PR3 preview only: same guarantees as the bank-statement preview above —
  // read-only, never written anywhere, never changes `status`/file placement.
  let posExportSummary = null;
  if (classification.document_type === 'pos_export' && classification.pos_source_hint === 'addictill_export') {
    try {
      const { reportType, statement, validation } = parsePosAddictill(extraction, {
        periodStart: posOptions.periodStart ?? undefined,
        periodEnd: posOptions.periodEnd ?? undefined,
      });
      if (reportType === 'daily_summary') {
        posExportSummary = {
          report_type: reportType,
          period_start: statement.period_start,
          period_end: statement.period_end,
          day_count: statement.days.length,
          total_ttc_cents: statement.days.reduce((sum, d) => sum + d.total_ttc_cents, 0),
          unmapped_product_count: null,
          valid: validation.valid,
          validation_errors: validation.errors,
          validation_warnings: validation.warnings,
        };
      } else if (reportType === 'product_ranking') {
        posExportSummary = {
          report_type: reportType,
          period_start: statement.period_start,
          period_end: statement.period_end,
          period_status: statement.period_status,
          product_count: statement.products.length,
          category_count: statement.category_subtotals.length,
          unmapped_product_count: statement.unmapped_products.length,
          valid: validation.valid,
          validation_errors: validation.errors,
          validation_warnings: validation.warnings,
        };
      } else {
        notes.push(`Export AddicTill non reconnu: ${validation.errors.join('; ')}`);
      }
    } catch (error) {
      notes.push(`Aperçu parseur AddicTill indisponible: ${error.message}`);
    }
  }

  return {
    source_file: sourceFile,
    file_hash: fileHash,
    detected_file_type: detection.file_type,
    detected_document_type: classification.document_type,
    classification_confidence: classification.confidence,
    classified_by: classification.classified_by,
    status,
    pos_source_hint: classification.pos_source_hint,
    bank_statement_preview: bankStatementSummary,
    pos_export_preview: posExportSummary,
    warnings: [],
    errors: [],
    notes: [...notes, classification.reasoning_summary],
  };
}

/**
 * Runs the scan-z secondary-source flow for a single photo: preflight,
 * print the OCR read + confidence + any precedence conflict, let the human
 * confirm/correct each field, then commit. ALWAYS interactive — --yes is
 * never honored here (unlike --commit), and there is no override for a
 * source-precedence conflict, from any surface. See
 * docs/ARCHITECTURE.md "scan-z secondary source".
 * @param {string} imagePath
 * @param {string} establishmentKey
 * @returns {Promise<void>}
 */
async function runScanZFile(imagePath, establishmentKey) {
  const sourceFile = path.basename(imagePath);
  console.log(`• ${sourceFile} (scan-z)`);

  if (!isScanZEnabled()) {
    console.error('  IMPORTS_SCANZ_ENABLED n\'est pas activé — voir .env.example.');
    process.exitCode = 1;
    return;
  }

  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  const imageBuffer = fs.readFileSync(imagePath);

  const preflight = await runScanZPreflight({
    imageBuffer,
    mimeType,
    originalFilename: sourceFile,
    establishmentKey,
    initiatedVia: 'cli',
    initiatedBy: os.userInfo().username,
  });

  console.log(`  établissement       : ${preflight.establishment ? preflight.establishment.name : 'inconnu'}`);
  if (preflight.raw_ocr) {
    console.log(`  résumé OCR          : ${preflight.raw_ocr.resume}`);
    console.log(
      `  confiance           : rapportée=${preflight.raw_ocr.ocr_confidence} calculée=${preflight.confidence.finalConfidence.toFixed(2)}`
    );
  }
  for (const w of preflight.validation.warnings) console.log(`  avertissement       : ${w}`);
  for (const e of preflight.validation.errors) console.log(`  erreur              : ${e}`);

  if (preflight.precedence?.blocked) {
    console.log(
      `  CONFLIT DE SOURCE   : une ligne '${preflight.precedence.existingSourceSubtype}' (autorité ${preflight.precedence.existingAuthority}) existe déjà pour ce jour — scan-z (autorité ${preflight.precedence.incomingAuthority}) ne peut pas la remplacer. Aucune substitution possible depuis aucune interface.`
    );
  }

  if (!preflight.can_commit) {
    console.log(`  BLOQUÉ              : ${preflight.blocking_reasons.join(', ')}`);
    console.log('');
    return;
  }

  if (preflight.confidence.requiresAcknowledgement) {
    console.log('  ⚠ Plusieurs signaux de fiabilité sont dégradés — vérifiez impérativement ces valeurs sur la caisse/le registre avant de confirmer.');
  }

  console.log('  Confirmez ou corrigez chaque valeur (Entrée pour garder la valeur lue) :');
  const raw = preflight.raw_ocr;
  const dateAnswer = await promptField('date (AAAA-MM-JJ)', raw.date ?? 'inconnue');
  const ttcAnswer = await promptField('total TTC (€)', raw.total_ttc_cents !== null ? (raw.total_ttc_cents / 100).toFixed(2) : 'inconnu');
  const htAnswer = await promptField('total HT (€, jamais déduit — laisser vide si inconnu)', 'vide');
  const clientsAnswer = await promptField('nombre de tickets', raw.ticket_count !== null ? String(raw.ticket_count) : 'inconnu');

  const finalValues = {
    date: dateAnswer || raw.date,
    total_ttc: ttcAnswer ? Number(ttcAnswer) : raw.total_ttc_cents !== null ? raw.total_ttc_cents / 100 : null,
    total_ht: htAnswer && htAnswer !== 'vide' ? Number(htAnswer) : null,
    ca_ttc: null,
    ticket_count: clientsAnswer ? Number(clientsAnswer) : raw.ticket_count,
  };

  // ALWAYS interactive — --yes is never honored for scan-z (spec v3 §5:
  // human confirmation is mandatory, more strictly than for --commit).
  const proceed = await confirmInteractively('Confirmer cet import scan-z vers Notion ?');
  if (!proceed) {
    console.log('  ignoré (non confirmé).\n');
    return;
  }

  const result = await runScanZCommit({
    imageBuffer,
    originalFilename: sourceFile,
    establishmentKey,
    preflightToken: preflight.preflight_token,
    finalValues,
    initiatedVia: 'cli',
    initiatedBy: os.userInfo().username,
  });

  if (!result.can_commit) {
    console.log(`  BLOQUÉ              : ${result.blocking_reasons.join(', ')}`);
    console.log('');
    return;
  }

  console.log(`  résultat            : ${result.commit_result}`);
  if (result.corrected_fields?.length > 0) {
    console.log(`  champs corrigés     : ${result.corrected_fields.join(', ')}`);
  }
  if (result.import_run_id) console.log(`  import run          : ${result.import_run_id}`);
  console.log('');
}

async function main() {
  const { file, commit, establishment, yes, periodStart, periodEnd, scanZ, unsupported } = parseArgs(
    process.argv.slice(2)
  );

  if (unsupported.length > 0) {
    console.error(`Options non reconnues: ${unsupported.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (scanZ) {
    if (!establishment) {
      console.error('--scan-z requiert --establishment <clé> (jamais déduit) — voir README_IMPORTER.md.');
      process.exitCode = 1;
      return;
    }
    await runScanZFile(path.resolve(scanZ), establishment);
    return;
  }

  if (commit) {
    if (!establishment) {
      console.error(
        '--commit requiert --establishment <clé> (jamais déduit du fichier ou du nom) — voir README_IMPORTER.md.'
      );
      process.exitCode = 1;
      return;
    }

    const targetFiles = resolveTargetFiles(file);
    if (targetFiles.length === 0) {
      console.log('Aucun fichier à importer.');
      return;
    }

    const registry = readRegistry(REGISTRY_PATH);
    console.log(`MÖKA importer — commit (${targetFiles.length} fichier(s), établissement=${establishment})\n`);

    for (const filePath of targetFiles) {
      const proceed = yes || (await confirmInteractively(`Importer ${path.basename(filePath)} vers Notion ?`));
      if (!proceed) {
        console.log(`• ${path.basename(filePath)} — ignoré (non confirmé).\n`);
        continue;
      }
      await commitFile(filePath, establishment, registry);
    }

    return;
  }

  const targetFiles = resolveTargetFiles(file);
  if (targetFiles.length === 0) {
    console.log('Aucun fichier à analyser dans imports/incoming/.');
    return;
  }

  const registry = readRegistry(REGISTRY_PATH);
  const runLogger = createRunLogger({ mode: 'dry-run' });

  console.log(`MÖKA importer — dry-run (${targetFiles.length} fichier(s))\n`);

  for (const filePath of targetFiles) {
    const result = await analyzeFile(filePath, registry, { periodStart, periodEnd });
    const { notes, ...logEntry } = result;

    runLogger.recordFile(logEntry);

    console.log(`• ${result.source_file}`);
    console.log(`  type détecté        : ${result.detected_file_type}`);
    console.log(`  type de document    : ${result.detected_document_type}`);
    console.log(`  confiance           : ${result.classification_confidence.toFixed(2)}`);
    console.log(`  classifié par       : ${result.classified_by}`);
    if (result.pos_source_hint) {
      console.log(`  source POS          : ${result.pos_source_hint}`);
    }
    console.log(`  statut              : ${result.status}`);
    if (result.bank_statement_preview) {
      const preview = result.bank_statement_preview;
      console.log(
        `  aperçu bancaire     : ${preview.bank_name ?? '?'} · ${preview.currency ?? 'devise inconnue'} · ` +
          `${preview.transaction_count} transaction(s)`
      );
      console.log(
        `    soldes            : ouverture=${formatCentsOrNull(preview.opening_balance_cents)} ` +
          `clôture=${formatCentsOrNull(preview.closing_balance_cents)}`
      );
      console.log(
        `    totaux recalculés : débits=${formatCentsOrNull(preview.total_debits_cents)} ` +
          `crédits=${formatCentsOrNull(preview.total_credits_cents)}`
      );
      if (preview.printed_total_debits_cents !== null || preview.printed_total_credits_cents !== null) {
        console.log(
          `    totaux affichés   : débits=${formatCentsOrNull(preview.printed_total_debits_cents)} ` +
            `crédits=${formatCentsOrNull(preview.printed_total_credits_cents)}`
        );
      }
      console.log(`    validation totaux : ${preview.valid ? 'OK' : 'ÉCHEC'}`);
      for (const validationError of preview.validation_errors) {
        console.log(`    erreur validation : ${validationError}`);
      }
      for (const validationWarning of preview.validation_warnings) {
        console.log(`    avertissement     : ${validationWarning}`);
      }
    }
    if (result.pos_export_preview) {
      const preview = result.pos_export_preview;
      if (preview.report_type === 'daily_summary') {
        console.log(
          `  aperçu AddicTill    : synthèse quotidienne · ${preview.day_count} jour(s) · ` +
            `${preview.period_start} → ${preview.period_end} · CA TTC=${formatCentsOrNull(preview.total_ttc_cents)}`
        );
      } else {
        console.log(
          `  aperçu AddicTill    : palmarès produits · ${preview.product_count} produit(s) · ` +
            `${preview.category_count} catégorie(s) · période=${preview.period_status}`
        );
        console.log(`    mapping recette   : ${preview.unmapped_product_count} produit(s) non mappé(s)`);
      }
      console.log(`    validation totaux : ${preview.valid ? 'OK' : 'ÉCHEC'}`);
      for (const validationError of preview.validation_errors) {
        console.log(`    erreur validation : ${validationError}`);
      }
      for (const validationWarning of preview.validation_warnings) {
        console.log(`    avertissement     : ${validationWarning}`);
      }
    }
    for (const note of notes ?? []) {
      console.log(`  note                : ${note}`);
    }
    for (const err of result.errors) {
      console.log(`  erreur              : ${err}`);
    }
    console.log('');
  }

  const runLog = runLogger.finalize();
  const logPath = writeRunLog(runLog);

  console.log('Résumé:');
  console.log(`  auto             : ${runLog.summary.auto}`);
  console.log(`  review_required  : ${runLog.summary.review_required}`);
  console.log(`  rejected         : ${runLog.summary.rejected}`);
  console.log(`  duplicate        : ${runLog.summary.duplicate}`);
  console.log(`\nJournal écrit dans ${path.relative(process.cwd(), logPath)}`);
  console.log(
    'PR1 : aucun fichier déplacé, aucune écriture Notion — phase d\'analyse uniquement.'
  );
}

main().catch((error) => {
  console.error('Erreur inattendue:', error);
  process.exitCode = 1;
});
