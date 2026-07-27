import { describe, it, expect } from 'vitest';
import { resolveOperationId, clearOperationId } from '../operation-id.js';

function createFakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

describe('resolveOperationId', () => {
  it('mints a fresh id on first call for an item', () => {
    const storage = createFakeStorage();
    const id = resolveOperationId('item-1', storage);
    expect(id).toBeTruthy();
  });

  it('returns the SAME id across repeated calls for the same item — survives a modal close/reopen', () => {
    const storage = createFakeStorage();
    const first = resolveOperationId('item-1', storage);
    const second = resolveOperationId('item-1', storage); // simulates closing and reopening the modal
    expect(second).toBe(first);
  });

  it('gives different items different ids', () => {
    const storage = createFakeStorage();
    const a = resolveOperationId('item-1', storage);
    const b = resolveOperationId('item-2', storage);
    expect(a).not.toBe(b);
  });

  it('mints a new id after the previous one was cleared (a genuinely new receipt)', () => {
    const storage = createFakeStorage();
    const first = resolveOperationId('item-1', storage);
    clearOperationId('item-1', storage);
    const second = resolveOperationId('item-1', storage);
    expect(second).not.toBe(first);
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => resolveOperationId('item-1', null)).not.toThrow();
    expect(() => clearOperationId('item-1', null)).not.toThrow();
  });
});
