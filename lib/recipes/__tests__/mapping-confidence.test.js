import { describe, it, expect } from 'vitest';
import {
  classifyNameMatch,
  classifyRelationMapping,
  findBestNameMatch,
  isAutoWritable,
} from '../mapping-confidence.js';

describe('classifyNameMatch', () => {
  it('is exact for names identical after normalization', () => {
    expect(classifyNameMatch("Möka's Caesar", "MÖKA's Caesar").confidence).toBe('exact');
  });

  it('is high when one name is a clean substring of the other', () => {
    expect(classifyNameMatch('Latte', 'Iced Latte').confidence).toBe('high');
  });

  it('is medium for partial word overlap (half the words shared)', () => {
    expect(classifyNameMatch('Caesar Salad', 'Caesar Wrap').confidence).toBe('medium');
  });

  it('is low for minimal overlap', () => {
    expect(classifyNameMatch('Chicken Caesar Salad', 'Caesar Wrap').confidence).toBe('low');
  });

  it('is unmapped when there is no candidate', () => {
    expect(classifyNameMatch('Latte', null).confidence).toBe('unmapped');
    expect(classifyNameMatch('Latte', '').confidence).toBe('unmapped');
  });

  it('is unmapped for completely unrelated names', () => {
    expect(classifyNameMatch('Espresso', 'Burrito Breakfast').confidence).toBe('unmapped');
  });
});

describe('classifyRelationMapping', () => {
  it('is always exact when a direct relation exists — never a name heuristic', () => {
    expect(classifyRelationMapping(true).confidence).toBe('exact');
  });

  it('is unmapped when no direct relation exists', () => {
    expect(classifyRelationMapping(false).confidence).toBe('unmapped');
  });
});

describe('findBestNameMatch', () => {
  it('picks the exact match among several candidates', () => {
    const candidates = [{ id: '1', name: 'Iced Latte' }, { id: '2', name: 'Latte' }, { id: '3', name: 'Latte Macchiato' }];
    const result = findBestNameMatch('Latte', candidates);
    expect(result.candidate.id).toBe('2');
    expect(result.confidence).toBe('exact');
    expect(result.ambiguityNotes).toBeNull();
  });

  it('flags ambiguity when two candidates tie at the best confidence', () => {
    const candidates = [{ id: '1', name: 'Latte' }, { id: '2', name: 'latte' }];
    const result = findBestNameMatch('LATTE', candidates);
    expect(result.confidence).toBe('exact');
    expect(result.ambiguityNotes).toContain('2 candidates tied');
  });

  it('returns unmapped when no candidates are given', () => {
    expect(findBestNameMatch('Latte', []).confidence).toBe('unmapped');
  });

  it('never invents a match for completely unrelated names', () => {
    const candidates = [{ id: '1', name: 'Burrito Breakfast' }];
    const result = findBestNameMatch('Espresso', candidates);
    expect(result.candidate).toBeNull();
    expect(result.confidence).toBe('unmapped');
  });
});

describe('isAutoWritable', () => {
  it('only exact and high are auto-writable', () => {
    expect(isAutoWritable('exact')).toBe(true);
    expect(isAutoWritable('high')).toBe(true);
    expect(isAutoWritable('medium')).toBe(false);
    expect(isAutoWritable('low')).toBe(false);
    expect(isAutoWritable('unmapped')).toBe(false);
  });
});
