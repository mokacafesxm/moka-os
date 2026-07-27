import { describe, it, expect } from 'vitest';

import {
  BANK_PROFILES,
  detectBankProfile,
  normalizeLabel,
  extractReference,
  buildTransactionImportKey,
  buildColumnQueues,
  validateBankStatement,
  parseBankStatementFromText,
} from '../../parsers/bank-statement.js';

/**
 * Builds the getTable()-shaped `tables` entry for one page: a single table
 * containing a single merged "transactions row", matching the real Crédit
 * Mutuel layout confirmed against 3 real statements (see
 * docs/ARCHITECTURE.md "PR2A") — dates/value-dates space-separated,
 * operation/débit/crédit newline-separated.
 */
function buildPageTable({ dates, valueDates, operationLines, debitAmounts, creditAmounts }) {
  const row = [
    dates.join(' '),
    valueDates.join(' '),
    operationLines.join('\n'),
    debitAmounts.join('\n'),
    creditAmounts.join('\n'),
  ];
  return [[row]];
}

/**
 * Builds a minimal single-page Crédit Mutuel statement's `{ text, pages,
 * tables }`, with sensible defaults every scenario can override.
 * `transactions`: [{ date, valueDate, label, type: 'debit'|'credit', amount }]
 */
function buildStatement({
  devise = 'euros',
  openingLine = 'SOLDE CREDITEUR AU 31/03/2026\t1.000,00',
  transactions = [{ date: '05/04/2026', valueDate: '05/04/2026', label: 'VIR TEST', type: 'credit', amount: '100,00' }],
  totalMovementsLine,
  closingLine = 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t1.100,00',
  includeAccountLine = true,
}) {
  const lines = ['CREDIT MUTUEL'];
  if (includeAccountLine) {
    lines.push(`C/C EUROCOMPTE PRO N° 00021911203 en ${devise} (GD)`);
  }
  lines.push('IBAN : FR76 1027 8053 6000 0219 1120 371', '28 avril 2026', openingLine);

  for (const tx of transactions) {
    lines.push(`${tx.date} ${tx.valueDate} ${tx.label} ${tx.amount}`);
    for (const cont of tx.continuations ?? []) lines.push(cont);
  }

  const debitAmounts = transactions.filter((t) => t.type === 'debit').map((t) => t.amount);
  const creditAmounts = transactions.filter((t) => t.type === 'credit').map((t) => t.amount);
  const computedTotalLine = `Total des mouvements\t${sumFrench(debitAmounts)}\t${sumFrench(creditAmounts)}`;
  lines.push(totalMovementsLine === null ? undefined : totalMovementsLine ?? computedTotalLine);
  if (closingLine) lines.push(closingLine);

  const pageText = lines.filter((l) => l !== undefined).join('\n');
  const tables = [
    buildPageTable({
      dates: transactions.map((t) => t.date),
      valueDates: transactions.map((t) => t.valueDate),
      operationLines: transactions.map((t) => t.label),
      debitAmounts,
      creditAmounts,
    }),
  ];

  return { text: pageText, pages: [pageText], tables };
}

/** Sums French-formatted (period-thousands, comma-decimal) amounts into the same format, for building a matching "Total des mouvements" line. */
function sumFrench(amounts) {
  const totalCents = amounts.reduce((sum, raw) => {
    const cents = Math.round(parseFloat(raw.replace(/\./g, '').replace(',', '.')) * 100);
    return sum + cents;
  }, 0);
  const euros = Math.floor(totalCents / 100);
  const cents = String(totalCents % 100).padStart(2, '0');
  return `${euros},${cents}`;
}

describe('detectBankProfile', () => {
  it('recognizes a Crédit Mutuel document', () => {
    expect(detectBankProfile(buildStatement({}).text)).toBe('credit_mutuel');
  });

  it('returns null for an unrecognized bank', () => {
    expect(detectBankProfile('SOME OTHER BANK\nRELEVE DE COMPTE\n')).toBeNull();
  });
});

describe('parseBankStatementFromText — unsupported profile', () => {
  it('never invents a statement when no profile matches', () => {
    const { statement, validation } = parseBankStatementFromText({
      text: 'UNKNOWN BANK STATEMENT',
      pages: ['UNKNOWN BANK STATEMENT'],
      tables: [[]],
    });
    expect(statement.bank_name).toBeNull();
    expect(statement.transactions).toEqual([]);
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('UNSUPPORTED_BANK_PROFILE');
  });
});

describe('parseBankStatementFromText — core scenarios', () => {
  it('parses a statement with a nil opening balance (USD account)', () => {
    const fixture = buildStatement({
      devise: 'dollars',
      openingLine: 'SOLDE CREDITEUR AU 31/03/2026\t0,00',
      transactions: [
        { date: '05/04/2026', valueDate: '05/04/2026', label: 'VIR SEPA CLIENT ALPHA', type: 'credit', amount: '14.976,50' },
        { date: '10/04/2026', valueDate: '10/04/2026', label: 'CB FOURNISSEUR X', type: 'debit', amount: '3,50' },
      ],
      closingLine: 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t14.973,00',
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.currency).toBe('USD');
    expect(statement.opening_balance_cents).toBe(0);
    expect(statement.closing_balance_cents).toBe(1497300);
    expect(validation.valid).toBe(true);
  });

  it('parses a plausible USD May statement', () => {
    const fixture = buildStatement({
      devise: 'dollars',
      openingLine: 'SOLDE CREDITEUR AU 30/04/2026\t14.973,00',
      transactions: [
        { date: '02/05/2026', valueDate: '02/05/2026', label: 'VIR SEPA CLIENT GAMMA', type: 'credit', amount: '500,00' },
        { date: '18/05/2026', valueDate: '18/05/2026', label: 'PRLV ASSURANCE', type: 'debit', amount: '45,00' },
      ],
      closingLine: 'Réf : 002\tSOLDE CREDITEUR AU 29/05/2026\t15.428,00',
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.currency).toBe('USD');
    expect(statement.transactions).toHaveLength(2);
    expect(validation.valid).toBe(true);
  });

  it('parses a plausible USD June statement', () => {
    const fixture = buildStatement({
      devise: 'dollars',
      openingLine: 'SOLDE CREDITEUR AU 29/05/2026\t15.428,00',
      transactions: [{ date: '15/06/2026', valueDate: '15/06/2026', label: 'CB FOURNISSEUR Y', type: 'debit', amount: '228,00' }],
      closingLine: 'Réf : 003\tSOLDE CREDITEUR AU 30/06/2026\t15.200,00',
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.transactions).toHaveLength(1);
    expect(validation.valid).toBe(true);
  });

  it('handles a label spanning several continuation lines', () => {
    const fixture = buildStatement({
      transactions: [
        {
          date: '05/04/2026',
          valueDate: '05/04/2026',
          label: 'VIR SEPA CLIENT DELTA',
          type: 'credit',
          amount: '300,00',
          continuations: ['MOTIF ACOMPTE COMMANDE', 'RUM : FR7612345678', 'ICS : FR47EDF001007'],
        },
      ],
      closingLine: 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t1.300,00',
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.transactions).toHaveLength(1);
    const tx = statement.transactions[0];
    expect(tx.raw_label.split('\n')).toHaveLength(4);
    expect(tx.reference).toBe('FR7612345678'); // RUM takes priority over ICS
    expect(validation.valid).toBe(true);
  });

  it('parses a debit-only transaction', () => {
    const fixture = buildStatement({
      transactions: [{ date: '10/04/2026', valueDate: '10/04/2026', label: 'PRLV EDF', type: 'debit', amount: '60,00' }],
      closingLine: 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t940,00',
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    const [tx] = statement.transactions;
    expect(tx.debit_cents).toBe(6000);
    expect(tx.credit_cents).toBe(0);
    expect(tx.amount_cents).toBe(-6000);
    expect(validation.valid).toBe(true);
  });

  it('parses a credit-only transaction', () => {
    const fixture = buildStatement({
      transactions: [{ date: '10/04/2026', valueDate: '10/04/2026', label: 'VIR RECU CLIENT', type: 'credit', amount: '250,00' }],
      closingLine: 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t1.250,00',
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    const [tx] = statement.transactions;
    expect(tx.credit_cents).toBe(25000);
    expect(tx.debit_cents).toBe(0);
    expect(validation.valid).toBe(true);
  });

  it('parses French period-grouped thousands and small amounts correctly (14.976,50 and 3,50)', () => {
    const fixture = buildStatement({
      openingLine: 'SOLDE CREDITEUR AU 31/03/2026\t0,00',
      transactions: [
        { date: '05/04/2026', valueDate: '05/04/2026', label: 'VIR SEPA GROS CLIENT', type: 'credit', amount: '14.976,50' },
        { date: '06/04/2026', valueDate: '06/04/2026', label: 'CB PETIT ACHAT', type: 'debit', amount: '3,50' },
      ],
      closingLine: 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t14.973,00',
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.transactions[0].credit_cents).toBe(1497650);
    expect(statement.transactions[1].debit_cents).toBe(350);
    expect(validation.valid).toBe(true);
  });

  it('recomputes totals from transactions and cross-checks both the balance equation and the printed "Total des mouvements"', () => {
    const fixture = buildStatement({
      openingLine: 'SOLDE CREDITEUR AU 31/03/2026\t1.000,00',
      transactions: [
        { date: '05/04/2026', valueDate: '05/04/2026', label: 'VIR A', type: 'credit', amount: '500,00' },
        { date: '06/04/2026', valueDate: '06/04/2026', label: 'VIR B', type: 'debit', amount: '200,00' },
        { date: '07/04/2026', valueDate: '07/04/2026', label: 'VIR C', type: 'debit', amount: '50,00' },
      ],
      closingLine: 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t1.250,00',
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.total_credits_cents).toBe(50000);
    expect(statement.total_debits_cents).toBe(25000);
    expect(statement.printed_total_debits_cents).toBe(25000);
    expect(statement.printed_total_credits_cents).toBe(50000);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('fails loudly when the closing balance is inconsistent with the balance equation', () => {
    const fixture = buildStatement({
      openingLine: 'SOLDE CREDITEUR AU 31/03/2026\t1.000,00',
      transactions: [{ date: '05/04/2026', valueDate: '05/04/2026', label: 'VIR A', type: 'credit', amount: '500,00' }],
      closingLine: 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t2.000,00', // wrong: should be 1.500,00
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.closing_balance_cents).toBe(200000);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('TOTAL_MISMATCH'))).toBe(true);
  });

  it('fails loudly when the printed "Total des mouvements" disagrees with the recomputed sums', () => {
    const fixture = buildStatement({
      openingLine: 'SOLDE CREDITEUR AU 31/03/2026\t1.000,00',
      transactions: [{ date: '05/04/2026', valueDate: '05/04/2026', label: 'VIR A', type: 'credit', amount: '500,00' }],
      totalMovementsLine: 'Total des mouvements\t0,00\t400,00', // wrong: should be 0,00 / 500,00
      closingLine: 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t1.500,00',
    });
    const { validation } = parseBankStatementFromText(fixture);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('TOTAL_MISMATCH') && e.includes('crédits'))).toBe(true);
  });

  it('reports a missing closing balance rather than crashing or inventing one', () => {
    const fixture = buildStatement({ closingLine: null, totalMovementsLine: null });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.closing_balance_cents).toBeNull();
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('solde de clôture'))).toBe(true);
  });

  it('reports a missing currency rather than assuming one', () => {
    const fixture = buildStatement({ includeAccountLine: false });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.currency).toBeNull();
    expect(statement.transactions[0].currency).toBeNull();
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('devise'))).toBe(true);
  });

  it('tracks source_page correctly across 3 pages, including a label continuing across a page break', () => {
    const page1 = [
      'CREDIT MUTUEL',
      'C/C EUROCOMPTE PRO N° 00021911203 en euros (GD)',
      'SOLDE CREDITEUR AU 31/03/2026\t0,00',
      '01/04/2026 01/04/2026 VIR A 100,00',
    ].join('\n');
    const page2 = ['CONTINUATION DE VIR A', '15/04/2026 15/04/2026 VIR B 100,00'].join('\n');
    const page3 = [
      '30/04/2026 30/04/2026 VIR C 100,00',
      'Total des mouvements\t0,00\t300,00',
      'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t300,00',
    ].join('\n');

    const tables = [
      buildPageTable({ dates: ['01/04/2026'], valueDates: ['01/04/2026'], operationLines: ['VIR A'], debitAmounts: [], creditAmounts: ['100,00'] }),
      buildPageTable({ dates: ['15/04/2026'], valueDates: ['15/04/2026'], operationLines: ['VIR B'], debitAmounts: [], creditAmounts: ['100,00'] }),
      buildPageTable({ dates: ['30/04/2026'], valueDates: ['30/04/2026'], operationLines: ['VIR C'], debitAmounts: [], creditAmounts: ['100,00'] }),
    ];

    const { statement, validation } = parseBankStatementFromText({
      text: [page1, page2, page3].join('\n'),
      pages: [page1, page2, page3],
      tables,
    });

    expect(statement.transactions.map((t) => t.source_page)).toEqual([1, 2, 3]);
    expect(statement.transactions[0].raw_label).toContain('CONTINUATION DE VIR A');
    expect(validation.valid).toBe(true);
  });

  it('flags (never silently guesses) a genuine débit/crédit collision: two transactions share the same amount in different columns', () => {
    const fixture = buildStatement({
      openingLine: 'SOLDE CREDITEUR AU 31/03/2026\t0,00',
      transactions: [
        { date: '05/04/2026', valueDate: '05/04/2026', label: 'VIR OUT', type: 'debit', amount: '300,00' },
        { date: '05/04/2026', valueDate: '05/04/2026', label: 'VIR IN', type: 'credit', amount: '300,00' },
      ],
      closingLine: 'Réf : 001\tSOLDE CREDITEUR AU 30/04/2026\t0,00',
    });
    const { statement, validation } = parseBankStatementFromText(fixture);
    expect(statement.transactions).toHaveLength(0); // both dropped, never guessed
    expect(validation.valid).toBe(false);
    expect(validation.warnings.some((w) => w.includes('ambigu'))).toBe(true);
  });
});

describe('buildColumnQueues', () => {
  it('extracts ordered débit/crédit cent amounts per page, skipping balance/total rows', () => {
    const tables = [
      [
        [
          ['Date', 'Date valeur', 'Opération', 'Débit EUROS', 'Crédit EUROS'],
          ['', '', 'SOLDE CREDITEUR AU 31/03/2026', '', '1.000,00'],
          ['05/04/2026', '05/04/2026', 'VIR A\nVIR B', '50,00\n20,00', '100,00'],
          ['Total des mouvements', '70,00', '100,00'],
        ],
      ],
    ];
    const queues = buildColumnQueues(tables);
    expect(queues[0]).toEqual({ debits: [5000, 2000], credits: [10000] });
  });
});

describe('normalizeLabel', () => {
  it('collapses multi-line whitespace into single spaces', () => {
    expect(normalizeLabel('LINE ONE\n  LINE TWO\n\tLINE THREE')).toBe('LINE ONE LINE TWO LINE THREE');
  });
});

describe('extractReference', () => {
  it('extracts a RUM reference (Crédit Mutuel SEPA mandate id)', () => {
    expect(extractReference('PRLV TEST\nRUM : FR76123456')).toBe('FR76123456');
  });

  it('extracts an ICS reference when no RUM is present', () => {
    expect(extractReference('PRLV TEST\nICS : FR47EDF001007')).toBe('FR47EDF001007');
  });

  it('returns null when no reference pattern matches', () => {
    expect(extractReference('SIMPLE LABEL WITH NO REFERENCE')).toBeNull();
  });
});

describe('buildTransactionImportKey', () => {
  const base = {
    accountNumber: '00021911203',
    bookingDate: '2026-04-05',
    amountCents: 100000,
    currency: 'EUR',
    normalizedLabel: 'VIR SEPA TEST',
    reference: null,
  };

  it('is deterministic for identical inputs', () => {
    expect(buildTransactionImportKey(base)).toBe(buildTransactionImportKey({ ...base }));
  });

  it('differs when any component differs', () => {
    const key = buildTransactionImportKey(base);
    expect(buildTransactionImportKey({ ...base, amountCents: 100001 })).not.toBe(key);
    expect(buildTransactionImportKey({ ...base, bookingDate: '2026-04-06' })).not.toBe(key);
    expect(buildTransactionImportKey({ ...base, currency: 'USD' })).not.toBe(key);
  });
});

describe('validateBankStatement — direct unit tests', () => {
  const baseStatement = {
    bank_name: 'Crédit Mutuel',
    account_name: null,
    account_number: null,
    iban: null,
    currency: 'EUR',
    statement_date: null,
    period_start: null,
    period_end: null,
    opening_balance_cents: 1000,
    closing_balance_cents: 1000,
    total_debits_cents: 0,
    total_credits_cents: 0,
    printed_total_debits_cents: null,
    printed_total_credits_cents: null,
    transactions: [],
  };

  it('flags a transaction with both debit and credit set (ambiguous)', () => {
    const statement = {
      ...baseStatement,
      transactions: [
        {
          booking_date: '2026-04-01',
          value_date: null,
          raw_label: 'X',
          normalized_label: 'X',
          debit_cents: 100,
          credit_cents: 100,
          amount_cents: 0,
          currency: 'EUR',
          reference: null,
          source_page: 1,
          import_key: 'x',
        },
      ],
    };
    const result = validateBankStatement(statement);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('ambigu'))).toBe(true);
  });

  it('is valid when everything is consistent', () => {
    const result = validateBankStatement(baseStatement);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('BANK_PROFILES registry — extension point', () => {
  it('exposes credit_mutuel as a registered profile with the expected shape', () => {
    expect(BANK_PROFILES.credit_mutuel).toBeDefined();
    expect(BANK_PROFILES.credit_mutuel.id).toBe('credit_mutuel');
    expect(BANK_PROFILES.credit_mutuel.transactionLinePattern).toBeInstanceOf(RegExp);
  });
});
