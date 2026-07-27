import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { detectFileType, detectFileTypeFromBuffer } from '../detect.js';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('detectFileType', () => {
  it('detects a valid PDF by extension + magic bytes', () => {
    const result = detectFileType(path.join(FIXTURES, 'pdf', 'bank-statement-sample.pdf'));
    expect(result.file_type).toBe('pdf');
    expect(result.mime_type).toBe('application/pdf');
    expect(result.extension).toBe('pdf');
  });

  it('detects a valid XLSX by extension + zip signature', () => {
    const result = detectFileType(
      path.join(FIXTURES, 'xlsx', 'monthly-performance-sample.xlsx')
    );
    expect(result.file_type).toBe('xlsx');
    expect(result.mime_type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('detects a plain CSV by extension + text heuristic', () => {
    const result = detectFileType(path.join(FIXTURES, 'csv', 'comma-delimited.csv'));
    expect(result.file_type).toBe('csv');
    expect(result.mime_type).toBe('text/csv');
  });

  it('reports unknown for an unsupported extension', () => {
    const result = detectFileType(path.join(FIXTURES, 'unsupported', 'mystery.xyz'));
    expect(result.file_type).toBe('unknown');
    expect(result.mime_type).toBeNull();
  });

  it('reports unknown when extension and magic bytes disagree', () => {
    // A real PDF file renamed with a .csv extension: extension says csv,
    // magic bytes say pdf — must not be silently trusted either way.
    const result = detectFileType(path.join(FIXTURES, 'unsupported', 'renamed-pdf.csv'));
    expect(result.file_type).toBe('unknown');
    expect(result.mime_type).toBeNull();
  });
});

describe('detectFileTypeFromBuffer — image recognition (scan-z secondary source)', () => {
  const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

  it('detects a JPEG by extension + magic bytes', () => {
    const result = detectFileTypeFromBuffer(JPEG_HEADER, 'z-report.jpg');
    expect(result.file_type).toBe('image');
    expect(result.mime_type).toBe('image/jpeg');
  });

  it('detects a PNG by extension + magic bytes', () => {
    const result = detectFileTypeFromBuffer(PNG_HEADER, 'z-report.png');
    expect(result.file_type).toBe('image');
    expect(result.mime_type).toBe('image/png');
  });

  it('reports unknown when JPEG bytes are renamed with a .png extension (never silently collapsed into "image")', () => {
    const result = detectFileTypeFromBuffer(JPEG_HEADER, 'z-report.png');
    expect(result.file_type).toBe('unknown');
    expect(result.mime_type).toBeNull();
  });

  it('reports unknown when PNG bytes are renamed with a .jpg extension', () => {
    const result = detectFileTypeFromBuffer(PNG_HEADER, 'z-report.jpg');
    expect(result.file_type).toBe('unknown');
    expect(result.mime_type).toBeNull();
  });
});
