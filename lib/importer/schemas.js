'use strict';

/**
 * Zod schemas shared across the importer pipeline (detect -> extract ->
 * classify -> validate -> [dedupe -> notion, in later PRs]).
 *
 * Kept in one file so every stage validates against the same contract —
 * see docs/ARCHITECTURE.md for the pipeline overview and PR breakdown.
 */

const { z } = require('zod');

const IMPORTER_VERSION = '0.1.0';

/** File types the pipeline knows how to detect/extract. */
const FILE_TYPES = ['pdf', 'xlsx', 'csv', 'image', 'unknown'];

/** Image MIME types recognized for the scan-z secondary source (behind IMPORTS_SCANZ_ENABLED). */
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];

/** Document types the classifier can produce, per AGENTS.md's fixed contract. */
const DOCUMENT_TYPES = [
  'bank_statement',
  'pos_export',
  'monthly_performance',
  'unknown',
];

/**
 * Sub-classification for pos_export documents only. AGENTS.md requires the
 * classifier to distinguish AddicTill from L'Addition exports even though no
 * parser consumes this yet (parsers land in PR3, routed on this field).
 */
const POS_SOURCE_HINTS = ['addictill_export', 'laddition_export', 'unknown'];

const REJECTION_CODES = [
  'LOW_CONFIDENCE',
  'UNKNOWN_TYPE',
  'EXTRACTION_ERROR',
  'VALIDATION_ERROR',
  'TOTAL_MISMATCH',
  'SCHEMA_ERROR',
  'NOTION_ERROR',
];

const STATUSES = ['rejected', 'review_required'];

/**
 * @typedef {Object} DetectionResult
 * @property {'pdf'|'xlsx'|'csv'|'unknown'} file_type
 * @property {string|null} mime_type
 * @property {string} extension
 */
const DetectionResultSchema = z.object({
  file_type: z.enum(FILE_TYPES),
  mime_type: z.string().nullable(),
  extension: z.string(),
});

/**
 * Raw, un-classified extraction output. Shape depends on file_type — only
 * the field matching file_type is populated, the others stay null. This is
 * intentionally generic: no business parsing happens at this stage.
 * @typedef {Object} ExtractionResult
 * @property {'pdf'|'xlsx'|'csv'|'image'} file_type
 * @property {string|null} text - populated for pdf (full text, all pages concatenated)
 * @property {string[]|null} pages - populated for pdf (one entry per page, needed for source_page tracking by parsers/bank-statement.js)
 * @property {Array<Array<Array<string[]>>>|null} tables - populated for pdf: one entry per page, each a list of detected tables, each a list of rows, each row a list of cell strings (raw pdf-parse getTable() output — used by parsers/bank-statement.js to resolve unsigned débit/crédit columns positionally, since flat text alone cannot)
 * @property {Array<{name: string, rows: Array<Array<*>>}>|null} sheets - populated for xlsx
 * @property {{header: string[], rows: string[][], delimiter: string}|null} table - populated for csv
 * @property {{base64: string, mime_type: string}|null} image - populated for image (scan-z secondary source, behind IMPORTS_SCANZ_ENABLED); raw bytes only, no OCR/vision interpretation happens at this stage — that is lib/importer/parsers/scanz-ocr.js's job
 * @property {Object} raw_meta
 */
const ExtractionResultSchema = z.object({
  file_type: z.enum(['pdf', 'xlsx', 'csv', 'image']),
  text: z.string().nullable(),
  pages: z.array(z.string()).nullable(),
  tables: z.array(z.array(z.array(z.array(z.string())))).nullable(),
  sheets: z
    .array(
      z.object({
        name: z.string(),
        rows: z.array(z.array(z.unknown())),
      })
    )
    .nullable(),
  table: z
    .object({
      header: z.array(z.string()),
      rows: z.array(z.array(z.string())),
      delimiter: z.string(),
    })
    .nullable(),
  image: z
    .object({
      base64: z.string(),
      mime_type: z.enum(IMAGE_MIME_TYPES),
    })
    .nullable()
    .default(null),
  raw_meta: z.record(z.string(), z.unknown()).default({}),
});

/**
 * @typedef {Object} ClassificationResult
 * @property {'bank_statement'|'pos_export'|'monthly_performance'|'unknown'} document_type
 * @property {number} confidence - 0.0 - 1.0
 * @property {string} reasoning_summary
 * @property {string[]} detected_signals
 * @property {'addictill_export'|'laddition_export'|'unknown'|null} pos_source_hint
 * @property {'rules'|'claude'} classified_by
 */
const ClassificationResultSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
  confidence: z.number().min(0).max(1),
  reasoning_summary: z.string().min(1),
  detected_signals: z.array(z.string()),
  pos_source_hint: z.enum(POS_SOURCE_HINTS).nullable(),
  classified_by: z.enum(['rules', 'claude']),
});

/** Strict schema for validating Claude's raw JSON response before it is trusted. */
const ClaudeClassificationResponseSchema = z.object({
  document_type: z.enum(DOCUMENT_TYPES),
  confidence: z.number().min(0).max(1),
  reasoning_summary: z.string().min(1),
  detected_signals: z.array(z.string()),
});

const RejectionReportSchema = z.object({
  schema_version: z.literal('1.0'),
  import_run_id: z.string(),
  timestamp: z.string(),
  source_file: z.string(),
  file_hash: z.string(),
  detected_file_type: z.enum(FILE_TYPES),
  detected_document_type: z.enum(DOCUMENT_TYPES),
  classification_confidence: z.number().min(0).max(1),
  status: z.enum(STATUSES),
  rejection_code: z.enum(REJECTION_CODES),
  reason: z.string(),
  warnings: z.array(z.string()).default([]),
  validation_errors: z.array(z.string()).default([]),
  extracted_summary: z.record(z.string(), z.unknown()).default({}),
  suggested_action: z.string(),
  importer_version: z.string(),
});

/** Currencies handled by the importer — never converted between each other (AGENTS.md). */
const CURRENCIES = ['EUR', 'USD'];

/**
 * A single bank transaction, normalized from a bank statement PDF.
 * `debit_cents`/`credit_cents` are non-negative; exactly one of them is
 * non-zero per transaction. `amount_cents` is the signed convenience field
 * (credit_cents - debit_cents). `reference` is best-effort (e.g. a mandate
 * or invoice number found in a continuation line) and null when none is
 * found — never invented.
 * @typedef {Object} BankTransaction
 * @property {string} booking_date - ISO YYYY-MM-DD
 * @property {string|null} value_date - ISO YYYY-MM-DD
 * @property {string} raw_label - as extracted, continuation lines joined with \n
 * @property {string} normalized_label - raw_label with whitespace collapsed to single spaces
 * @property {number} debit_cents
 * @property {number} credit_cents
 * @property {number} amount_cents
 * @property {'EUR'|'USD'|null} currency
 * @property {string|null} reference
 * @property {number} source_page - 1-indexed
 * @property {string} import_key
 */
const BankTransactionSchema = z.object({
  booking_date: z.string(),
  value_date: z.string().nullable(),
  raw_label: z.string(),
  normalized_label: z.string(),
  debit_cents: z.number().int().nonnegative(),
  credit_cents: z.number().int().nonnegative(),
  amount_cents: z.number().int(),
  currency: z.enum(CURRENCIES).nullable(),
  reference: z.string().nullable(),
  source_page: z.number().int().positive(),
  import_key: z.string(),
});

/**
 * Normalized bank statement, produced by parsers/bank-statement.js. Header
 * fields are nullable because a statement from an unrecognized/partial
 * layout must degrade to null + a validation error, never an invented value.
 * `total_debits_cents`/`total_credits_cents` are always the sums recomputed
 * from `transactions` (see docs/ARCHITECTURE.md "PR2A" for why). When the
 * statement also prints its own totals (Crédit Mutuel's "Total des
 * mouvements" line), those are kept separately in
 * `printed_total_debits_cents`/`printed_total_credits_cents` (null if the
 * profile has no such line) so validation can cross-check the recomputed
 * sums against what the bank itself printed, not just the balance identity.
 * @typedef {Object} BankStatement
 * @property {string|null} bank_name
 * @property {string|null} account_name
 * @property {string|null} account_number
 * @property {string|null} iban
 * @property {'EUR'|'USD'|null} currency
 * @property {string|null} statement_date - ISO YYYY-MM-DD
 * @property {string|null} period_start - ISO YYYY-MM-DD
 * @property {string|null} period_end - ISO YYYY-MM-DD
 * @property {number|null} opening_balance_cents
 * @property {number|null} closing_balance_cents
 * @property {number} total_debits_cents
 * @property {number} total_credits_cents
 * @property {number|null} printed_total_debits_cents
 * @property {number|null} printed_total_credits_cents
 * @property {BankTransaction[]} transactions
 */
const BankStatementSchema = z.object({
  bank_name: z.string().nullable(),
  account_name: z.string().nullable(),
  account_number: z.string().nullable(),
  iban: z.string().nullable(),
  currency: z.enum(CURRENCIES).nullable(),
  statement_date: z.string().nullable(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  opening_balance_cents: z.number().int().nullable(),
  closing_balance_cents: z.number().int().nullable(),
  total_debits_cents: z.number().int(),
  total_credits_cents: z.number().int(),
  printed_total_debits_cents: z.number().int().nullable(),
  printed_total_credits_cents: z.number().int().nullable(),
  transactions: z.array(BankTransactionSchema),
});

/**
 * Generic { valid, errors, warnings } result shape, reused by every parser
 * (bank-statement.js, pos-addictill.js, ...) — not bank-specific despite
 * the historical name of its original export.
 * @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} warnings
 */
const ValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

/**
 * One sales-mode bucket for a day (e.g. "A EMPORTER", "SUR PLACE") — the
 * set of modes is dynamic per export, never hardcoded (see
 * docs/ARCHITECTURE.md "PR3").
 * @typedef {Object} AddicTillSalesMode
 * @property {string} mode
 * @property {number} total_ttc_cents
 * @property {number} ticket_count
 */
const AddicTillSalesModeSchema = z.object({
  mode: z.string(),
  total_ttc_cents: z.number().int(),
  ticket_count: z.number().int(),
});

/**
 * One payment-method bucket for a day. `total_cents` can be negative
 * (e.g. "TROP PERÇU" — overpayment/change corrections).
 * @typedef {Object} AddicTillPayment
 * @property {string} method
 * @property {number} quantity
 * @property {number} total_cents
 */
const AddicTillPaymentSchema = z.object({
  method: z.string(),
  quantity: z.number().int(),
  total_cents: z.number().int(),
});

/**
 * One tax-rate bucket for a day (e.g. "TGCA" — the Saint-Martin local
 * sales tax). Several can coexist if a venue mixes tax rates.
 * @typedef {Object} AddicTillTax
 * @property {string} label
 * @property {number} total_ttc_cents
 * @property {number} total_ht_cents
 * @property {number} tax_cents
 */
const AddicTillTaxSchema = z.object({
  label: z.string(),
  total_ttc_cents: z.number().int(),
  total_ht_cents: z.number().int(),
  tax_cents: z.number().int(),
});

/**
 * One seller/vendor bucket for a day.
 * @typedef {Object} AddicTillVendor
 * @property {string} name
 * @property {number} total_ttc_cents
 * @property {number} ticket_count
 */
const AddicTillVendorSchema = z.object({
  name: z.string(),
  total_ttc_cents: z.number().int(),
  ticket_count: z.number().int(),
});

/**
 * Shared totals shape for both a day row and the file's own printed total
 * row (which has no date/source_row).
 * @typedef {Object} AddicTillDayTotals
 * @property {number} ticket_count
 * @property {number|null} avg_ticket_ttc_cents - never validated, a derived ratio
 * @property {number|null} avg_ticket_ht_cents - never validated, a derived ratio
 * @property {number} total_ttc_cents
 * @property {number} total_ht_cents
 * @property {number} ca_ttc_cents
 * @property {number|null} clients_count
 * @property {AddicTillSalesMode[]} sales_by_mode
 * @property {AddicTillPayment[]} payments
 * @property {AddicTillTax[]} taxes
 * @property {AddicTillVendor[]} vendors
 */
const AddicTillDayTotalsSchema = z.object({
  ticket_count: z.number().int(),
  avg_ticket_ttc_cents: z.number().int().nullable(),
  avg_ticket_ht_cents: z.number().int().nullable(),
  total_ttc_cents: z.number().int(),
  total_ht_cents: z.number().int(),
  ca_ttc_cents: z.number().int(),
  clients_count: z.number().int().nullable(),
  sales_by_mode: z.array(AddicTillSalesModeSchema),
  payments: z.array(AddicTillPaymentSchema),
  taxes: z.array(AddicTillTaxSchema),
  vendors: z.array(AddicTillVendorSchema),
});

/**
 * @typedef {Object} AddicTillDayRow
 * @augments AddicTillDayTotals
 * @property {string} date - ISO YYYY-MM-DD
 * @property {number} source_row - 1-indexed spreadsheet row
 */
const AddicTillDayRowSchema = AddicTillDayTotalsSchema.extend({
  date: z.string(),
  source_row: z.number().int().positive(),
});

/**
 * Normalized "Synthèse quotidienne" (AddicTill daily summary) export.
 * `printed_total` is the file's own total row (Date column empty) — kept
 * separate from any recomputed sum so validation can cross-check one
 * against the other, never silently trusting either.
 * @typedef {Object} AddicTillDailySummary
 * @property {'addictill_daily_summary'} source_type
 * @property {string|null} period_start - ISO YYYY-MM-DD, derived from day rows
 * @property {string|null} period_end - ISO YYYY-MM-DD, derived from day rows
 * @property {'EUR'|'USD'} currency - defaults to ADDICTILL_DEFAULT_CURRENCY / EUR, never left ambiguous
 * @property {AddicTillDayRow[]} days
 * @property {AddicTillDayTotals|null} printed_total
 */
const AddicTillDailySummarySchema = z.object({
  source_type: z.literal('addictill_daily_summary'),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  currency: z.enum(CURRENCIES),
  days: z.array(AddicTillDayRowSchema),
  printed_total: AddicTillDayTotalsSchema.nullable(),
});

/**
 * One product row from the "Palmarès produits" export. `discounts_raw`/
 * `discounts_value` are deliberately neutral: the "Remises" column's unit
 * (a count? a monetary amount?) is not documented anywhere and not
 * verifiable from the data alone — never assumed, see docs/ARCHITECTURE.md
 * "PR3". `mapping_status` comes from parsers/recipe-mapping.js, an exact
 * product-name lookup — never a fuzzy match.
 * @typedef {Object} AddicTillProductRow
 * @property {string} product_name
 * @property {string|null} category_name
 * @property {number} quantity
 * @property {number|null} quantity_decimal
 * @property {number} revenue_ttc_cents
 * @property {number} revenue_ht_cents
 * @property {number} complimentary_qty - "Offerts"
 * @property {string|null} discounts_raw - "Remises", as printed
 * @property {number|null} discounts_value - "Remises", parsed as a plain number when the cell was numeric
 * @property {number|null} unit_price_cents - "PU"
 * @property {string|null} barcode
 * @property {string|null} last_sale_at - ISO datetime, "Dernière vente"
 * @property {'Rubriques'|'Produits'} source_sheet
 * @property {number} source_row
 * @property {'mapped'|'unmapped'} mapping_status
 * @property {string|null} moka_product_key - resolved MÖKA product key when mapped, null otherwise
 */
const AddicTillProductRowSchema = z.object({
  product_name: z.string(),
  category_name: z.string().nullable(),
  quantity: z.number().int(),
  quantity_decimal: z.number().nullable(),
  revenue_ttc_cents: z.number().int(),
  revenue_ht_cents: z.number().int(),
  complimentary_qty: z.number().int(),
  discounts_raw: z.string().nullable(),
  discounts_value: z.number().nullable(),
  unit_price_cents: z.number().int().nullable(),
  barcode: z.string().nullable(),
  last_sale_at: z.string().nullable(),
  source_sheet: z.enum(['Rubriques', 'Produits']),
  source_row: z.number().int().positive(),
  mapping_status: z.enum(['mapped', 'unmapped']),
  moka_product_key: z.string().nullable(),
});

/**
 * @typedef {Object} AddicTillCategorySubtotal
 * @property {string} category_name
 * @property {number} quantity
 * @property {number} revenue_ttc_cents
 * @property {number} revenue_ht_cents
 * @property {number} complimentary_qty
 */
const AddicTillCategorySubtotalSchema = z.object({
  category_name: z.string(),
  quantity: z.number().int(),
  revenue_ttc_cents: z.number().int(),
  revenue_ht_cents: z.number().int(),
  complimentary_qty: z.number().int(),
});

/**
 * @typedef {Object} AddicTillGrandTotal
 * @property {number} quantity
 * @property {number} revenue_ttc_cents
 * @property {number} revenue_ht_cents
 * @property {number} complimentary_qty
 */
const AddicTillGrandTotalSchema = z.object({
  quantity: z.number().int(),
  revenue_ttc_cents: z.number().int(),
  revenue_ht_cents: z.number().int(),
  complimentary_qty: z.number().int(),
});

/**
 * Normalized "Palmarès produits" (AddicTill product ranking) export. The
 * file never encodes its own reporting period (only a per-product "last
 * sale" date) — `period_status` is 'unknown' unless explicitly overridden
 * via CLI/metadata, never inferred. `unmapped_products` is always
 * populated from `products[].mapping_status`, never silently dropped.
 * @typedef {Object} AddicTillProductRanking
 * @property {'addictill_product_ranking'} source_type
 * @property {string|null} period_start
 * @property {string|null} period_end
 * @property {'explicit'|'unknown'} period_status
 * @property {AddicTillProductRow[]} products
 * @property {AddicTillCategorySubtotal[]} category_subtotals
 * @property {AddicTillGrandTotal|null} grand_total
 * @property {string[]} unmapped_products
 */
const AddicTillProductRankingSchema = z.object({
  source_type: z.literal('addictill_product_ranking'),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  period_status: z.enum(['explicit', 'unknown']),
  products: z.array(AddicTillProductRowSchema),
  category_subtotals: z.array(AddicTillCategorySubtotalSchema),
  grand_total: AddicTillGrandTotalSchema.nullable(),
  unmapped_products: z.array(z.string()),
});

/**
 * One exact-key product mapping entry (AddicTill product name -> MÖKA
 * product/recipe key). Deliberately just an identity link — no ingredient
 * or quantity data here, see parsers/recipe-mapping.js and
 * docs/ARCHITECTURE.md "PR3" for why recipe composition (ingredients,
 * quantities, stock movements) is a separate, not-yet-built concern.
 * @typedef {Object} ProductMappingEntry
 * @property {string} addictill_product_key
 * @property {string} moka_product_key
 */
const ProductMappingEntrySchema = z.object({
  addictill_product_key: z.string(),
  moka_product_key: z.string(),
});

/**
 * scan-z secondary source (spec v3) — a photographed Z-report, OCR'd via
 * Claude vision, treated as a fallback/reconciliation source, never
 * authoritative over AddicTill/L'Addition (see SOURCE_SUBTYPE_AUTHORITY).
 * Behind IMPORTS_SCANZ_ENABLED (default false). Never wired to Product
 * Sales/Sales Categories, never to stock deduction — see
 * docs/ARCHITECTURE.md "scan-z secondary source" for the full design.
 */

/**
 * One product line as read from a scan-z photo — retained only for the
 * line-total reconciliation check and the human-review UI; never written
 * to any pilotage table.
 * @typedef {Object} ScanZProductLine
 * @property {string} name
 * @property {number|null} quantity
 * @property {number|null} total_cents
 */
const ScanZProductLineSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable(),
  total_cents: z.number().nullable(),
});

/**
 * Deterministic + model-reported signals feeding the composite confidence
 * algorithm (spec v3 §7). Computed once at preflight time from the vision
 * call's raw output — never recomputed from a second vision call at commit.
 * @typedef {Object} ScanZOcrChecks
 * @property {boolean} date_valid
 * @property {boolean} ttc_valid
 * @property {boolean} ticket_count_plausible
 * @property {boolean} expected_labels_present
 * @property {'good'|'poor'} image_quality
 * @property {boolean} repeated_value_consistent
 * @property {boolean} line_total_reconciled
 */
const ScanZOcrChecksSchema = z.object({
  date_valid: z.boolean(),
  ttc_valid: z.boolean(),
  ticket_count_plausible: z.boolean(),
  expected_labels_present: z.boolean(),
  image_quality: z.enum(['good', 'poor']),
  repeated_value_consistent: z.boolean(),
  line_total_reconciled: z.boolean(),
});

/**
 * Raw scan-z OCR extraction — the exact payload embedded (HMAC-signed) in
 * the preflight token, and the "raw" side of the commit-time
 * corrected_fields diff. Never trusted from a client-submitted field, only
 * from a verified token — see lib/importer/notion/preflight-token.js.
 * `total_ht_cents`/`ca_ttc_cents` are never present here at all (a Z
 * receipt never encodes them) — see ScanZDayRowSchema below.
 * @typedef {Object} ScanZRawOcrValues
 * @property {string|null} date
 * @property {number|null} total_ttc_cents
 * @property {number|null} ticket_count
 * @property {'high'|'medium'|'low'} ocr_confidence
 * @property {string[]} labels_detected
 * @property {string} resume
 * @property {ScanZProductLine[]} product_lines
 * @property {ScanZOcrChecks} checks
 */
const ScanZRawOcrValuesSchema = z.object({
  date: z.string().nullable(),
  total_ttc_cents: z.number().nullable(),
  ticket_count: z.number().nullable(),
  ocr_confidence: z.enum(['high', 'medium', 'low']),
  labels_detected: z.array(z.string()),
  resume: z.string(),
  product_lines: z.array(ScanZProductLineSchema),
  checks: ScanZOcrChecksSchema,
});

/**
 * A single scan-z day row — deliberately minimal (only the fields
 * lib/importer/notion/row-builders.js::buildDailySummaryRows actually
 * reads), never validated against AddicTillDayRowSchema (which requires
 * non-null total_ht_cents/ca_ttc_cents — correct for AddicTill, wrong for
 * scan-z, which must never manufacture those figures).
 * @typedef {Object} ScanZDayRow
 * @property {string} date
 * @property {number} ticket_count
 * @property {number} total_ttc_cents
 * @property {number|null} total_ht_cents - always null unless a human manually enters a real figure during review
 * @property {number|null} ca_ttc_cents - always null unless a human manually enters a real figure during review
 * @property {number|null} clients_count - always null, never OCR'd, never guessed
 * @property {import('./schemas').AddicTillPayment[]} payments - always [] (no payment-method breakdown legible from a typical Z receipt)
 */
const ScanZDayRowSchema = z.object({
  date: z.string(),
  ticket_count: z.number().int(),
  total_ttc_cents: z.number().int(),
  total_ht_cents: z.number().int().nullable(),
  ca_ttc_cents: z.number().int().nullable(),
  clients_count: z.number().int().nullable(),
  payments: z.array(AddicTillPaymentSchema).default([]),
});

/**
 * Normalized scan-z daily summary. Deliberately structured like
 * AddicTillDailySummarySchema's single-day shape (`days`, exactly one
 * element — a Z report always covers one day) so
 * lib/importer/notion/row-builders.js::buildDailySummaryRows is reused
 * unchanged for both sources.
 * @typedef {Object} ScanZDailySummary
 * @property {'scanz_ocr_summary'} source_type
 * @property {ScanZRawOcrValues} raw
 * @property {ScanZDayRow[]} days - always exactly 1 entry
 */
const ScanZDailySummarySchema = z.object({
  source_type: z.literal('scanz_ocr_summary'),
  raw: ScanZRawOcrValuesSchema,
  days: z.array(ScanZDayRowSchema).length(1),
});

/**
 * The signed preflight-token payload (spec v3 §0) — parsed and validated
 * only AFTER HMAC signature verification succeeds. A token whose signature
 * fails verification must never have its payload parsed against this
 * schema or trusted in any way — see preflight-token.js::verifyPreflightToken.
 * @typedef {Object} PreflightTokenPayload
 * @property {string} file_hash_sha256
 * @property {'scanz_ocr_summary'} source_subtype
 * @property {string} establishment_key
 * @property {ScanZRawOcrValues} ocr_raw_values
 * @property {string} issued_at
 * @property {string} expires_at
 */
const PreflightTokenPayloadSchema = z.object({
  file_hash_sha256: z.string(),
  source_subtype: z.literal('scanz_ocr_summary'),
  establishment_key: z.string(),
  ocr_raw_values: ScanZRawOcrValuesSchema,
  issued_at: z.string(),
  expires_at: z.string(),
});

/**
 * PR4 — schemas for data actually written to Notion. Unlike the pilotage
 * schema *design* documented in docs/ARCHITECTURE.md, these are validated
 * by runtime code (the pilotage writer) before every write, which is why
 * they exist here — see the PR3 decision to keep unused theoretical
 * schemas out of this file.
 *
 * Money fields here are in plain currency units (euros), NOT cents —
 * converted at the Notion-write boundary from the parsers' internal
 * integer-cents representation, since Notion Number properties display
 * best as plain currency values for a human reading the pilotage tables.
 */

const SOURCE_TYPES = ['bank_statement', 'pos_export', 'monthly_performance'];
const SOURCE_SUBTYPES = [
  'credit_mutuel',
  'addictill_daily_summary',
  'addictill_product_ranking',
  'laddition_export',
  'scanz_ocr_summary',
  'unknown',
];

/**
 * Source-authority scores (scan-z secondary-source spec v3, §6/§1) — governs
 * whether an incoming pilotage row write may replace an existing one for the
 * same establishment/date. An incoming write is allowed only when
 * `resolveAuthority(incoming) >= resolveAuthority(existing)` — never the
 * inverse. AddicTill/L'Addition are native machine exports (authoritative);
 * scan-z is OCR-derived and always ranks lowest, so it can never overwrite
 * either of them, in either direction, from any surface (CLI included — no
 * override exists). An unrecognized subtype defaults to the lowest possible
 * authority (0), fail-closed, so it can never overwrite anything either.
 */
const SOURCE_SUBTYPE_AUTHORITY = {
  addictill_daily_summary: 100,
  laddition_export: 100,
  scanz_ocr_summary: 10,
};

/**
 * @param {string} sourceSubtype
 * @returns {number}
 */
function resolveAuthority(sourceSubtype) {
  return SOURCE_SUBTYPE_AUTHORITY[sourceSubtype] ?? 0;
}

/**
 * Import Run lifecycle status — the audit-trail concern, deliberately
 * separate from business deduplication (which is decided purely by "does
 * any Import Run for this file_hash have status 'committed'"). Every
 * execution attempt gets its own Import Run record with one of these
 * statuses — a blocked or failed attempt is still preserved, never
 * dropped, even though it never touches the pilotage tables. See
 * docs/ARCHITECTURE.md "PR4 addendum — audit trail" for the full rationale.
 *
 * - preview: a read-only analysis (CLI dry-run preview or the web UI's
 *   "Analyser" step) — no commit was attempted.
 * - committed: every pilotage row write succeeded (or there were none to
 *   write, e.g. a bank statement).
 * - partial_failure: at least one row write failed, at least one succeeded.
 * - failed: blocked before any write was attempted (validation error,
 *   unknown establishment, schema mismatch, duplicate), or every row write
 *   failed, or the run crashed before its outcome could be recorded.
 * - retry: the pessimistic placeholder written for attempt N>1 of the same
 *   file_hash, before its real outcome is known — corrected to one of the
 *   three outcomes above once the attempt finishes. A crash leaves this
 *   value in place, which is an accurate (not misleading) audit signal:
 *   "a retry was attempted, outcome unknown."
 * - blocked: the pipeline's OWN business rules correctly refused this
 *   attempt (validation errors, ambiguous classification, unknown
 *   establishment, duplicate file, a scan-z/AddicTill source-precedence
 *   conflict). Distinguished from `failed`, which is reserved for technical/
 *   infrastructure problems (schema mismatch, an invalid/expired preflight
 *   token, a Notion write error) that are not a judgment about this
 *   particular document's business validity. See docs/ARCHITECTURE.md
 *   "scan-z secondary source" for the full status-assignment table.
 */
const IMPORT_RUN_STATUSES = ['preview', 'committed', 'failed', 'partial_failure', 'retry', 'blocked'];

const IMPORT_RUN_CHANNELS = ['cli', 'web'];

/**
 * @typedef {Object} ImportRun
 * @property {string} import_run_id
 * @property {'bank_statement'|'pos_export'|'monthly_performance'} source_type
 * @property {string} source_subtype
 * @property {string} original_filename
 * @property {string} file_hash_sha256
 * @property {string} imported_at - ISO datetime
 * @property {string|null} period_start
 * @property {string|null} period_end
 * @property {'valid'|'invalid'} validation_status
 * @property {number} warning_count
 * @property {number} error_count
 * @property {number} row_count
 * @property {'preview'|'committed'|'failed'|'partial_failure'|'retry'|'blocked'} status
 * @property {number} attempt_number - 1-based count of Import Run records for this file_hash, including this one
 * @property {string|null} retry_of_import_run_id - the previous attempt's import_run_id, when attempt_number > 1
 * @property {string|null} failure_reason - human-readable reason(s), populated on 'blocked'/'failed'/'partial_failure'
 * @property {'cli'|'web'} initiated_via
 * @property {string} initiated_by - best-effort identity (OS user for CLI, Basic Auth username for web) — see docs/ARCHITECTURE.md for why this isn't a real per-staff identity yet
 * @property {string} parser_version
 * @property {string} establishment_key
 * @property {string} audit_metadata - compact JSON blob (scan-z secondary-source spec v3, §4); empty string for every non-scan-z attempt
 */
const ImportRunSchema = z.object({
  import_run_id: z.string(),
  source_type: z.enum(SOURCE_TYPES),
  source_subtype: z.enum(SOURCE_SUBTYPES),
  original_filename: z.string(),
  file_hash_sha256: z.string(),
  imported_at: z.string(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  validation_status: z.enum(['valid', 'invalid']),
  warning_count: z.number().int().nonnegative(),
  error_count: z.number().int().nonnegative(),
  row_count: z.number().int().nonnegative(),
  status: z.enum(IMPORT_RUN_STATUSES),
  attempt_number: z.number().int().min(1),
  retry_of_import_run_id: z.string().nullable(),
  failure_reason: z.string().nullable(),
  initiated_via: z.enum(IMPORT_RUN_CHANNELS),
  initiated_by: z.string(),
  parser_version: z.string(),
  establishment_key: z.string(),
  audit_metadata: z.string().default(''),
});

/**
 * @typedef {Object} DailyOperationsRow
 * @property {number|null} total_ht - nullable since scan-z (scanz_ocr_summary) never manufactures an HT figure it cannot read — see docs/ARCHITECTURE.md "scan-z secondary source" §2; AddicTill always supplies a real value, never null
 * @property {number|null} ca_ttc - nullable for the same reason (no separate CA figure legible on a Z receipt)
 * @property {string} source_subtype - needed for the source-authority precedence check (pilotage-writer.js) — added alongside source_type, not replacing it
 */
const DailyOperationsRowSchema = z.object({
  import_key: z.string(),
  establishment_key: z.string(),
  date: z.string(),
  source_type: z.enum(SOURCE_TYPES),
  source_subtype: z.enum(SOURCE_SUBTYPES).default('unknown'),
  ticket_count: z.number().int(),
  total_ttc: z.number(),
  total_ht: z.number().nullable(),
  ca_ttc: z.number().nullable(),
  clients: z.number().int().nullable(),
});

/** @typedef {Object} PaymentMethodRow */
const PaymentMethodRowSchema = z.object({
  import_key: z.string(),
  establishment_key: z.string(),
  date: z.string(),
  source_type: z.enum(SOURCE_TYPES),
  source_subtype: z.enum(SOURCE_SUBTYPES).default('unknown'),
  payment_method: z.string(),
  quantity: z.number().int(),
  amount: z.number(),
});

/** @typedef {Object} ProductSalesRow */
const ProductSalesRowSchema = z.object({
  import_key: z.string(),
  establishment_key: z.string(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  addictill_product_key: z.string(),
  product_name_raw: z.string(),
  category_name: z.string().nullable(),
  quantity: z.number().int(),
  revenue_ttc: z.number(),
  revenue_ht: z.number(),
  complimentary_qty: z.number().int(),
  discounts_raw: z.string().nullable(),
  discounts_value: z.number().nullable(),
  unit_price: z.number().nullable(),
  last_sale_at: z.string().nullable(),
  mapping_status: z.enum(['mapped', 'unmapped']),
  moka_product_key: z.string().nullable(),
});

/** @typedef {Object} SalesCategoryRow */
const SalesCategoryRowSchema = z.object({
  import_key: z.string(),
  establishment_key: z.string(),
  period_start: z.string().nullable(),
  period_end: z.string().nullable(),
  category_key: z.string(),
  category_name_raw: z.string(),
  quantity: z.number().int(),
  revenue_ttc: z.number(),
  revenue_ht: z.number(),
  complimentary_qty: z.number().int(),
});

/**
 * Per-row write outcome, aggregated into a CommitReport.
 * @typedef {Object} CommitRowResult
 * @property {string} targetKey
 * @property {string} importKey
 * @property {'created'|'updated'|'skipped'|'failed'|'blocked_precedence'} status
 * @property {string|null} reason - present when status is 'failed'/'blocked_precedence'
 */
const CommitRowResultSchema = z.object({
  targetKey: z.string(),
  importKey: z.string(),
  status: z.enum(['created', 'updated', 'skipped', 'failed', 'blocked_precedence']),
  reason: z.string().nullable(),
});

/**
 * @typedef {Object} CommitReport
 * @property {string} importRunId
 * @property {'success'|'partial_failure'|'failed'} commitResult
 * @property {number} created
 * @property {number} updated
 * @property {number} skipped
 * @property {number} failed
 * @property {CommitRowResult[]} rowResults
 */
const CommitReportSchema = z.object({
  importRunId: z.string(),
  commitResult: z.enum(['success', 'partial_failure', 'failed']),
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  rowResults: z.array(CommitRowResultSchema),
});

module.exports = {
  IMPORTER_VERSION,
  FILE_TYPES,
  IMAGE_MIME_TYPES,
  DOCUMENT_TYPES,
  POS_SOURCE_HINTS,
  REJECTION_CODES,
  STATUSES,
  CURRENCIES,
  SOURCE_TYPES,
  SOURCE_SUBTYPES,
  SOURCE_SUBTYPE_AUTHORITY,
  resolveAuthority,
  IMPORT_RUN_STATUSES,
  IMPORT_RUN_CHANNELS,
  ScanZProductLineSchema,
  ScanZOcrChecksSchema,
  ScanZRawOcrValuesSchema,
  ScanZDayRowSchema,
  ScanZDailySummarySchema,
  PreflightTokenPayloadSchema,
  DetectionResultSchema,
  ExtractionResultSchema,
  ClassificationResultSchema,
  ClaudeClassificationResponseSchema,
  RejectionReportSchema,
  BankTransactionSchema,
  BankStatementSchema,
  ValidationResultSchema,
  AddicTillSalesModeSchema,
  AddicTillPaymentSchema,
  AddicTillTaxSchema,
  AddicTillVendorSchema,
  AddicTillDayTotalsSchema,
  AddicTillDayRowSchema,
  AddicTillDailySummarySchema,
  AddicTillProductRowSchema,
  AddicTillCategorySubtotalSchema,
  AddicTillGrandTotalSchema,
  AddicTillProductRankingSchema,
  ProductMappingEntrySchema,
  ImportRunSchema,
  DailyOperationsRowSchema,
  PaymentMethodRowSchema,
  ProductSalesRowSchema,
  SalesCategoryRowSchema,
  CommitRowResultSchema,
  CommitReportSchema,
};
