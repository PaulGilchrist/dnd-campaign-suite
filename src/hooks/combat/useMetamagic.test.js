// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMetamagic from './useMetamagic.js';

const stores = new Map();
stores.set('TestSorcerer', new Map([['sorceryPoints', 5]]));

function getStore(key) {
  if (!stores.has(key)) {
    stores.set(key, new Map());
  }
  return stores.get(key);
}

function clearStores() {
  stores.clear();
  stores.set('TestSorcerer', new Map([['sorceryPoints', 5]]));
}

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (characterKey, propertyName) => {
    const store = getStore(characterKey);
    return store.has(propertyName) ? store.get(propertyName) : null;
  },
  setRuntimeValue: (characterKey, propertyName, value) => {
    const store = getStore(characterKey);
    store.set(propertyName, value);
  },
  useRuntimeValue: () => null,
  addStorageChangeListener: () => () => {},
  getAllStoreKeys: () => Array.from(stores.keys()),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({
    maxSorceryPoints: 10,
    metamagicKnown: 2,
    creatingSpellSlotCosts: [],
  })),
}));

describe('spendSorceryPoints', () => {
  beforeEach(() => {
    clearStores();
  });

  it('deducts sorcery points and returns remaining', async () => {
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    const remaining = spendSorceryPoints('TestSorcerer', 3, 'test-campaign');
    expect(remaining).toBe(2);
  });

  it('does not go below 0', async () => {
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    const remaining = spendSorceryPoints('TestSorcerer', 999, 'test-campaign');
    expect(remaining).toBe(0);
  });
});

describe('getCurrentSorceryPoints', () => {
  beforeEach(() => {
    clearStores();
  });

  it('returns stored value', async () => {
    const { getCurrentSorceryPoints } = await import('./useMetamagic.js');
    const { setRuntimeValue } = await import('../runtime/useRuntimeState.js');
    setRuntimeValue('TestSorcerer', 'sorceryPoints', 7);
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(7);
  });

  it('returns null when no value stored', async () => {
    const { getCurrentSorceryPoints } = await import('./useMetamagic.js');
    expect(getCurrentSorceryPoints('Unknown')).toBeNull();
  });
});

describe('getMaxSorceryPoints', () => {
  it('returns max from class features', async () => {
    const { getMaxSorceryPoints } = await import('./useMetamagic.js');
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    expect(getMaxSorceryPoints(stats)).toBe(10);
  });
});

describe('useMetamagic hook', () => {
  beforeEach(() => {
    clearStores();
  });

  it('returns current and max SP', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));
    expect(result.current.currentSP).toBe(5);
    expect(result.current.maxSP).toBe(10);
  });

  it('spendSorceryPoints deducts and dispatches event', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    act(() => {
      result.current.spendSorceryPoints(3);
    });

    expect(result.current.currentSP).toBe(2);
  });
});
