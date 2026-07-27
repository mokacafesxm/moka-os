'use strict';

/**
 * Bank statement parser (PR2A) — generic engine + a registry of per-bank
 * "profiles" (signature + field regexes + transaction-line pattern), the
 * same registry-of-adapters shape as classify.js's POS distinction
 * (AddicTill vs L'Addition): the engine never assumes one bank's layout
 * fits another.
 *
 * `credit_mutuel` below is CALIBRATED against 3 real statements (Nov 2025,
 * Jan 2026, Mar 2026 — EUR account, VGEB & CO) — not a guess. Two things
 * remain unverified for lack of a real example: an overdrawn ("SOLDE
 * DEBITEUR") statement, and the USD account. See docs/ARCHITECTURE.md
 * "PR2A" for the full findings.
 *
 * Key technical fact that shaped this design: pdf-parse's getText() (used
 * by extract.js) returns flattened per-page text with no column/x-position
 * data — an empty table cell leaves no trace, so a transaction line with
 * two *unsigned* amount columns (Crédit Mutuel's actual layout: separate
 * "Débit EUROS" / "Crédit EUROS" columns, no +/- sign anywhere) cannot be
 * disambiguated from flat text alone. The fix used here: extract.js also
 * calls pdf-parse's getTable() (positional), and this module cross-
 * references each transaction's flat-text amount against the page's
 * ordered débit/crédit column queues from that table to resolve which
 * column it came from — never guessed from the label (e.g. "VIR ..." is
 * used for both incoming and outgoing transfers, so keyword heuristics on
 * the label would be invented, not derived).
 */

const { createHash } = require('node:crypto');

const { BankStatementSchema, ValidationResultSchema } = require('../schemas');
const { parseAmount, checkBalanceEquation } = require('../validate');

// Bumped independently of IMPORTER_VERSION (lib/importer/schemas.js) — a
// change to this parser's logic (e.g. a new BANK_PROFILES entry, a fix to
// resolveDebitCreditAssignment) doesn't necessarily mean the AddicTill
// parser or the pipeline overall changed. Recorded on every Import Run
// (PR4 audit-trail addendum) so a future parser upgrade stays traceable to
// exactly which documents it did or didn't touch.
const PARSER_VERSION = 'bank-v1.0.0';

const FRENCH_MONTHS = {
  janvier: 1,
  février: 2,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  août: 8,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  decembre: 12,
};

/**
 * @typedef {Object} BankProfile
 * @property {string} id
 * @property {string} bankName
 * @property {RegExp} signaturePattern
 * @property {Object<string, RegExp>} fields
 * @property {RegExp} transactionLinePattern
 * @property {RegExp[]} boilerplatePatterns
 */

/** @type {Record<string, BankProfile>} */
const BANK_PROFILES = {
  credit_mutuel: {
    id: 'credit_mutuel',
    bankName: 'Crédit Mutuel',
    signaturePattern: /cr[ée]dit\s+mutuel/i,
    fields: {
      // "C/C EUROCOMPTE PRO N° 00021911203 en euros (GD)" — repeated on
      // every page; first match's groups are used for the header fields.
      accountLine: /^(.+?)\s+N°\s*(\d+)\s+en\s+(euros?|dollars?|EUR|USD)\b/im,
      iban: /IBAN\s*:?\s*([A-Z]{2}[0-9A-Z ]{10,30}\d)/i,
      bic: /BIC\s*:?\s*([A-Z0-9]{8,11})/i,
      // "28 novembre 2025" — the statement's issuance date, written out.
      statementDateFrench:
        /\b(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\b/i,
      // Same wording for BOTH opening and closing balance — "SOLDE
      // CREDITEUR AU <date>\t<amount>" (or DEBITEUR if overdrawn, unverified
      // against a real example). Distinguished by position: matchAll's
      // first hit is opening, last is closing (see extractHeaderFields).
      balanceLine: /SOLDE\s+(CREDITEUR|DEBITEUR)\s+AU\s+(\d{2}\/\d{2}\/\d{4})[\t ]+([\d][\d.,]*)/gi,
      totalMovements: /Total\s+des\s+mouvements[\t ]+([\d][\d.,]*)[\t ]+([\d][\d.,]*)/i,
      tableHeader: /^Date\s+Date\s+valeur\s+Op[ée]ration/i,
    },
    // DATE DATE LABEL AMOUNT — no sign: which column (débit/crédit) the
    // amount belongs to is resolved via the page's table queues, not this
    // regex. See resolveDebitCredit().
    transactionLinePattern: /^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d][\d.,]*)$/,
    // Recurring letterhead/footer/legal boilerplate confirmed across all 3
    // real statements — must never be appended as a continuation line onto
    // whichever transaction happens to be open when it's encountered
    // (typically true for the per-page repeated header block).
    boilerplatePatterns: [
      /^€$/,
      /^CAISSE DE CREDIT MUTUEL DE SAINT MARTIN/i,
      /^\d+\s+RUE DE LA REPUBLIQUE/i,
      /^TVA intracommunautaire/i,
      /^M[ée]diateur du Cr[ée]dit Mutuel/i,
      /^Pour toute demande sur la bonne/i,
      /^Page\s+\d+/i,
      /^\.{10,}/,
      /^CCM SAINT MARTIN/i,
      /^AGENCE DE/i,
      /820 83 02 34/,
      /^\(GE\)/i,
      /^\(GD\)/i,
      /^www\.garantiedesdepots\.fr/i,
      /^Information sur la protection des comptes/i,
      /^RELEVE ET INFORMATIONS BANCAIRES/i,
      /^<<Suite au verso>>/i,
      /^HT\.\d/i,
      /^Vous disposez d'une carte de paiement/i,
      /^Caisse\s+\d+$/i,
      /^\d{5}$/,
    ],
  },
};

/**
 * Reference patterns tried in priority order against a transaction's full
 * (multi-line) raw label. RUM/ICS are Crédit Mutuel's actual SEPA mandate
 * identifiers (confirmed in real statements); the "donneur d'ordre"/
 * "mandat" patterns are kept as generic fallbacks for other banks. Returns
 * the first match's captured token, or null when none is found — never
 * invented.
 */
const REFERENCE_PATTERNS = [
  /RUM\s*:?\s*(\S+)/i,
  /ICS\s*:?\s*(\S+)/i,
  /R[ée]f\.?\s*donneur\s+d['’]?\s*ordre\s*:?\s*(\S+)/i,
  /R[ée]f\.?\s*du mandat\s*:?\s*(\S+)/i,
  /FACT\s*(\S+)/i,
];

/**
 * @param {string} text - full document text (all pages concatenated)
 * @returns {string|null} matching profile id, or null if none recognized
 */
function detectBankProfile(text) {
  for (const profile of Object.values(BANK_PROFILES)) {
    if (profile.signaturePattern.test(text)) return profile.id;
  }
  return null;
}

/**
 * Collapses a possibly multi-line raw label into a single-line, whitespace-
 * normalized string for matching/dedup purposes.
 * @param {string} rawLabel
 * @returns {string}
 */
function normalizeLabel(rawLabel) {
  return rawLabel.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} rawLabel
 * @returns {string|null}
 */
function extractReference(rawLabel) {
  for (const pattern of REFERENCE_PATTERNS) {
    const match = pattern.exec(rawLabel);
    if (match) return match[1];
  }
  return null;
}

/**
 * Deterministic business dedup key for a bank transaction, per AGENTS.md
 * ("compte + date + montant + devise + libellé normalisé + référence").
 * @param {{accountNumber: string|null, bookingDate: string, amountCents: number, currency: string|null, normalizedLabel: string, reference: string|null}} params
 * @returns {string}
 */
function buildTransactionImportKey({
  accountNumber,
  bookingDate,
  amountCents,
  currency,
  normalizedLabel,
  reference,
}) {
  const material = [
    accountNumber ?? '',
    bookingDate,
    String(amountCents),
    currency ?? '',
    normalizedLabel,
    reference ?? '',
  ].join('|');
  return createHash('sha256').update(material).digest('hex');
}

/**
 * True when `line` is header/metadata/balance/boilerplate for this profile
 * (as opposed to a transaction-start or continuation line).
 * @param {string} line
 * @param {BankProfile} profile
 * @returns {boolean}
 */
function isMetadataLine(line, profile) {
  if (profile.signaturePattern.test(line)) return true;
  if (profile.fields.accountLine.test(line)) return true;
  if (profile.fields.iban.test(line)) return true;
  if (profile.fields.bic.test(line)) return true;
  if (profile.fields.statementDateFrench.test(line)) return true;
  if (profile.fields.tableHeader.test(line)) return true;
  if (profile.fields.totalMovements.test(line)) return true;
  // balanceLine has the 'g' flag; reset lastIndex so repeated .test() calls
  // on different lines don't skip matches due to leftover state.
  profile.fields.balanceLine.lastIndex = 0;
  if (profile.fields.balanceLine.test(line)) return true;
  return profile.boilerplatePatterns.some((pattern) => pattern.test(line));
}

/**
 * Parses "DD mois YYYY" (e.g. "28 novembre 2025") into ISO YYYY-MM-DD.
 * @param {string} day
 * @param {string} monthName
 * @param {string} year
 * @returns {string|null}
 */
function frenchDateToIso(day, monthName, year) {
  const month = FRENCH_MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * True when a table row's "Opération" cell is a balance or totals row
 * rather than the real transactions row — these must never contribute to
 * the débit/crédit column queues.
 * @param {string} operationCell
 * @returns {boolean}
 */
function isBalanceOrTotalRow(operationCell) {
  return (
    /SOLDE\s+(CREDITEUR|DEBITEUR)\s+AU/i.test(operationCell) ||
    /Total\s+des\s+mouvements/i.test(operationCell) ||
    operationCell.trim() === 'Opération'
  );
}

/**
 * Builds, per page, the ordered list of débit and crédit amounts (in
 * cents) from pdf-parse's getTable() output — used to resolve which
 * column an unsigned transaction amount belongs to. See module docstring.
 * Unparseable cell values are dropped (never invented) — this can only
 * ever shrink a queue, which surfaces later as a resolution failure
 * rather than a wrong silent match.
 * @param {Array<Array<Array<string[]>>>} tables - ExtractionResult.tables
 * @returns {Array<{debits: number[], credits: number[]}>}
 */
function buildColumnQueues(tables) {
  return tables.map((pageTables) => {
    const debits = [];
    const credits = [];
    for (const table of pageTables) {
      for (const row of table) {
        if (row.length < 5) continue;
        const operationCell = row[2] ?? '';
        if (isBalanceOrTotalRow(operationCell)) continue;
        const debitCell = row[3] ?? '';
        const creditCell = row[4] ?? '';
        for (const value of debitCell.split('\n').map((v) => v.trim()).filter(Boolean)) {
          const parsed = parseAmount(value);
          if (parsed.ok) debits.push(Math.abs(parsed.amountCents));
        }
        for (const value of creditCell.split('\n').map((v) => v.trim()).filter(Boolean)) {
          const parsed = parseAmount(value);
          if (parsed.ok) credits.push(Math.abs(parsed.amountCents));
        }
      }
    }
    return { debits, credits };
  });
}

/**
 * Finds a complete assignment of each amount in `amounts` (encounter
 * order) to 'debit' or 'credit' such that consuming `debits`/`credits` in
 * their own order exactly reproduces the choices — a small backtracking
 * search, fast for real statement sizes (dozens of lines per page) since
 * branching only happens at genuine value collisions.
 * @param {number[]} amounts
 * @param {number[]} debits
 * @param {number[]} credits
 * @param {'debit'|'credit'} preference - which branch to try first at a tie
 * @returns {('debit'|'credit')[] | null}
 */
function solveDebitCreditAssignment(amounts, debits, credits, preference) {
  const memo = new Map();

  function solve(i, d, c) {
    if (i === amounts.length) {
      return d === debits.length && c === credits.length ? [] : null;
    }
    const key = `${i},${d},${c}`;
    if (memo.has(key)) return memo.get(key);

    const target = amounts[i];
    const debitMatches = d < debits.length && debits[d] === target;
    const creditMatches = c < credits.length && credits[c] === target;
    const order = preference === 'debit' ? ['debit', 'credit'] : ['credit', 'debit'];

    let result = null;
    for (const branch of order) {
      if (result !== null) break;
      if (branch === 'debit' && debitMatches) {
        const rest = solve(i + 1, d + 1, c);
        if (rest !== null) result = ['debit', ...rest];
      }
      if (branch === 'credit' && creditMatches) {
        const rest = solve(i + 1, d, c + 1);
        if (rest !== null) result = ['credit', ...rest];
      }
    }

    memo.set(key, result);
    return result;
  }

  return solve(0, 0, 0);
}

/**
 * Resolves which of two ordered amount queues (débit, crédit) each amount
 * in `amounts` (encounter order) was drawn from. Plain "match whichever
 * queue's head equals this amount, preferring débit" is NOT safe: real
 * statements do have same-amount débit/crédit transactions back to back
 * (e.g. two distinct 3.000,00 transfers, one out one in) — and crucially,
 * swapping which of two equal-value transactions is the débit and which
 * is the crédit changes NEITHER total, so no amount of balance-checking
 * can distinguish the correct pairing from the swapped one. Rather than
 * silently picking one (wrong roughly half the time when this happens),
 * this solves twice — once preferring débit at each tie, once preferring
 * crédit — and only trusts positions where both agree. Positions where
 * they disagree are genuinely ambiguous from this data alone and are left
 * unresolved (null) for the caller to flag rather than invent.
 * @param {number[]} amounts - transaction amounts in cents, encounter order
 * @param {number[]} debits - débit column amounts in cents, column order
 * @param {number[]} credits - crédit column amounts in cents, column order
 * @returns {{ assignment: (('debit'|'credit')|null)[], ambiguousCount: number } | null} null when no valid assignment exists at all
 */
function resolveDebitCreditAssignment(amounts, debits, credits) {
  const preferDebit = solveDebitCreditAssignment(amounts, debits, credits, 'debit');
  const preferCredit = solveDebitCreditAssignment(amounts, debits, credits, 'credit');

  if (!preferDebit || !preferCredit) return null;

  let ambiguousCount = 0;
  const assignment = preferDebit.map((value, i) => {
    if (value === preferCredit[i]) return value;
    ambiguousCount += 1;
    return null;
  });

  return { assignment, ambiguousCount };
}

/**
 * Extracts the header fields (account/IBAN/currency/balances/totals) from
 * the full document text. Every field degrades to null on no-match or
 * unparseable content — never invented.
 * @param {string} text
 * @param {BankProfile} profile
 */
function extractHeaderFields(text, profile) {
  const header = {
    bank_name: profile.bankName,
    account_name: null,
    account_number: null,
    iban: null,
    currency: null,
    statement_date: null,
    period_start: null,
    period_end: null,
    opening_balance_cents: null,
    closing_balance_cents: null,
    printed_total_debits_cents: null,
    printed_total_credits_cents: null,
  };

  const accountMatch = profile.fields.accountLine.exec(text);
  if (accountMatch) {
    header.account_name = accountMatch[1].trim();
    header.account_number = accountMatch[2];
    const currencyWord = accountMatch[3].toLowerCase();
    header.currency = currencyWord.startsWith('euro') ? 'EUR' : 'USD';
  }

  const ibanMatch = profile.fields.iban.exec(text);
  if (ibanMatch) header.iban = ibanMatch[1].replace(/\s+/g, '');

  const statementDateMatch = profile.fields.statementDateFrench.exec(text);
  if (statementDateMatch) {
    const iso = frenchDateToIso(statementDateMatch[1], statementDateMatch[2], statementDateMatch[3]);
    if (iso) header.statement_date = iso;
  }

  const totalMatch = profile.fields.totalMovements.exec(text);
  if (totalMatch) {
    const debitsParsed = parseAmount(totalMatch[1]);
    const creditsParsed = parseAmount(totalMatch[2]);
    if (debitsParsed.ok) header.printed_total_debits_cents = debitsParsed.amountCents;
    if (creditsParsed.ok) header.printed_total_credits_cents = creditsParsed.amountCents;
  }

  // Opening and closing balances share the same "SOLDE ... AU" wording —
  // first match in document order is opening, last is closing.
  const balanceMatches = Array.from(text.matchAll(profile.fields.balanceLine));
  const toSignedCents = (sign, rawAmount) => {
    const parsed = parseAmount(rawAmount);
    if (!parsed.ok) return null;
    return sign.toUpperCase() === 'DEBITEUR' ? -Math.abs(parsed.amountCents) : Math.abs(parsed.amountCents);
  };
  if (balanceMatches.length >= 1) {
    const opening = balanceMatches[0];
    const cents = toSignedCents(opening[1], opening[3]);
    if (cents !== null) {
      header.opening_balance_cents = cents;
      header.period_start = opening[2].split('/').reverse().join('-');
    }
  }
  if (balanceMatches.length >= 2) {
    const closing = balanceMatches[balanceMatches.length - 1];
    const cents = toSignedCents(closing[1], closing[3]);
    if (cents !== null) {
      header.closing_balance_cents = cents;
      header.period_end = closing[2].split('/').reverse().join('-');
    }
  }

  return header;
}

/**
 * Business-rule validation for a parsed statement: closing/opening balance
 * and currency presence, per-transaction debit/credit consistency, the
 * opening+credits-debits=closing identity, AND (when the statement prints
 * its own totals) a cross-check against those printed totals. Never
 * corrects anything silently — only reports.
 * @param {import('../schemas').BankStatement} statement
 * @param {{parseWarnings?: string[]}} [extra]
 * @returns {import('../schemas').BankValidationResult}
 */
function validateBankStatement(statement, extra = {}) {
  const errors = [];
  const warnings = [...(extra.parseWarnings ?? [])];

  if (statement.opening_balance_cents === null) {
    errors.push('VALIDATION_ERROR: solde d\'ouverture introuvable ou illisible');
  }
  if (statement.closing_balance_cents === null) {
    errors.push('VALIDATION_ERROR: solde de clôture introuvable ou illisible');
  }
  if (statement.currency === null) {
    errors.push('VALIDATION_ERROR: devise du relevé introuvable');
  }

  for (const tx of statement.transactions) {
    const hasDebit = tx.debit_cents > 0;
    const hasCredit = tx.credit_cents > 0;
    if (hasDebit === hasCredit) {
      errors.push(
        `VALIDATION_ERROR: transaction au débit/crédit ambigu (${tx.booking_date} — "${tx.normalized_label}")`
      );
    }
    if (tx.currency === null) {
      errors.push(`VALIDATION_ERROR: devise de transaction manquante (${tx.booking_date})`);
    }
  }

  if (statement.opening_balance_cents !== null && statement.closing_balance_cents !== null) {
    const equation = checkBalanceEquation({
      openingBalanceCents: statement.opening_balance_cents,
      totalCreditsCents: statement.total_credits_cents,
      totalDebitsCents: statement.total_debits_cents,
      closingBalanceCents: statement.closing_balance_cents,
    });
    if (!equation.ok) {
      errors.push(
        `TOTAL_MISMATCH: solde de clôture attendu ${equation.expectedClosingBalanceCents} centimes ` +
          `(ouverture + crédits - débits), solde affiché ${statement.closing_balance_cents} centimes ` +
          `(écart ${equation.differenceCents} centimes)`
      );
    }
  }

  if (statement.printed_total_debits_cents !== null && statement.printed_total_debits_cents !== statement.total_debits_cents) {
    errors.push(
      `TOTAL_MISMATCH: total des débits recalculé ${statement.total_debits_cents} centimes ≠ ` +
        `total affiché ${statement.printed_total_debits_cents} centimes`
    );
  }
  if (statement.printed_total_credits_cents !== null && statement.printed_total_credits_cents !== statement.total_credits_cents) {
    errors.push(
      `TOTAL_MISMATCH: total des crédits recalculé ${statement.total_credits_cents} centimes ≠ ` +
        `total affiché ${statement.printed_total_credits_cents} centimes`
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Builds the empty/shell statement returned when no bank profile matches
 * or the input has no usable text — never invented, always explicit nulls.
 */
function emptyStatement() {
  return {
    bank_name: null,
    account_name: null,
    account_number: null,
    iban: null,
    currency: null,
    statement_date: null,
    period_start: null,
    period_end: null,
    opening_balance_cents: null,
    closing_balance_cents: null,
    total_debits_cents: 0,
    total_credits_cents: 0,
    printed_total_debits_cents: null,
    printed_total_credits_cents: null,
    transactions: [],
  };
}

/**
 * Parses a bank statement from already-extracted `{ text, pages, tables }`
 * (the shape of an ExtractionResult's pdf fields).
 * @param {{text: string, pages: string[], tables: Array<Array<Array<string[]>>>|null}} extracted
 * @param {{profileId?: string}} [options] - override auto-detection (tests only)
 * @returns {{statement: import('../schemas').BankStatement, validation: import('../schemas').BankValidationResult}}
 */
function parseBankStatementFromText({ text, pages, tables }, options = {}) {
  const profileId = options.profileId ?? detectBankProfile(text);
  const profile = profileId ? BANK_PROFILES[profileId] : null;

  if (!profile) {
    return {
      statement: BankStatementSchema.parse(emptyStatement()),
      validation: ValidationResultSchema.parse({
        valid: false,
        errors: ['UNSUPPORTED_BANK_PROFILE: aucun profil de banque reconnu pour ce document'],
        warnings: [],
      }),
    };
  }

  const header = extractHeaderFields(text, profile);
  const columnQueues = buildColumnQueues(tables ?? pages.map(() => []));
  const parseWarnings = [];

  // Pass 1 (structural): walk every line, exactly as before, but defer
  // debit/credit resolution — a transaction only knows its unsigned
  // magnitude at this point. `current`/`pending` persist across page
  // boundaries on purpose: a label can legitimately continue onto the next
  // page (confirmed in real statements), so finalizing must not be
  // triggered by a page break, only by the next transaction-start/metadata
  // line or end of document.
  const pending = [];

  /** @type {null | {booking_date: string, value_date: string|null, rawLabelLines: string[], magnitudeCents: number, source_page: number}} */
  let current = null;

  const finalizeCurrent = () => {
    if (!current) return;
    pending.push(current);
    current = null;
  };

  pages.forEach((pageText, pageIndex) => {
    const sourcePage = pageIndex + 1;
    const lines = pageText.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line === '') continue;

      if (isMetadataLine(line, profile)) {
        finalizeCurrent();
        continue;
      }

      const txMatch = profile.transactionLinePattern.exec(line);
      if (txMatch) {
        const [, bookingRaw, valueRaw, label, amountRaw] = txMatch;
        const bookingIso = parseDdMmYyyy(bookingRaw);
        const valueIso = parseDdMmYyyy(valueRaw);
        const amount = parseAmount(amountRaw);

        if (!bookingIso || !amount.ok) {
          parseWarnings.push(
            `Ligne de transaction ignorée (date ou montant illisible) page ${sourcePage}: "${line}"`
          );
          continue;
        }

        finalizeCurrent();
        current = {
          booking_date: bookingIso,
          value_date: valueIso,
          rawLabelLines: [label.trim()],
          magnitudeCents: Math.abs(amount.amountCents),
          source_page: sourcePage,
        };
        continue;
      }

      if (current) {
        current.rawLabelLines.push(line);
      }
    }
  });
  finalizeCurrent();

  // Pass 2 (débit/crédit resolution): group pending transactions by the
  // page their amount was found on (that's what columnQueues is scoped
  // to), and solve the assignment per page. `pending` is already in
  // overall document order and pages are processed 0..N in order above, so
  // grouping by page here cannot reorder transactions relative to each
  // other — no separate sort needed before the final concatenation.
  const transactions = [];
  const pageCount = pages.length;
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const sourcePage = pageIndex + 1;
    const pagePending = pending.filter((tx) => tx.source_page === sourcePage);
    if (pagePending.length === 0) continue;

    const queues = columnQueues[pageIndex] ?? { debits: [], credits: [] };
    const amounts = pagePending.map((tx) => tx.magnitudeCents);
    const resolution = resolveDebitCreditAssignment(amounts, queues.debits, queues.credits);

    if (!resolution) {
      parseWarnings.push(
        `Impossible d'associer les montants débit/crédit aux transactions de la page ${sourcePage} ` +
          `(colonnes de tableau indisponibles ou désynchronisées) — ${pagePending.length} transaction(s) ignorée(s).`
      );
      continue;
    }
    if (resolution.ambiguousCount > 0) {
      parseWarnings.push(
        `${resolution.ambiguousCount} transaction(s) page ${sourcePage} ont un débit/crédit ambigu ` +
          `(deux transactions ou plus partagent le même montant dans des colonnes différentes — ` +
          `ignorées plutôt que devinées, voir docs/ARCHITECTURE.md "PR2A").`
      );
    }

    pagePending.forEach((tx, i) => {
      const type = resolution.assignment[i];
      if (type === null) return; // genuinely ambiguous — never invented, see warning above
      const debitCents = type === 'debit' ? tx.magnitudeCents : 0;
      const creditCents = type === 'credit' ? tx.magnitudeCents : 0;
      const rawLabel = tx.rawLabelLines.join('\n');
      const normalizedLabel = normalizeLabel(rawLabel);
      const reference = extractReference(rawLabel);
      const amountCents = creditCents - debitCents;
      const importKey = buildTransactionImportKey({
        accountNumber: header.account_number,
        bookingDate: tx.booking_date,
        amountCents,
        currency: header.currency,
        normalizedLabel,
        reference,
      });
      transactions.push({
        booking_date: tx.booking_date,
        value_date: tx.value_date,
        raw_label: rawLabel,
        normalized_label: normalizedLabel,
        debit_cents: debitCents,
        credit_cents: creditCents,
        amount_cents: amountCents,
        currency: header.currency,
        reference,
        source_page: tx.source_page,
        import_key: importKey,
      });
    });
  }

  const totalDebitsCents = transactions.reduce((sum, tx) => sum + tx.debit_cents, 0);
  const totalCreditsCents = transactions.reduce((sum, tx) => sum + tx.credit_cents, 0);

  const statement = BankStatementSchema.parse({
    ...header,
    total_debits_cents: totalDebitsCents,
    total_credits_cents: totalCreditsCents,
    transactions,
  });

  const validation = ValidationResultSchema.parse(
    validateBankStatement(statement, { parseWarnings })
  );

  return { statement, validation };
}

/**
 * Parses "DD/MM/YYYY" into ISO YYYY-MM-DD, or null if not a real calendar
 * date. Kept local (not validate.js::parseDate) because this profile only
 * ever sees unambiguous DD/MM/YYYY — no locale guessing needed here.
 * @param {string} raw
 * @returns {string|null}
 */
function parseDdMmYyyy(raw) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (!match) return null;
  const [, d, m, y] = match;
  const iso = `${y}-${m}-${d}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  const isReal =
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() + 1 === Number(m) &&
    date.getUTCDate() === Number(d);
  return isReal ? iso : null;
}

/**
 * Convenience wrapper accepting a full ExtractionResult (as produced by
 * lib/importer/extract.js for a PDF).
 * @param {import('../schemas').ExtractionResult} extraction
 * @param {{profileId?: string}} [options]
 */
function parseBankStatement(extraction, options = {}) {
  if (extraction.file_type !== 'pdf' || !extraction.text || !extraction.pages) {
    return {
      statement: BankStatementSchema.parse(emptyStatement()),
      validation: ValidationResultSchema.parse({
        valid: false,
        errors: [
          'EXTRACTION_ERROR: le parseur bancaire nécessite un texte PDF découpé par page',
        ],
        warnings: [],
      }),
    };
  }
  return parseBankStatementFromText(
    { text: extraction.text, pages: extraction.pages, tables: extraction.tables },
    options
  );
}

module.exports = {
  PARSER_VERSION,
  BANK_PROFILES,
  detectBankProfile,
  normalizeLabel,
  extractReference,
  buildTransactionImportKey,
  buildColumnQueues,
  validateBankStatement,
  parseBankStatementFromText,
  parseBankStatement,
};
