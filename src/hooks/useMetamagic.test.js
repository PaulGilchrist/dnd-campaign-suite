import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMetamagic from './useMetamagic.js';

vi.mock('./useRuntimeState.js', () => {
  const store = new Map();
  store.set('TestSorcerer', JSON.stringify({ sorceryPoints: 5 }));
  return {
    getRuntimeValue: vi.fn((characterKey, propertyName) => {
      try {
        const data = JSON.parse(localStorage.getItem(characterKey));
        return data ? data[propertyName] : null;
      } catch {
        return null;
      }
    }),
    setRuntimeValue: vi.fn((characterKey, propertyName, value) => {
      try {
        const data = JSON.parse(localStorage.getItem(characterKey)) || {};
        data[propertyName] = value;
        localStorage.setItem(characterKey, JSON.stringify(data));
      } catch { /* ignore */ }
    }),
    useRuntimeValue: vi.fn(() => null),
    addStorageChangeListener: vi.fn(() => () => {}),
  };
});

vi.mock('../services/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({
    maxSorceryPoints: 10,
    metamagicKnown: 2,
    creatingSpellSlotCosts: [],
  })),
}));

describe('spendSorceryPoints', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('TestSorcerer', JSON.stringify({ sorceryPoints: 5 }));
    vi.clearAllMocks();
  });

  it('deducts sorcery points and returns remaining', async () => {
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    const remaining = spendSorceryPoints('TestSorcerer', 3, 'test-campaign');
    expect(remaining).toBe(2);
    const stored = JSON.parse(localStorage.getItem('TestSorcerer'));
    expect(stored.sorceryPoints).toBe(2);
  });

  it('does not go below 0', async () => {
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    const remaining = spendSorceryPoints('TestSorcerer', 999, 'test-campaign');
    expect(remaining).toBe(0);
  });
});

describe('getCurrentSorceryPoints', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns stored value', async () => {
    localStorage.setItem('TestSorcerer', JSON.stringify({ sorceryPoints: 7 }));
    const { getCurrentSorceryPoints } = await import('./useMetamagic.js');
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

describe('saveLastDamageEvent / getLastDamageEvent / clearLastDamageEvent', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('stores and retrieves last damage event', async () => {
    const mod = await import('./useMetamagic.js');
    const event = { targetName: 'Goblin', rawDamage: 20, oldHp: 30 };
    mod.saveLastDamageEvent('TestSorcerer', event, 'test-campaign');
    expect(mod.getLastDamageEvent('TestSorcerer')).toEqual(event);
  });

  it('clears last damage event', async () => {
    const mod = await import('./useMetamagic.js');
    mod.saveLastDamageEvent('TestSorcerer', { targetName: 'Goblin' }, 'test-campaign');
    mod.clearLastDamageEvent('TestSorcerer', 'test-campaign');
    expect(mod.getLastDamageEvent('TestSorcerer')).toBeNull();
  });
});

describe('useMetamagic hook', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('TestSorcerer', JSON.stringify({ sorceryPoints: 5 }));
    vi.clearAllMocks();
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
