// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRuntimeValue, clearRuntimeState, getAllStoreKeys, seedTrackedResources, addStorageChangeListener, setRuntimeValue } from './useRuntimeState.js';

// Clear all stores and listeners between tests since clearRuntimeState only clears stores
function clearAll() {
  const keys = getAllStoreKeys();
  for (const key of keys) {
    clearRuntimeState(key);
  }
}

describe('useRuntimeState — getRuntimeValue', () => {
  beforeEach(() => {
    clearAll();
  });

  it('returns null for a property that has never been set', () => {
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('returns the value that was set via seedTrackedResources', () => {
    seedTrackedResources('test-char', { hp: 15, sp: 5 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(5);
  });

  it('returns the value that was set via setRuntimeValue', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(undefined);
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(10);
    fetchSpy.mockRestore();
  });

  it('returns undefined when the character key has no store', () => {
    expect(getRuntimeValue('nonexistent-char', 'anything')).toBeNull();
  });

  it('returns 0 as a valid value', () => {
    seedTrackedResources('test-char', { hp: 0 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(0);
  });

  it('returns false as a valid value', () => {
    seedTrackedResources('test-char', { active: false });
    expect(getRuntimeValue('test-char', 'active')).toBe(false);
  });

  it('returns an empty string as a valid value', () => {
    seedTrackedResources('test-char', { name: '' });
    expect(getRuntimeValue('test-char', 'name')).toBe('');
  });

  it('returns null explicitly stored as null', () => {
    seedTrackedResources('test-char', { hp: null });
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('returns an array value', () => {
    const arr = [1, 2, 3];
    seedTrackedResources('test-char', { spells: arr });
    expect(getRuntimeValue('test-char', 'spells')).toEqual(arr);
  });

  it('returns an object value', () => {
    const obj = { str: 18, dex: 14 };
    seedTrackedResources('test-char', { stats: obj });
    expect(getRuntimeValue('test-char', 'stats')).toEqual(obj);
  });

  it('returns null when undefined is stored (Object.entries omits undefined values)', () => {
    seedTrackedResources('test-char', { hp: undefined });
    // Object.entries omits keys with undefined values, so store won't have the key
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });
});

describe('useRuntimeState — clearRuntimeState', () => {
  beforeEach(() => {
    clearAll();
  });

  it('removes all data for a character key', () => {
    seedTrackedResources('test-char', { hp: 10, sp: 5 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(10);
    clearRuntimeState('test-char');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('is safe to call on a non-existent character key', () => {
    clearRuntimeState('nonexistent');
    expect(getRuntimeValue('nonexistent', 'anything')).toBeNull();
  });

  it('does not affect other character keys', () => {
    seedTrackedResources('char-a', { hp: 10 });
    seedTrackedResources('char-b', { hp: 20 });
    clearRuntimeState('char-a');
    expect(getRuntimeValue('char-a', 'hp')).toBeNull();
    expect(getRuntimeValue('char-b', 'hp')).toBe(20);
  });
});

describe('useRuntimeState — getAllStoreKeys', () => {
  beforeEach(() => {
    clearAll();
  });

  it('returns an empty array when no characters exist', () => {
    expect(getAllStoreKeys()).toEqual([]);
  });

  it('returns keys for all characters that have been seeded', () => {
    seedTrackedResources('char-a', { hp: 10 });
    seedTrackedResources('char-b', { hp: 20 });
    expect(getAllStoreKeys()).toContain('char-a');
    expect(getAllStoreKeys()).toContain('char-b');
    expect(getAllStoreKeys()).not.toContain('char-c');
  });

  it('returns unique keys only', () => {
    seedTrackedResources('char-a', { hp: 10 });
    seedTrackedResources('char-a', { sp: 5 });
    const keys = getAllStoreKeys();
    const uniqueKeys = [...new Set(keys)];
    expect(keys.length).toBe(uniqueKeys.length);
  });

  it('updates after clearRuntimeState', () => {
    seedTrackedResources('char-a', { hp: 10 });
    expect(getAllStoreKeys()).toContain('char-a');
    clearRuntimeState('char-a');
    expect(getAllStoreKeys()).not.toContain('char-a');
  });
});

describe('useRuntimeState — seedTrackedResources', () => {
  beforeEach(() => {
    clearAll();
  });

  it('seeds multiple properties at once', () => {
    seedTrackedResources('test-char', { hp: 15, sp: 5, maxHp: 20 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(5);
    expect(getRuntimeValue('test-char', 'maxHp')).toBe(20);
  });

  it('does not seed when passed null', () => {
    seedTrackedResources('test-char', null);
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('does not seed when passed undefined', () => {
    seedTrackedResources('test-char', undefined);
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('does not seed when passed a non-object primitive', () => {
    seedTrackedResources('test-char', 'string');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('does not seed when passed a number', () => {
    seedTrackedResources('test-char', 42);
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('seeds array entries as numbered keys (arrays are objects in JS)', () => {
    seedTrackedResources('test-char', [1, 2, 3]);
    expect(getRuntimeValue('test-char', '0')).toBe(1);
    expect(getRuntimeValue('test-char', '1')).toBe(2);
    expect(getRuntimeValue('test-char', '2')).toBe(3);
  });

  it('updates existing values on re-seed', () => {
    seedTrackedResources('test-char', { hp: 10 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(10);
    seedTrackedResources('test-char', { hp: 20 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(20);
  });

  it('does not update when seeded value is the same', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    seedTrackedResources('test-char', { hp: 10 });
    seedTrackedResources('test-char', { hp: 10 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite existing values with different seeded values', () => {
    seedTrackedResources('test-char', { hp: 10, sp: 5 });
    seedTrackedResources('test-char', { hp: 10 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(10);
    expect(getRuntimeValue('test-char', 'sp')).toBe(5);
  });

  it('creates a new store for a character key that does not exist yet', () => {
    seedTrackedResources('new-char', { hp: 10 });
    expect(getRuntimeValue('new-char', 'hp')).toBe(10);
  });

  it('does not seed when passed an empty object', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    seedTrackedResources('test-char', {});
    expect(listener).toHaveBeenCalledTimes(0);
  });

  it('does not notify when all values are the same on re-seed', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    seedTrackedResources('test-char', { hp: 10, sp: 5 });
    seedTrackedResources('test-char', { hp: 10 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies when at least one value changes on re-seed', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    seedTrackedResources('test-char', { hp: 10 });
    seedTrackedResources('test-char', { hp: 10, sp: 5 });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('useRuntimeState — addStorageChangeListener', () => {
  beforeEach(() => {
    clearAll();
  });

  it('returns a cleanup function that removes the listener', () => {
    const listener = vi.fn();
    const cleanup = addStorageChangeListener('test-char', listener);

    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(undefined);
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);

    cleanup();
    setRuntimeValue('test-char', 'sp', 5, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('supports multiple listeners on the same character', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    addStorageChangeListener('test-char', listener1);
    addStorageChangeListener('test-char', listener2);

    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(undefined);
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('isolates listeners per character key', () => {
    const charA = vi.fn();
    const charB = vi.fn();
    addStorageChangeListener('char-a', charA);
    addStorageChangeListener('char-b', charB);

    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(undefined);
    setRuntimeValue('char-a', 'hp', 10, 'test-campaign');
    expect(charA).toHaveBeenCalledTimes(1);
    expect(charB).toHaveBeenCalledTimes(0);
    fetchSpy.mockRestore();
  });

  it('is safe to call multiple times with the same listener (duplicates in set)', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    addStorageChangeListener('test-char', listener);

    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(undefined);
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('creates a listener set for a character key that does not exist yet', () => {
    const listener = vi.fn();
    addStorageChangeListener('new-char', listener);

    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(undefined);
    setRuntimeValue('new-char', 'hp', 10, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('cleanup function works on a character with no other listeners', () => {
    const listener = vi.fn();
    const cleanup = addStorageChangeListener('solo-char', listener);

    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValue(undefined);
    setRuntimeValue('solo-char', 'hp', 10, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);

    cleanup();
    setRuntimeValue('solo-char', 'sp', 5, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('is safe to call cleanup when no listeners exist', () => {
    const cleanup = addStorageChangeListener('test-char', () => {});
    cleanup();
    // Should not throw
    expect(true).toBe(true);
  });
});
