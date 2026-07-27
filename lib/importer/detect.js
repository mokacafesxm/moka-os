'use strict';

/**
 * File-type detection: extension + magic-byte signature, cross-checked
 * against each other. A mismatch (e.g. a renamed file) is reported as
 * 'unknown' rather than silently trusted — per the "never silently
 * transform ambiguous data" reliability rule in AGENTS.md.
 */

const fs = require('node:fs');
const path = require('node:path');

const { DetectionResultSchema } = require('./schemas');

const MIME_TYPES = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

// scan-z secondary source (behind IMPORTS_SCANZ_ENABLED) — a photographed
// Z-report. Kept as distinct 'jpeg'/'png' precise types here (not the
// generic 'image' file_type) so a renamed file (JPEG bytes under a .png
// name, or vice versa) is still caught as a genuine extension/magic
// mismatch — collapsing to 'image' before this comparison would silently
// accept that mismatch, since both extensions would resolve to the same
// generic bucket. Only classifyByExtensionAndMagic's final result exposes
// the generic 'image' file_type; the precise jpeg/png distinction stays
// internal to the exact-match check.
const EXTENSION_TO_TYPE = {
  '.pdf': 'pdf',
  '.xlsx': 'xlsx',
  '.csv': 'csv',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
};

/**
 * Sniffs a file's signature from its leading bytes.
 * @param {Buffer} buffer - at least the first 8 bytes of the file
 * @returns {'pdf'|'zip'|'jpeg'|'png'|'text'|'unknown'}
 */
function sniffMagicBytes(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'pdf';
  }
  // XLSX files are ZIP archives; ZIP local file header signature is PK\x03\x04.
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'zip';
  }
  // JPEG: FF D8 FF (SOI marker followed by any marker).
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  // PNG: fixed 8-byte signature.
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  // Heuristic: printable/text-ish leading bytes, no null bytes -> plausible CSV/text.
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  const hasNullByte = sample.includes(0x00);
  if (!hasNullByte) {
    return 'text';
  }
  return 'unknown';
}

// 'jpeg'/'png' mirror EXTENSION_TO_TYPE's precise types (see comment
// above) — collapsed to the generic 'image' file_type only after the
// exact-match comparison below.
const MAGIC_TO_TYPE = {
  pdf: 'pdf',
  zip: 'xlsx',
  jpeg: 'jpeg',
  png: 'png',
  text: 'csv',
};

const IMAGE_PRECISE_TYPES = { jpeg: 'image/jpeg', png: 'image/png' };

/**
 * Combines an extension guess with a magic-byte signature into a final
 * file_type — 'unknown' unless both signals agree. Shared by the
 * path-based and buffer-based entry points so they can never drift.
 * @param {string} extension - including the leading dot, e.g. ".pdf"
 * @param {Buffer} headBuffer - at least the leading bytes of the file
 * @returns {import('./schemas').DetectionResult}
 */
function classifyByExtensionAndMagic(extension, headBuffer) {
  const extType = EXTENSION_TO_TYPE[extension] || null;
  const magic = sniffMagicBytes(headBuffer);
  const magicType = MAGIC_TO_TYPE[magic] || null;

  // Exact match required at the precise type level (jpeg vs png stay
  // distinct here) — a JPEG's bytes under a .png extension (or vice versa)
  // must still fall through to 'unknown', not silently pass as 'image'.
  let preciseType = null;
  if (extType && magicType && extType === magicType) {
    preciseType = extType;
  }

  const isImage = preciseType === 'jpeg' || preciseType === 'png';
  const fileType = preciseType === null ? 'unknown' : isImage ? 'image' : preciseType;
  const mimeType = isImage ? IMAGE_PRECISE_TYPES[preciseType] : fileType !== 'unknown' ? MIME_TYPES[fileType] : null;

  return DetectionResultSchema.parse({
    file_type: fileType,
    mime_type: mimeType,
    extension: extension.replace(/^\./, ''),
  });
}

/**
 * Detects the file type of a single file by combining its extension with a
 * magic-byte signature check. Returns file_type 'unknown' when either the
 * extension is unsupported or the two signals disagree.
 * @param {string} filePath
 * @returns {import('./schemas').DetectionResult}
 */
function detectFileType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(512);
  let bytesRead = 0;
  try {
    bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
  } finally {
    fs.closeSync(fd);
  }

  return classifyByExtensionAndMagic(extension, buffer.subarray(0, bytesRead));
}

/**
 * Detects the file type of an in-memory buffer — used by the web upload
 * flow (PR4), which never writes the uploaded file to disk. `filename` only
 * supplies the extension signal; its directory portion (if any) is ignored.
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {import('./schemas').DetectionResult}
 */
function detectFileTypeFromBuffer(buffer, filename) {
  const extension = path.extname(filename).toLowerCase();
  return classifyByExtensionAndMagic(extension, buffer.subarray(0, 512));
}

module.exports = { detectFileType, detectFileTypeFromBuffer, sniffMagicBytes };
