// @cleaned-by-ai
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
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(10);
  });

  it('returns falsy values correctly (0, false, empty string, null)', () => {
    seedTrackedResources('test-char', { hp: 0, active: false, name: '', empty: null });
    expect(getRuntimeValue('test-char', 'hp')).toBe(0);
    expect(getRuntimeValue('test-char', 'active')).toBe(false);
    expect(getRuntimeValue('test-char', 'name')).toBe('');
    expect(getRuntimeValue('test-char', 'empty')).toBeNull();
  });

  it('returns complex values (arrays and objects)', () => {
    seedTrackedResources('test-char', {
      spells: [1, 2, 3],
      stats: { str: 18, dex: 14 },
    });
    expect(getRuntimeValue('test-char', 'spells')).toEqual([1, 2, 3]);
    expect(getRuntimeValue('test-char', 'stats')).toEqual({ str: 18, dex: 14 });
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

  it('does not seed when passed null, undefined, or non-object', () => {
    seedTrackedResources('test-char', null);
    seedTrackedResources('test-char', undefined);
    seedTrackedResources('test-char', 'string');
    seedTrackedResources('test-char', 42);
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('updates existing values on re-seed', () => {
    seedTrackedResources('test-char', { hp: 10 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(10);
    seedTrackedResources('test-char', { hp: 20 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(20);
  });

  it('does not overwrite existing values with same seeded values', () => {
    seedTrackedResources('test-char', { hp: 10, sp: 5 });
    seedTrackedResources('test-char', { hp: 10 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(10);
    expect(getRuntimeValue('test-char', 'sp')).toBe(5);
  });

  it('notifies listeners when at least one value changes on re-seed', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    seedTrackedResources('test-char', { hp: 10 });
    seedTrackedResources('test-char', { hp: 10, sp: 5 });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('does not notify listeners when no values change on re-seed', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    seedTrackedResources('test-char', { hp: 10 });
    seedTrackedResources('test-char', { hp: 10 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('useRuntimeState — addStorageChangeListener', () => {
  beforeEach(() => {
    clearAll();
  });

  it('returns a cleanup function that removes the listener', () => {
    const listener = vi.fn();
    const cleanup = addStorageChangeListener('test-char', listener);

    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);

    cleanup();
    setRuntimeValue('test-char', 'sp', 5, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports multiple listeners on the same character', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    addStorageChangeListener('test-char', listener1);
    addStorageChangeListener('test-char', listener2);

    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);
  });

  it('isolates listeners per character key', () => {
    const charA = vi.fn();
    const charB = vi.fn();
    addStorageChangeListener('char-a', charA);
    addStorageChangeListener('char-b', charB);

    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    setRuntimeValue('char-a', 'hp', 10, 'test-campaign');
    expect(charA).toHaveBeenCalledTimes(1);
    expect(charB).toHaveBeenCalledTimes(0);
  });
});
