#!/usr/bin/env node
'use strict';

/**
 * Read-only Notion schema validation for the 5 pilotage databases (PR4).
 * Never creates, renames, or modifies anything — only reports. See
 * lib/importer/notion/schema.js for the underlying check, and
 * README_IMPORTER.md "PR4" for the exact manual database setup spec this
 * command validates against.
 *
 * Usage: npm run importer:schema:check
 * Exit code: 0 when all 5 targets are reachable and match; 1 otherwise.
 */

const { checkPilotageSchemas } = require('../lib/importer/notion/schema');
const { PILOTAGE_TARGETS } = require('../lib/importer/config/pilotage-targets');

const REASON_LABELS = {
  CONFIG_MISSING: (target) => `variable d'environnement ${target.targetIdEnvVar} non définie`,
  NOT_FOUND: () => "base introuvable (l'ID configuré ne correspond à aucune base Notion)",
  NOT_SHARED_WITH_INTEGRATION: () => "base non partagée avec l'intégration Notion",
  FETCH_ERROR: (target, result) => `erreur réseau/API : ${result.error ?? 'inconnue'}`,
};

async function main() {
  const results = await checkPilotageSchemas();
  let hasBlockingIssue = false;

  console.log('MÖKA importer — vérification des schémas Notion (lecture seule)\n');

  for (const result of results) {
    const target = PILOTAGE_TARGETS[result.targetKey];
    console.log(`• ${result.label} (${target.targetIdEnvVar})`);

    if (result.reason && !result.validation) {
      hasBlockingIssue = true;
      const describe = REASON_LABELS[result.reason];
      console.log(`  ÉCHEC : ${describe ? describe(target, result) : result.reason}`);
      console.log('');
      continue;
    }

    const { validation } = result;
    if (validation.missing.length > 0) {
      hasBlockingIssue = true;
      console.log(`  propriétés manquantes  : ${validation.missing.join(', ')}`);
    }
    if (validation.typeMismatches.length > 0) {
      hasBlockingIssue = true;
      for (const mismatch of validation.typeMismatches) {
        console.log(`  type incompatible      : ${mismatch.name} (attendu ${mismatch.expected}, trouvé ${mismatch.actual})`);
      }
    }
    if (validation.extra.length > 0) {
      console.log(`  propriétés en plus     : ${validation.extra.join(', ')} (non bloquant)`);
    }
    console.log(`  statut                 : ${result.ok ? 'OK' : 'ÉCHEC'}`);
    console.log('');
  }

  if (hasBlockingIssue) {
    console.log('Résultat : au moins une base ne correspond pas au schéma attendu — commit bloqué tant que ce n\'est pas corrigé.');
    process.exitCode = 1;
  } else {
    console.log('Résultat : les 5 bases de pilotage sont accessibles et conformes.');
  }
}

main().catch((error) => {
  console.error('Erreur inattendue:', error);
  process.exitCode = 1;
});
