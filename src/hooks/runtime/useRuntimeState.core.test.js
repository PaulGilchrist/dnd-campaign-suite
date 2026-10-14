import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRuntimeValue,
  clearRuntimeState,
  getAllStoreKeys,
  seedTrackedResources,
  addStorageChangeListener,
  setRuntimeValue,
  hasRuntimeValue,
  getStore,
  setRuntimeObject,
  setRuntimeBatch,
  notify,
  listeners,
  getRuntimeKeysByPrefix,
} from './useRuntimeState.js';

function clearAll() {
  const keys = getAllStoreKeys();
  for (const key of keys) {
    clearRuntimeState(key);
  }
  listeners.clear();
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

  it('logs error to console when reading campaign-level key with wrong characterKey', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    getRuntimeValue('test-char', 'targetEffects');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[getRuntimeValue] Campaign-level key read with wrong characterKey'),
      expect.objectContaining({ characterKey: 'test-char', propertyName: 'targetEffects' })
    );
    consoleErrorSpy.mockRestore();
  });

  it('returns null for a key that was cleared', () => {
    seedTrackedResources('test-char', { hp: 10 });
    expect(getRuntimeValue('test-char', 'hp')).toBe(10);
    clearRuntimeState('test-char');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });
});

describe('useRuntimeState — setRuntimeValue', () => {
  beforeEach(() => {
    clearAll();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    global.fetch.mockClear();
  });

  it('sets a value in the store and sends a POST request', () => {
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/campaigns/test-campaign/test-char');
    expect(callArgs[1].method).toBe('POST');
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
  });

  it('handles campaign-level characterKey with single property POST format', () => {
    setRuntimeValue('campaign', 'gameMode', 'dm', 'test-campaign');
    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/campaigns/test-campaign/gameMode');
    const body = JSON.parse(callArgs[1].body);
    expect(body).toEqual({ value: 'dm' });
  });

  it('encodes special characters in campaign name and character key', () => {
    setRuntimeValue('my char', 'hp', 15, 'my campaign');
    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/campaigns/my%20campaign/my%20char');
  });

  it('does not POST or notify when value is unchanged', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls.length).toBe(1);

    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls.length).toBe(1);
  });

  it('does not POST when number-string equality matches', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeValue('test-char', 'hp', 15, 'test-campaign');
    setRuntimeValue('test-char', 'hp', '15', 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls.length).toBe(1);
  });

  it('logs error when campaignName is undefined', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    setRuntimeValue('test-char', 'hp', 15, undefined);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'setRuntimeValue called with undefined campaignName',
      expect.objectContaining({ characterKey: 'test-char' })
    );
    consoleErrorSpy.mockRestore();
  });

  it('logs error when setting campaign-level key with wrong characterKey', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    setRuntimeValue('test-char', 'targetEffects', [], 'test-campaign');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[setRuntimeValue] Campaign-level key written with wrong characterKey'),
      expect.objectContaining({ characterKey: 'test-char', propertyName: 'targetEffects' })
    );
    consoleErrorSpy.mockRestore();
  });
});

describe('useRuntimeState — setRuntimeObject', () => {
  beforeEach(() => {
    clearAll();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    global.fetch.mockClear();
  });

  it('sets multiple properties at once', () => {
    setRuntimeObject('test-char', { hp: 15, sp: 10, maxHp: 20, maxSp: 15 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(10);
    expect(getRuntimeValue('test-char', 'maxHp')).toBe(20);
    expect(getRuntimeValue('test-char', 'maxSp')).toBe(15);
  });

  it('does not POST when skipSync is true', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign', true);
    expect(global.fetch.mock.calls.length).toBe(0);
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
  });

  it('does not POST when no values changed', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(global.fetch.mock.calls.length).toBe(1);
  });

  it('does not trigger listeners when no values changed', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('triggers listeners only once even when multiple properties change', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', { hp: 15, sp: 10 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not seed when passed null, undefined, or non-object', () => {
    setRuntimeObject('test-char', null, 'test-campaign');
    setRuntimeObject('test-char', undefined, 'test-campaign');
    setRuntimeObject('test-char', 'string', 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('handles empty object (no changes)', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeObject('test-char', {}, 'test-campaign');
    setRuntimeObject('test-char', {}, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(0);
    expect(global.fetch.mock.calls.length).toBe(0);
  });

  it('does not POST when number-string equality matches', () => {
    setRuntimeObject('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeObject('test-char', { hp: '15' }, 'test-campaign');
    expect(global.fetch.mock.calls.length).toBe(1);
  });
});

describe('useRuntimeState — setRuntimeBatch', () => {
  beforeEach(() => {
    clearAll();
    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    global.fetch.mockClear();
  });

  it('updates multiple properties and POSTs once', () => {
    setRuntimeBatch('test-char', { hp: 15, sp: 10, maxHp: 20 }, 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBe(15);
    expect(getRuntimeValue('test-char', 'sp')).toBe(10);
    expect(getRuntimeValue('test-char', 'maxHp')).toBe(20);
    const callArgs = global.fetch.mock.calls[0];
    expect(callArgs[0]).toBe('/api/campaigns/test-campaign/test-char');
    const body = JSON.parse(callArgs[1].body);
    expect(body.value).toHaveProperty('hp', 15);
    expect(body.value).toHaveProperty('sp', 10);
    expect(body.value).toHaveProperty('maxHp', 20);
  });

  it('does not POST when no values changed', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    expect(listener).toHaveBeenCalledTimes(1);
    const firstCallCount = global.fetch.mock.calls.length;
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    expect(global.fetch.mock.calls.length).toBe(firstCallCount);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not POST when number-string equality matches', () => {
    setRuntimeBatch('test-char', { hp: 15 }, 'test-campaign');
    setRuntimeBatch('test-char', { hp: '15' }, 'test-campaign');
    expect(global.fetch.mock.calls.length).toBe(1);
  });

  it('does not seed when passed null, undefined, or non-object', () => {
    setRuntimeBatch('test-char', null, 'test-campaign');
    setRuntimeBatch('test-char', undefined, 'test-campaign');
    setRuntimeBatch('test-char', 'string', 'test-campaign');
    expect(getRuntimeValue('test-char', 'hp')).toBeNull();
  });

  it('logs error when campaignName is undefined', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    setRuntimeBatch('test-char', { hp: 15 }, undefined);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'setRuntimeBatch called with undefined campaignName',
      expect.objectContaining({ characterKey: 'test-char' })
    );
    consoleErrorSpy.mockRestore();
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

  it('removes the character key from getAllStoreKeys', () => {
    seedTrackedResources('test-char', { hp: 10 });
    expect(getAllStoreKeys()).toContain('test-char');
    clearRuntimeState('test-char');
    expect(getAllStoreKeys()).not.toContain('test-char');
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

  it('includes pendingExpirations key created by seedTrackedResources', () => {
    seedTrackedResources('test-char', { hp: 10 });
    expect(getAllStoreKeys()).toContain('test-char');
    const store = getStore('test-char');
    expect(store.has('pendingExpirations')).toBe(true);
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

  it('creates pendingExpirations array on first seed', () => {
    seedTrackedResources('test-char', { hp: 10 });
    const store = getStore('test-char');
    expect(store.get('pendingExpirations')).toEqual([]);
  });

  it('does not create pendingExpirations when seeding invalid input', () => {
    seedTrackedResources('test-char', null);
    const store = getStore('test-char');
    expect(store.has('pendingExpirations')).toBe(false);
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

  it('can remove one listener without affecting others', () => {
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    const cleanup1 = addStorageChangeListener('test-char', listener1);
    addStorageChangeListener('test-char', listener2);

    vi.spyOn(global, 'fetch').mockResolvedValue(undefined);
    setRuntimeValue('test-char', 'hp', 10, 'test-campaign');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(1);

    cleanup1();
    setRuntimeValue('test-char', 'sp', 5, 'test-campaign');
    expect(listener1).toHaveBeenCalledTimes(1);
    expect(listener2).toHaveBeenCalledTimes(2);
  });

  it('notifies listeners via direct notify() call', () => {
    const listener = vi.fn();
    addStorageChangeListener('test-char', listener);
    notify('test-char');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('handles notify for character with no listeners', () => {
    expect(() => notify('no-listeners')).not.toThrow();
  });
});

describe('useRuntimeState — hasRuntimeValue', () => {
  beforeEach(() => {
    clearAll();
  });

  it('returns true when a property exists with a value', () => {
    seedTrackedResources('test-char', { hp: 15 });
    expect(hasRuntimeValue('test-char', 'hp')).toBe(true);
  });

  it('returns true when a property exists with null value', () => {
    seedTrackedResources('test-char', { hp: null });
    expect(hasRuntimeValue('test-char', 'hp')).toBe(true);
  });

  it('returns true when a property exists with falsy values', () => {
    seedTrackedResources('test-char', { hp: 0, active: false, name: '' });
    expect(hasRuntimeValue('test-char', 'hp')).toBe(true);
    expect(hasRuntimeValue('test-char', 'active')).toBe(true);
    expect(hasRuntimeValue('test-char', 'name')).toBe(true);
  });

  it('returns false when a property has never been set', () => {
    expect(hasRuntimeValue('test-char', 'hp')).toBe(false);
  });

  it('returns false after clearRuntimeState', () => {
    seedTrackedResources('test-char', { hp: 10 });
    expect(hasRuntimeValue('test-char', 'hp')).toBe(true);
    clearRuntimeState('test-char');
    expect(hasRuntimeValue('test-char', 'hp')).toBe(false);
  });

  it('distinguishes between null value and unset key', () => {
    // nullVal is explicitly set to null
    seedTrackedResources('test-char', { nullVal: null });

    expect(hasRuntimeValue('test-char', 'nullVal')).toBe(true);
    expect(getRuntimeValue('test-char', 'nullVal')).toBeNull();
    expect(hasRuntimeValue('test-char', 'unsetVal')).toBe(false);
    expect(getRuntimeValue('test-char', 'unsetVal')).toBeNull();
  });
});

describe('useRuntimeState — getStore', () => {
  beforeEach(() => {
    clearAll();
  });

  it('creates a new store for a character key that does not exist', () => {
    const store = getStore('new-char');
    expect(store).toBeInstanceOf(Map);
    expect(getAllStoreKeys()).toContain('new-char');
  });

  it('returns the same store instance for the same character key', () => {
    const store1 = getStore('test-char');
    const store2 = getStore('test-char');
    expect(store1).toBe(store2);
  });

  it('returns independent stores for different character keys', () => {
    const storeA = getStore('char-a');
    const storeB = getStore('char-b');
    expect(storeA).not.toBe(storeB);
    storeA.set('hp', 10);
    expect(storeB.get('hp')).toBeUndefined();
  });
});

describe('useRuntimeState — getRuntimeKeysByPrefix', () => {
  beforeEach(() => {
    clearAll();
  });

  it('returns empty array for a character with no store', () => {
    expect(getRuntimeKeysByPrefix('missing-char', 'majesty')).toEqual([]);
  });

  it('returns only property names matching the prefix', () => {
    seedTrackedResources('test-char', {
      unbreakableMajestyBlocked_Goblin: { round: 1 },
      unbreakableMajestyBlocked_Orc: { round: 2 },
      unbreakableMajestyActive: true,
      hp: 10,
    });

    const keys = getRuntimeKeysByPrefix('test-char', 'unbreakableMajestyBlocked_');
    expect(keys).toEqual(['unbreakableMajestyBlocked_Goblin', 'unbreakableMajestyBlocked_Orc']);
  });

  it('sees keys hydrated via setRuntimeObject', () => {
    setRuntimeObject('test-char', {
      unbreakableMajestyBlocked_Ogre: { round: 5 },
      hp: 20,
    }, 'test-campaign', true);

    expect(getRuntimeKeysByPrefix('test-char', 'unbreakableMajestyBlocked_')).toEqual([
      'unbreakableMajestyBlocked_Ogre',
    ]);
  });

  it('includes keys explicitly set to null', () => {
    seedTrackedResources('test-char', { unbreakableMajestyBlocked_Goblin: null });

    expect(getRuntimeKeysByPrefix('test-char', 'unbreakableMajestyBlocked_')).toEqual([
      'unbreakableMajestyBlocked_Goblin',
    ]);
  });

  it('does not leak keys from other character stores', () => {
    seedTrackedResources('char-a', { unbreakableMajestyBlocked_Goblin: { round: 1 } });
    seedTrackedResources('char-b', { hp: 5 });

    expect(getRuntimeKeysByPrefix('char-b', 'unbreakableMajestyBlocked_')).toEqual([]);
  });
});
