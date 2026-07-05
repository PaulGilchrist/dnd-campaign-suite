// @cleaned-by-ai
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
  setRuntimeValue: (characterKey, propertyName, value, _campaignName) => {
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

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    guid: vi.fn(() => 'test-guid-1234'),
  },
}));

// ── spendSorceryPoints ──────────────────────────────────────────────────────

describe('spendSorceryPoints', () => {
  beforeEach(() => clearStores());

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

  it('handles spending 0 points', async () => {
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    const remaining = spendSorceryPoints('TestSorcerer', 0, 'test-campaign');
    expect(remaining).toBe(5);
  });

  it('handles non-existent character starting at 0', async () => {
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    const remaining = spendSorceryPoints('UnknownCharacter', 5, 'test-campaign');
    expect(remaining).toBe(0);
  });

  it('dispatches sorcery-points-updated event', async () => {
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    spendSorceryPoints('TestSorcerer', 2, 'test-campaign');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sorcery-points-updated',
    }));
    dispatchSpy.mockRestore();
  });

  it('persists the new value in the store', async () => {
    const { spendSorceryPoints, getCurrentSorceryPoints } = await import('./useMetamagic.js');
    spendSorceryPoints('TestSorcerer', 3, 'test-campaign');
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(2);
  });
});

// ── getCurrentSorceryPoints ─────────────────────────────────────────────────

describe('getCurrentSorceryPoints', () => {
  beforeEach(() => clearStores());

  it('returns stored value', async () => {
    const { getCurrentSorceryPoints } = await import('./useMetamagic.js');
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    spendSorceryPoints('TestSorcerer', 2, 'test-campaign');
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(3);
  });

  it('returns null when no value stored', async () => {
    const { getCurrentSorceryPoints } = await import('./useMetamagic.js');
    expect(getCurrentSorceryPoints('Unknown')).toBeNull();
  });

  it('returns fallback when no value stored and fallback provided', async () => {
    const { getCurrentSorceryPoints } = await import('./useMetamagic.js');
    expect(getCurrentSorceryPoints('Unknown', 10)).toBe(10);
  });

  it('handles stored value of 0', async () => {
    const { spendSorceryPoints, getCurrentSorceryPoints } = await import('./useMetamagic.js');
    spendSorceryPoints('TestSorcerer', 5, 'test-campaign');
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(0);
  });
});

// ── getMaxSorceryPoints ─────────────────────────────────────────────────────

describe('getMaxSorceryPoints', () => {
  beforeEach(async () => {
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue({
      maxSorceryPoints: 10,
      metamagicKnown: 2,
      creatingSpellSlotCosts: [],
    });
  });

  it('returns max from class features', async () => {
    const { getMaxSorceryPoints } = await import('./useMetamagic.js');
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    expect(getMaxSorceryPoints(stats)).toBe(10);
  });

  it('returns 0 when classFeatures returns null', async () => {
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue(null);
    const { getMaxSorceryPoints } = await import('./useMetamagic.js');
    expect(getMaxSorceryPoints({ name: 'Wizard', class: { name: 'Wizard' } })).toBe(0);
  });
});

// ── logMetamagicUse ─────────────────────────────────────────────────────────

describe('logMetamagicUse', () => {
  beforeEach(() => clearStores());

  it('posts a metamagic_use log entry to the API', async () => {
    const { logMetamagicUse, spendSorceryPoints } = await import('./useMetamagic.js');
    spendSorceryPoints('TestSorcerer', 2, 'test-campaign');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', ['Empowered Spell'], 2);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/campaigns/test-campaign/log',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.type).toBe('metamagic_use');
    expect(body.characterName).toBe('TestSorcerer');
    expect(body.spellName).toBe('Fireball');
    expect(body.options).toEqual(['Empowered Spell']);
    expect(body.sorceryPointsSpent).toBe(2);
    expect(body.remainingSorceryPoints).toBe(3);

    fetchSpy.mockRestore();
  });

  it('wraps non-array options in an array', async () => {
    const { logMetamagicUse } = await import('./useMetamagic.js');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', 'Empowered Spell', 1);

    await new Promise(resolve => setTimeout(resolve, 10));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.options).toEqual(['Empowered Spell']);

    fetchSpy.mockRestore();
  });

  it('encodes campaign name in URL', async () => {
    const { logMetamagicUse } = await import('./useMetamagic.js');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    logMetamagicUse('my test campaign', 'TestSorcerer', 'Fireball', [], 1);

    await new Promise(resolve => setTimeout(resolve, 10));

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/campaigns/my%20test%20campaign/log',
      expect.anything()
    );

    fetchSpy.mockRestore();
  });
});

// ── useMetamagic hook ───────────────────────────────────────────────────────

describe('useMetamagic hook', () => {
  beforeEach(async () => {
    clearStores();
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue({
      maxSorceryPoints: 10,
      metamagicKnown: 2,
      creatingSpellSlotCosts: [],
    });
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

  it('spendSorceryPoints returns remaining value', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    let spent;
    act(() => {
      spent = result.current.spendSorceryPoints(3);
    });

    expect(spent).toBe(2);
  });

  it('spendSorceryPoints does not go below 0', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    act(() => {
      result.current.spendSorceryPoints(999);
    });

    expect(result.current.currentSP).toBe(0);
  });

  it('returns logMetamagic callback', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));
    expect(typeof result.current.logMetamagic).toBe('function');
  });

  it('logMetamagic posts a log entry via logMetamagicUse', async () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

    act(() => {
      result.current.logMetamagic('Fireball', ['Empowered Spell'], 2);
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.type).toBe('metamagic_use');
    expect(body.characterName).toBe('TestSorcerer');
    expect(body.spellName).toBe('Fireball');

    fetchSpy.mockRestore();
  });

  it('returns all expected properties', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    expect(result.current).toHaveProperty('currentSP');
    expect(result.current).toHaveProperty('maxSP');
    expect(result.current).toHaveProperty('spendSorceryPoints');
    expect(result.current).toHaveProperty('logMetamagic');
  });

  it('handles null playerStats gracefully', async () => {
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue(null);

    const { result } = renderHook(() => useMetamagic(null, 'test-campaign'));
    expect(result.current.currentSP).toBe(0);
    expect(result.current.maxSP).toBe(0);
  });
});
