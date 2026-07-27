'use strict';

/**
 * Raw content extraction: PDF -> text, XLSX -> sheets/rows, CSV -> table.
 * No business parsing happens here — that is the job of lib/importer/parsers/*
 * (PR2/PR3). This stage only produces a normalized, generic representation
 * validated against ExtractionResultSchema.
 */

const fs = require('node:fs');
const { PDFParse } = require('pdf-parse');
const ExcelJS = require('exceljs');
const { parse: parseCsvSync } = require('csv-parse/sync');

const { ExtractionResultSchema } = require('./schemas');

const CSV_DELIMITER_CANDIDATES = [',', ';', '\t'];

/**
 * Picks the delimiter that occurs most often on the first non-empty line.
 * @param {string} content
 * @returns {string}
 */
function detectCsvDelimiter(content) {
  const firstLine = content.split(/\r?\n/).find((line) => line.length > 0) || '';
  let best = ',';
  let bestCount = -1;
  for (const candidate of CSV_DELIMITER_CANDIDATES) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Normalizes an ExcelJS cell value into a plain, JSON-loggable value.
 * Handles rich text, formulas, and hyperlink objects; leaves primitives
 * and Date instances untouched.
 * @param {*} value
 * @returns {*}
 */
function normalizeCellValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join('');
  }
  if (Object.prototype.hasOwnProperty.call(value, 'result')) {
    return normalizeCellValue(value.result);
  }
  if (Object.prototype.hasOwnProperty.call(value, 'text')) {
    return value.text;
  }
  return value;
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<import('./schemas').ExtractionResult>}
 */
async function extractPdfFromBuffer(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    // getTable() gives positional column data that flat text can't: an
    // unsigned two-column (Débit/Crédit) layout is otherwise ambiguous —
    // see lib/importer/parsers/bank-statement.js for why this matters.
    const tableResult = await parser.getTable();
    return ExtractionResultSchema.parse({
      file_type: 'pdf',
      text: result.text,
      pages: result.pages.map((page) => page.text),
      tables: tableResult.pages.map((page) => page.tables),
      sheets: null,
      table: null,
      raw_meta: { page_count: result.total },
    });
  } finally {
    await parser.destroy();
  }
}

/**
 * @param {string} filePath
 * @returns {Promise<import('./schemas').ExtractionResult>}
 */
async function extractPdf(filePath) {
  return extractPdfFromBuffer(fs.readFileSync(filePath));
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<import('./schemas').ExtractionResult>}
 */
async function extractXlsxFromBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets = workbook.worksheets.map((worksheet) => {
    const rows = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      // ExcelJS row.values is 1-indexed (index 0 is unused/undefined).
      rows.push(row.values.slice(1).map(normalizeCellValue));
    });
    return { name: worksheet.name, rows };
  });

  return ExtractionResultSchema.parse({
    file_type: 'xlsx',
    text: null,
    pages: null,
    tables: null,
    sheets,
    table: null,
    raw_meta: { sheet_count: sheets.length },
  });
}

/**
 * @param {string} filePath
 * @returns {Promise<import('./schemas').ExtractionResult>}
 */
async function extractXlsx(filePath) {
  return extractXlsxFromBuffer(fs.readFileSync(filePath));
}

/**
 * @param {Buffer} buffer
 * @returns {import('./schemas').ExtractionResult}
 */
function extractCsvFromBuffer(buffer) {
  let content = buffer.toString('utf8');
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1); // strip UTF-8 BOM
  }
  const delimiter = detectCsvDelimiter(content);
  const records = parseCsvSync(content, {
    delimiter,
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
  });

  const header = records.length > 0 ? records[0] : [];
  const rows = records.slice(1);

  return ExtractionResultSchema.parse({
    file_type: 'csv',
    text: null,
    pages: null,
    tables: null,
    sheets: null,
    table: { header, rows, delimiter },
    raw_meta: { row_count: rows.length },
  });
}

/**
 * @param {string} filePath
 * @returns {import('./schemas').ExtractionResult}
 */
function extractCsv(filePath) {
  return extractCsvFromBuffer(fs.readFileSync(filePath));
}

/**
 * Wraps an image's raw bytes for the scan-z secondary source (behind
 * IMPORTS_SCANZ_ENABLED) — no OCR/vision interpretation happens at this
 * stage, that is lib/importer/parsers/scanz-ocr.js's job. This stage only
 * produces the same generic, normalized representation every other file
 * type does, so the rest of the pipeline never needs to special-case it.
 * @param {Buffer} buffer
 * @param {'image/jpeg'|'image/png'} mimeType
 * @returns {import('./schemas').ExtractionResult}
 */
function extractImageFromBuffer(buffer, mimeType) {
  return ExtractionResultSchema.parse({
    file_type: 'image',
    text: null,
    pages: null,
    tables: null,
    sheets: null,
    table: null,
    image: { base64: buffer.toString('base64'), mime_type: mimeType },
    raw_meta: { byte_length: buffer.length },
  });
}

/**
 * Dispatches to the extractor matching the detected file type.
 * @param {string} filePath
 * @param {'pdf'|'xlsx'|'csv'} fileType
 * @returns {Promise<import('./schemas').ExtractionResult>}
 */
async function extractContent(filePath, fileType) {
  switch (fileType) {
    case 'pdf':
      return extractPdf(filePath);
    case 'xlsx':
      return extractXlsx(filePath);
    case 'csv':
      return extractCsv(filePath);
    default:
      throw new Error(`extractContent: unsupported file_type "${fileType}"`);
  }
}

/**
 * Dispatches to the buffer-based extractor matching the detected file type
 * — used by the web upload flow (PR4), which never writes the uploaded
 * file to disk. For `'image'`, `mimeType` (from `detect.js`'s
 * `DetectionResult.mime_type`) must be provided.
 * @param {Buffer} buffer
 * @param {'pdf'|'xlsx'|'csv'|'image'} fileType
 * @param {string} [mimeType] - required when fileType is 'image'
 * @returns {Promise<import('./schemas').ExtractionResult>}
 */
async function extractContentFromBuffer(buffer, fileType, mimeType) {
  switch (fileType) {
    case 'pdf':
      return extractPdfFromBuffer(buffer);
    case 'xlsx':
      return extractXlsxFromBuffer(buffer);
    case 'csv':
      return extractCsvFromBuffer(buffer);
    case 'image':
      return extractImageFromBuffer(buffer, mimeType);
    default:
      throw new Error(`extractContentFromBuffer: unsupported file_type "${fileType}"`);
  }
}

module.exports = {
  extractContent,
  extractContentFromBuffer,
  extractPdf,
  extractPdfFromBuffer,
  extractXlsx,
  extractXlsxFromBuffer,
  extractCsv,
  extractCsvFromBuffer,
  extractImageFromBuffer,
  detectCsvDelimiter,
};
