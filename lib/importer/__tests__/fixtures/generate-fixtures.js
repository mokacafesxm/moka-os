#!/usr/bin/env node
'use strict';

/**
 * One-off generator for the binary test fixtures (PDF, XLSX) committed
 * under this directory. Re-run manually (`node generate-fixtures.js`) if a
 * fixture needs to change — nothing imports this file at test time.
 *
 * Every fixture here is 100% synthetic (invented établissement names,
 * zeroed amounts) — see README_IMPORTER.md "Fixtures et anonymisation" for
 * why no real bank/POS data is ever committed to this repo.
 */

const path = require('node:path');
const ExcelJS = require('exceljs');

/**
 * Hand-builds a minimal, byte-exact valid single-page PDF containing the
 * given ASCII text (no pdf-writer dependency needed for a one-page fixture).
 * @param {string} text - ASCII only, no parentheses/backslashes
 * @returns {Buffer}
 */
function buildMinimalPdf(text) {
  const header = '%PDF-1.4\n';
  const streamContent = `BT /F1 12 Tf 72 712 Td (${text}) Tj ET`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`,
  ];

  let body = header;
  const offsets = [0];
  objects.forEach((content, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${content}\nendobj\n`;
  });

  const xrefOffset = body.length;
  let xref = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body + xref + trailer, 'ascii');
}

async function main() {
  const fixturesDir = __dirname;

  const pdfBuffer = buildMinimalPdf(
    'Releve de compte bancaire IBAN FR76 0000 solde initial 1000.00 solde final 950.00 virement recu'
  );
  const fs = require('node:fs');
  const pdfPath = path.join(fixturesDir, 'pdf', 'bank-statement-sample.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`Wrote ${pdfPath} (${pdfBuffer.length} bytes)`);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Performance');
  sheet.addRow(['Rapport mensuel', 'Performance mensuelle', "Chiffre d'affaires mensuel", 'Bilan mensuel']);
  sheet.addRow(['Établissement', 'Mois', 'CA', 'Nombre de tickets']);
  sheet.addRow(['MOKA Café Test', '2026-01', 0, 0]);
  const xlsxPath = path.join(fixturesDir, 'xlsx', 'monthly-performance-sample.xlsx');
  await workbook.xlsx.writeFile(xlsxPath);
  console.log(`Wrote ${xlsxPath}`);

  // --- Bank statement fixtures (PR2A) ---
  // No synthetic Crédit Mutuel PDF fixtures: the real layout (confirmed
  // against 3 real statements, see docs/ARCHITECTURE.md "PR2A") relies on
  // pdf-parse's getTable() for positional débit/crédit column data, which
  // this hand-built text-only PDF generator cannot produce (no real table
  // structure/ruling for pdf-parse to detect). Bank-statement unit tests
  // instead construct `{ text, pages, tables }` directly in
  // bank-statement.test.js; real end-to-end coverage comes from the 3
  // files in lib/importer/__tests__/fixtures/bank/real/ (gitignored).

  // --- AddicTill fixtures (PR3) ---
  // Layout confirmed against real exports (see docs/ARCHITECTURE.md "PR3"):
  // row 1 has sparse section labels (only first cell of a merged group is
  // set), row 2 carries the fully-qualified "GROUP / SUBLABEL" header per
  // cell. Numbers below are invented; every cross-check (modes sum, HT+tax,
  // day-sums vs total row, category subtotals vs grand total) is exact.
  const dailySummaryWorkbook = new ExcelJS.Workbook();
  const dailySummary = dailySummaryWorkbook.addWorksheet('Worksheet');
  dailySummary.addRow([
    'Synthese quotidienne', null, null, null, null, null, null, null,
    'Modes de ventes', null, 'Taxes', null, null,
  ]);
  dailySummary.addRow([
    'Date', 'Nombre de tickets', 'Moyenne tickets TTC', 'Moyenne tickets HT', 'Total TTC', 'Total HT', 'CA TTC', 'Clients',
    'A EMPORTER / Total TTC', 'A EMPORTER / Nombre de tickets',
    'TGCA / Total TTC', 'TGCA / Total HT', 'TGCA / Taxe',
  ]);
  dailySummary.addRow(['2026-01-01', 10, 10, 9.62, 100, 96.15, 100, 0, 100, 10, 100, 96.15, 3.85]);
  dailySummary.addRow(['2026-01-02', 20, 10, 9.62, 200, 192.3, 200, 0, 200, 20, 200, 192.3, 7.7]);
  dailySummary.addRow([null, 30, 10, 9.62, 300, 288.45, 300, 0, 300, 30, 300, 288.45, 11.55]);
  const dailySummaryPath = path.join(fixturesDir, 'pos', 'synthetic', 'daily-summary-sample.xlsx');
  await dailySummaryWorkbook.xlsx.writeFile(dailySummaryPath);
  console.log(`Wrote ${dailySummaryPath}`);

  const rankingWorkbook = new ExcelJS.Workbook();
  const produits = rankingWorkbook.addWorksheet('Produits');
  produits.addRow([
    'Produit', 'Quantité', 'Quantité décimale', '%Qté', 'CA TTC', '%CA TTC', 'CA HT', 'Offerts', 'Remises', 'PU',
    'Codes barre', 'Dernière vente', 'Rubrique',
  ]);
  produits.addRow(['CAFE', 100, null, 50, 500, 50, 480.77, 2, 0, 5, null, '2026-07-01 10:00:00', 'BOISSONS']);
  produits.addRow(['THE', 50, null, 25, 250, 25, 240.38, 0, 1, 5, null, '2026-07-02 11:00:00', 'BOISSONS']);
  produits.addRow(['CROISSANT', 50, null, 25, 250, 25, 240.38, 1, 0, 5, null, '2026-07-03 09:00:00', 'PATISSERIE']);
  produits.addRow(['Total général', 200, null, null, 1000, null, 961.53, 3]);

  const rubriques = rankingWorkbook.addWorksheet('Rubriques');
  rubriques.addRow([
    'Rubrique', 'Produit', 'Quantité', 'Quantité décimale', '%Qté', 'CA TTC', '%CA TTC', 'CA HT', 'Offerts', 'Remises',
    'PU', 'Codes barre', 'Dernière vente',
  ]);
  rubriques.addRow(['BOISSONS']);
  rubriques.addRow([null, 'CAFE', 100, null, 50, 500, 50, 480.77, 2, 0, 5, null, '2026-07-01 10:00:00']);
  rubriques.addRow([null, 'THE', 50, null, 25, 250, 25, 240.38, 0, 1, 5, null, '2026-07-02 11:00:00']);
  rubriques.addRow(['Total BOISSONS', null, 150, null, 75, 750, 75, 721.15, 2]);
  rubriques.addRow([]);
  rubriques.addRow(['PATISSERIE']);
  rubriques.addRow([null, 'CROISSANT', 50, null, 25, 250, 25, 240.38, 1, 0, 5, null, '2026-07-03 09:00:00']);
  rubriques.addRow(['Total PATISSERIE', null, 50, null, 25, 250, 25, 240.38, 1]);
  rubriques.addRow([]);
  rubriques.addRow(['Total général', null, 200, null, null, 1000, null, 961.53, 3]);

  const rankingPath = path.join(fixturesDir, 'pos', 'synthetic', 'product-ranking-sample.xlsx');
  await rankingWorkbook.xlsx.writeFile(rankingPath);
  console.log(`Wrote ${rankingPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
