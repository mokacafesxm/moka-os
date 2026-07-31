import { describe, it, expect } from 'vitest';

import {
  detectAddicTillReportType,
  parseHeaderColumns,
  parseDailySummary,
  parseProductRanking,
  parsePosAddictill,
} from '../../parsers/pos-addictill.js';
import { annotateProductsWithMapping, normalizeProductKey } from '../../parsers/recipe-mapping.js';

/** Wraps rows into the single-sheet ExtractionResult shape a daily summary needs. */
function dailySummaryExtraction(rows) {
  return { sheets: [{ name: 'Worksheet', rows }] };
}

/** Wraps Produits/Rubriques rows into the two-sheet ExtractionResult shape. */
function productRankingExtraction(produitsRows, rubriquesRows) {
  return {
    sheets: [
      { name: 'Produits', rows: produitsRows },
      { name: 'Rubriques', rows: rubriquesRows },
    ],
  };
}

const DAILY_ROW1 = [
  'Synthese quotidienne', null, null, null, null, null, null, null,
  'Modes de ventes', null, null, null,
  'Taxes', null, null,
];
const DAILY_ROW2 = [
  'Date', 'Nombre de tickets', 'Moyenne tickets TTC', 'Moyenne tickets HT', 'Total TTC', 'Total HT', 'CA TTC', 'Clients',
  'A EMPORTER / Total TTC', 'A EMPORTER / Nombre de tickets', 'SUR PLACE / Total TTC', 'SUR PLACE / Nombre de tickets',
  'TGCA / Total TTC', 'TGCA / Total HT', 'TGCA / Taxe',
];

describe('detectAddicTillReportType', () => {
  it('recognizes a daily summary export', () => {
    expect(detectAddicTillReportType(dailySummaryExtraction([DAILY_ROW1, DAILY_ROW2]))).toBe('daily_summary');
  });

  it('recognizes a product ranking export (Produits + Rubriques sheets)', () => {
    expect(detectAddicTillReportType(productRankingExtraction([['Produit']], [['Rubrique']]))).toBe(
      'product_ranking'
    );
  });

  it('returns null for an unrelated file', () => {
    expect(detectAddicTillReportType({ sheets: [{ name: 'Sheet1', rows: [['foo', 'bar']] }] })).toBeNull();
  });

  it('recognizes a sales journal export by title', () => {
    expect(
      detectAddicTillReportType({ sheets: [{ name: 'Worksheet', rows: [['Journal de ventes'], ['Date', 'Libellé']] }] })
    ).toBe('sales_journal');
  });

  it('recognizes a sales journal export by the UTILISATEURS section, even without the title', () => {
    expect(
      detectAddicTillReportType({
        sheets: [{ name: 'Worksheet', rows: [['Rapport'], ['UTILISATEURS'], ['GUILLAUME MOKA', 12]] }],
      })
    ).toBe('sales_journal');
  });
});

describe('parseHeaderColumns', () => {
  it('maps grouped columns by header text regardless of column order (confirmed real-world variance)', () => {
    const row1 = [null, null, 'Encaissements', null, null, null];
    const rowOrderA = ['Date', 'Total TTC', 'ESPECES / Quantité', 'ESPECES / Total', 'CARTE BANCAIRE / Quantité', 'CARTE BANCAIRE / Total'];
    const rowOrderB = ['Date', 'Total TTC', 'CARTE BANCAIRE / Quantité', 'CARTE BANCAIRE / Total', 'ESPECES / Quantité', 'ESPECES / Total'];

    for (const row2 of [rowOrderA, rowOrderB]) {
      const columns = parseHeaderColumns(row1, row2);
      const especes = columns.find((c) => c.group === 'ESPECES' && c.subLabel === 'Total');
      const carte = columns.find((c) => c.group === 'CARTE BANCAIRE' && c.subLabel === 'Total');
      expect(especes).toBeDefined();
      expect(carte).toBeDefined();
      expect(especes.section).toBe('Encaissements');
    }
  });

  it('forward-fills the last section across trailing columns even when row1 is shorter than row2 (regression: this exact gap previously zeroed out ticket_count/total_ttc_cents)', () => {
    const row1 = [null, null, 'Vendeurs']; // ends at index 2, row2 has 2 more grouped columns beyond it
    const row2 = ['Date', 'Total TTC', 'ALICE / Total TTC', 'ALICE / Nombre de tickets', 'BOB / Total TTC'];
    const columns = parseHeaderColumns(row1, row2);
    expect(columns[3].section).toBe('Vendeurs'); // index beyond row1's own length
    expect(columns[4].section).toBe('Vendeurs');
    // Crucially, the ungrouped top-level columns must stay ungrouped and unaffected.
    expect(columns[0].section).toBeNull();
    expect(columns[1].section).toBeNull();
  });
});

describe('parseDailySummary', () => {
  it('parses a valid multi-day summary and validates cleanly', () => {
    const rows = [
      DAILY_ROW1,
      DAILY_ROW2,
      ['2026-01-01', 10, 10, 9.62, 100, 96.15, 100, 0, 60, 6, 40, 4, 100, 96.15, 3.85],
      ['2026-01-02', 20, 10, 9.62, 200, 192.3, 200, 0, 120, 12, 80, 8, 200, 192.3, 7.7],
      [null, 30, 10, 9.62, 300, 288.45, 300, 0, 180, 18, 120, 12, 300, 288.45, 11.55],
    ];
    const { statement, validation } = parseDailySummary(dailySummaryExtraction(rows));

    expect(statement.days).toHaveLength(2);
    expect(statement.period_start).toBe('2026-01-01');
    expect(statement.period_end).toBe('2026-01-02');
    expect(statement.days[0].sales_by_mode).toHaveLength(2);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('sums every detected sales mode dynamically, not just À EMPORTER/SUR PLACE (3 modes)', () => {
    const row1 = [...DAILY_ROW1.slice(0, 8), 'Modes de ventes', null, null, null, null, null];
    const row2 = [
      ...DAILY_ROW2.slice(0, 8),
      'A EMPORTER / Total TTC', 'A EMPORTER / Nombre de tickets',
      'SUR PLACE / Total TTC', 'SUR PLACE / Nombre de tickets',
      'LIVRAISON / Total TTC', 'LIVRAISON / Nombre de tickets',
    ];
    // Total HT deliberately equals Total TTC (no Taxes group in this fixture,
    // so tax_cents sums to 0) — isolates this test to sales-mode summation.
    const rows = [
      row1,
      row2,
      ['2026-03-01', 15, 6.67, 6.41, 100, 100, 100, 0, 30, 3, 30, 3, 40, 9],
      [null, 15, 6.67, 6.41, 100, 100, 100, 0, 30, 3, 30, 3, 40, 9],
    ];
    const { statement, validation } = parseDailySummary(dailySummaryExtraction(rows));
    expect(statement.days[0].sales_by_mode).toHaveLength(3);
    expect(validation.errors).toEqual([]); // 30+30+40 = 100 = Total TTC
  });

  it('fails loudly when the sales-mode sum disagrees with Total TTC', () => {
    const rows = [
      DAILY_ROW1,
      DAILY_ROW2,
      ['2026-01-01', 10, 10, 9.62, 100, 96.15, 100, 0, 60, 6, 30, 4, 100, 96.15, 3.85], // 60+30=90 ≠ 100
      [null, 10, 10, 9.62, 100, 96.15, 100, 0, 60, 6, 30, 4, 100, 96.15, 3.85],
    ];
    const { validation } = parseDailySummary(dailySummaryExtraction(rows));
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('modes de vente'))).toBe(true);
  });

  it('fails loudly when Total HT + taxes disagrees with Total TTC', () => {
    const rows = [
      DAILY_ROW1,
      DAILY_ROW2,
      ['2026-01-01', 10, 10, 9.62, 100, 90, 100, 0, 60, 6, 40, 4, 100, 90, 3.85], // 90+3.85 ≠ 100
      [null, 10, 10, 9.62, 100, 90, 100, 0, 60, 6, 40, 4, 100, 90, 3.85],
    ];
    const { validation } = parseDailySummary(dailySummaryExtraction(rows));
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Total HT + taxes'))).toBe(true);
  });

  it('reports a missing total row rather than inventing one', () => {
    const rows = [
      DAILY_ROW1,
      DAILY_ROW2,
      ['2026-01-01', 10, 10, 9.62, 100, 96.15, 100, 0, 60, 6, 40, 4, 100, 96.15, 3.85],
    ];
    const { statement, validation } = parseDailySummary(dailySummaryExtraction(rows));
    expect(statement.printed_total).toBeNull();
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('ligne de total introuvable'))).toBe(true);
  });

  it('never treats payment/vendor sum mismatches as blocking errors (informational only)', () => {
    // Modes de ventes sums correctly (100 = Total TTC) and Total HT = Total
    // TTC (no Taxes group) so only the deliberately-mismatched Encaissements
    // group is under test here.
    const row1 = [...DAILY_ROW1.slice(0, 8), 'Modes de ventes', null, 'Encaissements', null];
    const row2 = [
      ...DAILY_ROW2.slice(0, 8),
      'A EMPORTER / Total TTC', 'A EMPORTER / Nombre de tickets',
      'ESPECES / Quantité', 'ESPECES / Total',
    ];
    const rows = [
      row1,
      row2,
      ['2026-01-01', 10, 10, 9.62, 100, 100, 100, 0, 100, 10, 5, 90], // payments sum 90 ≠ 100
      [null, 10, 10, 9.62, 100, 100, 100, 0, 100, 10, 5, 90],
    ];
    const { validation } = parseDailySummary(dailySummaryExtraction(rows));
    expect(validation.valid).toBe(true); // never a hard error
    expect(validation.warnings.some((w) => w.includes('encaissements'))).toBe(true);
  });
});

const PRODUITS_HEADER = [
  'Produit', 'Quantité', 'Quantité décimale', '%Qté', 'CA TTC', '%CA TTC', 'CA HT', 'Offerts', 'Remises', 'PU',
  'Codes barre', 'Dernière vente', 'Rubrique',
];
const RUBRIQUES_HEADER = [
  'Rubrique', 'Produit', 'Quantité', 'Quantité décimale', '%Qté', 'CA TTC', '%CA TTC', 'CA HT', 'Offerts', 'Remises',
  'PU', 'Codes barre', 'Dernière vente',
];

describe('parseProductRanking', () => {
  it('parses products, cross-checks category subtotals and grand total, all consistent', () => {
    const produitsRows = [
      PRODUITS_HEADER,
      ['CAFE', 100, null, 50, 500, 50, 480.77, 2, 0, 5, null, '2026-07-01 10:00:00', 'BOISSONS'],
      ['THE', 50, null, 25, 250, 25, 240.38, 0, 1, 5, null, '2026-07-02 11:00:00', 'BOISSONS'],
      ['Total général', 150, null, null, 750, null, 721.15, 2],
    ];
    const rubriquesRows = [
      RUBRIQUES_HEADER,
      ['BOISSONS'],
      [null, 'CAFE', 100, null, 50, 500, 50, 480.77, 2, 0, 5, null, '2026-07-01 10:00:00'],
      [null, 'THE', 50, null, 25, 250, 25, 240.38, 0, 1, 5, null, '2026-07-02 11:00:00'],
      ['Total BOISSONS', null, 150, null, 75, 750, 75, 721.15, 2],
      [],
      ['Total général', null, 150, null, null, 750, null, 721.15, 2],
    ];
    const { statement, validation } = parseProductRanking(productRankingExtraction(produitsRows, rubriquesRows));

    expect(statement.products).toHaveLength(2);
    expect(statement.category_subtotals).toEqual([
      { category_name: 'BOISSONS', quantity: 150, revenue_ttc_cents: 75000, revenue_ht_cents: 72115, complimentary_qty: 2 },
    ]);
    expect(statement.grand_total).toEqual({ quantity: 150, revenue_ttc_cents: 75000, revenue_ht_cents: 72115, complimentary_qty: 2 });
    expect(validation.valid).toBe(true);
  });

  it('fails loudly when the grand total disagrees with the recomputed sum of products', () => {
    const produitsRows = [
      PRODUITS_HEADER,
      ['CAFE', 100, null, 100, 500, 100, 480.77, 0, 0, 5, null, '2026-07-01 10:00:00', 'BOISSONS'],
      ['Total général', 999, null, null, 500, null, 480.77, 0], // wrong quantity
    ];
    const { validation } = parseProductRanking(productRankingExtraction(produitsRows, []));
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Total général'))).toBe(true);
  });

  it('fails loudly when a category subtotal disagrees with the recomputed sum', () => {
    const produitsRows = [
      PRODUITS_HEADER,
      ['CAFE', 100, null, 100, 500, 100, 480.77, 0, 0, 5, null, '2026-07-01 10:00:00', 'BOISSONS'],
      ['Total général', 100, null, null, 500, null, 480.77, 0],
    ];
    const rubriquesRows = [
      RUBRIQUES_HEADER,
      ['BOISSONS'],
      [null, 'CAFE', 100, null, 100, 500, 100, 480.77, 0, 0, 5, null, '2026-07-01 10:00:00'],
      ['Total BOISSONS', null, 999, null, 100, 500, 100, 480.77, 0], // wrong quantity
      [],
      ['Total général', null, 100, null, null, 500, null, 480.77, 0],
    ];
    const { validation } = parseProductRanking(productRankingExtraction(produitsRows, rubriquesRows));
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('BOISSONS'))).toBe(true);
  });

  it('never infers the period from "Dernière vente" — stays unknown without an explicit override', () => {
    const produitsRows = [
      PRODUITS_HEADER,
      ['CAFE', 1, null, 100, 5, 100, 4.8, 0, 0, 5, null, '2020-01-01 00:00:00', 'BOISSONS'],
      ['Total général', 1, null, null, 5, null, 4.8, 0],
    ];
    const { statement, validation } = parseProductRanking(productRankingExtraction(produitsRows, []));
    expect(statement.period_status).toBe('unknown');
    expect(statement.period_start).toBeNull();
    expect(statement.period_end).toBeNull();
    expect(validation.warnings.some((w) => w.includes('Période non fournie'))).toBe(true);
  });

  it('accepts an explicit period override and marks it as such', () => {
    const produitsRows = [
      PRODUITS_HEADER,
      ['CAFE', 1, null, 100, 5, 100, 4.8, 0, 0, 5, null, '2026-07-01 00:00:00', 'BOISSONS'],
      ['Total général', 1, null, null, 5, null, 4.8, 0],
    ];
    const { statement } = parseProductRanking(
      productRankingExtraction(produitsRows, []),
      { periodStart: '2026-01-01', periodEnd: '2026-07-16' }
    );
    expect(statement.period_status).toBe('explicit');
    expect(statement.period_start).toBe('2026-01-01');
    expect(statement.period_end).toBe('2026-07-16');
  });

  it('keeps discounts as neutral raw/parsed fields, never assuming count vs. amount semantics', () => {
    const produitsRows = [
      PRODUITS_HEADER,
      ['CAFE', 1, null, 100, 5, 100, 4.8, 0, 7, 5, null, '2026-07-01 00:00:00', 'BOISSONS'],
      ['Total général', 1, null, null, 5, null, 4.8, 0],
    ];
    const { statement } = parseProductRanking(productRankingExtraction(produitsRows, []));
    expect(statement.products[0].discounts_raw).toBe('7');
    expect(statement.products[0].discounts_value).toBe(7);
  });
});

describe('parsePosAddictill', () => {
  it('never invents a report type for an unrecognized file', () => {
    const { reportType, statement, validation } = parsePosAddictill({
      sheets: [{ name: 'Sheet1', rows: [['random', 'data']] }],
    });
    expect(reportType).toBeNull();
    expect(statement).toBeNull();
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('UNSUPPORTED_ADDICTILL_REPORT');
  });

  it('recognizes a sales journal but never fabricates its extraction (no real file to verify column layout against)', () => {
    const { reportType, statement, validation } = parsePosAddictill({
      sheets: [{ name: 'Worksheet', rows: [['Journal de ventes'], ['Date', 'Libellé']] }],
    });
    expect(reportType).toBe('sales_journal');
    expect(statement).toBeNull();
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('ADDICTILL_REPORT_NOT_YET_SUPPORTED');
  });
});

describe('recipe-mapping — normalizeProductKey', () => {
  it('normalizes case and whitespace for exact matching', () => {
    expect(normalizeProductKey('  Café   Latte ')).toBe('CAFÉ LATTE');
  });
});

describe('recipe-mapping — annotateProductsWithMapping', () => {
  const product = (name) => ({
    product_name: name,
    category_name: null,
    quantity: 1,
    quantity_decimal: null,
    revenue_ttc_cents: 100,
    revenue_ht_cents: 96,
    complimentary_qty: 0,
    discounts_raw: null,
    discounts_value: null,
    unit_price_cents: null,
    barcode: null,
    last_sale_at: null,
    source_sheet: 'Produits',
    source_row: 2,
    mapping_status: 'unmapped',
  });

  it('marks an exact-match product as mapped and reports the rest as unmapped', () => {
    const mappings = new Map([['CAFE', 'moka-cafe']]);
    const { products, unmapped_products: unmapped } = annotateProductsWithMapping(
      [product('Cafe'), product('THE INCONNU')],
      mappings
    );
    expect(products[0].mapping_status).toBe('mapped');
    expect(products[1].mapping_status).toBe('unmapped');
    expect(unmapped).toEqual(['THE INCONNU']);
  });

  it('never fuzzy-matches — a near-miss name stays unmapped', () => {
    const mappings = new Map([['CAFE LATTE', 'moka-latte']]);
    const { products } = annotateProductsWithMapping([product('Cafe Latte Large')], mappings);
    expect(products[0].mapping_status).toBe('unmapped');
  });
});
