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

function getDefaultClassFeatures() {
  return {
    maxSorceryPoints: 10,
    metamagicKnown: 2,
    creatingSpellSlotCosts: [],
  };
}

// ── spendSorceryPoints ──────────────────────────────────────────────────────

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

  it('handles string-like stored values via Number() coercion', async () => {
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    // Pre-set stored value as string
    const store = getStore('TestSorcerer');
    store.set('sorceryPoints', '8');
    const remaining = spendSorceryPoints('TestSorcerer', 3, 'test-campaign');
    expect(remaining).toBe(5);
  });
});

// ── getCurrentSorceryPoints ─────────────────────────────────────────────────

describe('getCurrentSorceryPoints', () => {
  beforeEach(() => {
    clearStores();
  });

  it('returns stored value', async () => {
    const { getCurrentSorceryPoints } = await import('./useMetamagic.js');
    const { spendSorceryPoints } = await import('./useMetamagic.js');
    spendSorceryPoints('TestSorcerer', 2, 'test-campaign'); // sets to 3
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

  it('returns fallback 0 when no value stored', async () => {
    const { getCurrentSorceryPoints } = await import('./useMetamagic.js');
    expect(getCurrentSorceryPoints('Unknown', 0)).toBe(0);
  });

  it('handles stored value of 0', async () => {
    const { spendSorceryPoints, getCurrentSorceryPoints } = await import('./useMetamagic.js');
    spendSorceryPoints('TestSorcerer', 5, 'test-campaign'); // sets to 0
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(0);
  });

  it('returns null when fallback is undefined (default param)', async () => {
    const { getCurrentSorceryPoints } = await import('./useMetamagic.js');
    // When no second arg, the default param is null
    expect(getCurrentSorceryPoints('Unknown')).toBeNull();
  });
});

// ── getMaxSorceryPoints ─────────────────────────────────────────────────────

describe('getMaxSorceryPoints', () => {
  beforeEach(async () => {
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue(getDefaultClassFeatures());
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
    const stats = { name: 'Wizard', class: { name: 'Wizard' } };
    expect(getMaxSorceryPoints(stats)).toBe(0);
  });

  it('returns 0 when classFeatures returns undefined', async () => {
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue(undefined);
    const { getMaxSorceryPoints } = await import('./useMetamagic.js');
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    expect(getMaxSorceryPoints(stats)).toBe(0);
  });

  it('returns 0 when maxSorceryPoints is missing from features', async () => {
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue({ metamagicKnown: 2 });
    const { getMaxSorceryPoints } = await import('./useMetamagic.js');
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    expect(getMaxSorceryPoints(stats)).toBe(0);
  });

  it('passes null to getClassFeatures which the mock handles', async () => {
    const { getMaxSorceryPoints } = await import('./useMetamagic.js');
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue(null);
    expect(getMaxSorceryPoints(null)).toBe(0);
  });

  it('passes undefined to getClassFeatures which the mock handles', async () => {
    const { getMaxSorceryPoints } = await import('./useMetamagic.js');
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue(null);
    expect(getMaxSorceryPoints(undefined)).toBe(0);
  });
});

// ── logMetamagicUse ─────────────────────────────────────────────────────────

describe('logMetamagicUse', () => {
  beforeEach(() => {
    clearStores();
  });

  it('posts a metamagic_use log entry to the API', async () => {
    const { logMetamagicUse, spendSorceryPoints } = await import('./useMetamagic.js');
    spendSorceryPoints('TestSorcerer', 2, 'test-campaign'); // sets to 3

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    });
    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', ['Empowered Spell'], 2);

    // Wait for the async fetch to complete
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
    expect(body.timestamp).toBeTypeOf('number');
    expect(body.id).toBeTypeOf('string');

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

  it('uses remaining SP after spending from store', async () => {
    const { logMetamagicUse, spendSorceryPoints } = await import('./useMetamagic.js');
    spendSorceryPoints('TestSorcerer', 3, 'test-campaign'); // sets to 2
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', 'Quickened Spell', 2);

    await new Promise(resolve => setTimeout(resolve, 10));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.remainingSorceryPoints).toBe(2);

    fetchSpy.mockRestore();
  });

  it('handles empty options array', async () => {
    const { logMetamagicUse } = await import('./useMetamagic.js');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', [], 0);

    await new Promise(resolve => setTimeout(resolve, 10));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.options).toEqual([]);

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

  it('includes all required fields in the log entry', async () => {
    const { logMetamagicUse } = await import('./useMetamagic.js');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });
    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', ['Empowered Spell'], 2);

    await new Promise(resolve => setTimeout(resolve, 10));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const requiredFields = ['type', 'characterName', 'spellName', 'options', 'sorceryPointsSpent', 'remainingSorceryPoints', 'timestamp', 'id'];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }

    fetchSpy.mockRestore();
  });
});

// ── useMetamagic hook ───────────────────────────────────────────────────────

describe('useMetamagic hook', () => {
  beforeEach(async () => {
    clearStores();
    // Reset classFeatures mock to default
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue(getDefaultClassFeatures());
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

  it('spendSorceryPoints with 0 amount does not change value', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    act(() => {
      result.current.spendSorceryPoints(0);
    });

    expect(result.current.currentSP).toBe(5);
  });

  it('updates currentSP when sorcery-points-updated event fires', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    act(() => {
      result.current.spendSorceryPoints(3);
    });
    expect(result.current.currentSP).toBe(2);

    act(() => {
      window.dispatchEvent(new CustomEvent('sorcery-points-updated'));
    });

    // The event handler reads from store which was already updated by spend
    expect(result.current.currentSP).toBe(2);
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

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/campaigns/test-campaign/log',
      expect.objectContaining({
        method: 'POST',
      })
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.type).toBe('metamagic_use');
    expect(body.characterName).toBe('TestSorcerer');
    expect(body.spellName).toBe('Fireball');

    fetchSpy.mockRestore();
  });

  it('logMetamagic wraps non-array options in an array', async () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true });

    act(() => {
      result.current.logMetamagic('Fireball', 'Empowered Spell', 1);
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.options).toEqual(['Empowered Spell']);

    fetchSpy.mockRestore();
  });

  it('returns all expected properties', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    expect(result.current).toHaveProperty('currentSP');
    expect(result.current).toHaveProperty('maxSP');
    expect(result.current).toHaveProperty('spendSorceryPoints');
    expect(result.current).toHaveProperty('logMetamagic');
    expect(typeof result.current.currentSP).toBe('number');
    expect(typeof result.current.maxSP).toBe('number');
    expect(typeof result.current.spendSorceryPoints).toBe('function');
    expect(typeof result.current.logMetamagic).toBe('function');
  });

  it('handles null playerStats gracefully', async () => {
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue(null);

    const { result } = renderHook(() => useMetamagic(null, 'test-campaign'));
    expect(result.current.currentSP).toBe(0);
    expect(result.current.maxSP).toBe(0);
  });

  it('handles undefined playerStats gracefully', async () => {
    const classFeatures = await import('../../services/character/classFeatures.js');
    classFeatures.getClassFeatures.mockReturnValue(null);

    const { result } = renderHook(() => useMetamagic(undefined, 'test-campaign'));
    expect(result.current.currentSP).toBe(0);
    expect(result.current.maxSP).toBe(0);
  });

  it('spendSorceryPoints dispatches sorcery-points-updated event twice (internal + hook)', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    act(() => {
      result.current.spendSorceryPoints(3);
    });

    // spendSorceryPoints (standalone) dispatches once, then the hook's spend callback dispatches again
    expect(dispatchSpy).toHaveBeenCalledTimes(2);

    dispatchSpy.mockRestore();
  });
});
