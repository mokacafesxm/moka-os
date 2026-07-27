import path from 'node:path';
import { describe, it, expect } from 'vitest';

import { extractPdf, extractXlsx, extractCsv, detectCsvDelimiter } from '../extract.js';

const FIXTURES = path.join(__dirname, 'fixtures');

describe('extractPdf', () => {
  it('extracts text from a simple PDF', async () => {
    const result = await extractPdf(path.join(FIXTURES, 'pdf', 'bank-statement-sample.pdf'));
    expect(result.file_type).toBe('pdf');
    expect(result.text).toContain('Releve de compte bancaire');
    expect(result.text).toContain('solde initial');
    expect(result.sheets).toBeNull();
    expect(result.table).toBeNull();
    expect(result.raw_meta.page_count).toBe(1);
  });
});

describe('extractXlsx', () => {
  it('extracts sheets/rows from an XLSX workbook', async () => {
    const result = await extractXlsx(
      path.join(FIXTURES, 'xlsx', 'monthly-performance-sample.xlsx')
    );
    expect(result.file_type).toBe('xlsx');
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].name).toBe('Performance');
    expect(result.sheets[0].rows[1]).toEqual(['Établissement', 'Mois', 'CA', 'Nombre de tickets']);
    expect(result.sheets[0].rows[2][0]).toBe('MOKA Café Test');
    expect(result.text).toBeNull();
    expect(result.table).toBeNull();
  });
});

describe('extractCsv', () => {
  it('parses a comma-delimited CSV', () => {
    const result = extractCsv(path.join(FIXTURES, 'csv', 'comma-delimited.csv'));
    expect(result.file_type).toBe('csv');
    expect(result.table.delimiter).toBe(',');
    expect(result.table.header).toEqual(['nom', 'quantite', 'prix']);
    expect(result.table.rows).toEqual([
      ['Cafe', '10', '2.50'],
      ['The', '5', '3.00'],
    ]);
  });

  it('parses a semicolon-delimited CSV', () => {
    const result = extractCsv(path.join(FIXTURES, 'csv', 'semicolon-delimited.csv'));
    expect(result.table.delimiter).toBe(';');
    expect(result.table.header).toEqual(['nom', 'quantite', 'prix']);
    expect(result.table.rows[0]).toEqual(['Cafe', '10', '2,50']);
  });

  it('preserves accented UTF-8 content', () => {
    const result = extractCsv(path.join(FIXTURES, 'csv', 'accented-content.csv'));
    expect(result.table.rows[0][0]).toBe('Café');
    expect(result.table.rows[1][0]).toBe('Éclair');
    expect(result.table.rows[0][1]).toContain('à base de grains torréfiés');
  });
});

describe('detectCsvDelimiter', () => {
  it('picks comma when it is the most frequent candidate', () => {
    expect(detectCsvDelimiter('a,b,c\n1,2,3')).toBe(',');
  });

  it('picks semicolon when it is the most frequent candidate', () => {
    expect(detectCsvDelimiter('a;b;c\n1;2;3')).toBe(';');
  });
});
