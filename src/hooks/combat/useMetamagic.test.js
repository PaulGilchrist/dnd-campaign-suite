// @maintained-by-ai: 2026-10-14
// Authoritative unit tests for useMetamagic.js — the shared sorcery-point
// state helpers (spend / read / max / log). Sibling lanes (useActionSpellMetamagic,
// useSpellMetamagicFlow, automation handlers) mock this module, so only here is
// the real implementation exercised. Max-SP data fidelity lives in classRules*.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useMetamagic, {
  spendSorceryPoints,
  getCurrentSorceryPoints,
  getMaxSorceryPoints,
  logMetamagicUse,
} from './useMetamagic.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const stores = new Map();

function getStore(key) {
  if (!stores.has(key)) {
    stores.set(key, new Map());
  }
  return stores.get(key);
}

function setSorceryPoints(characterName, value) {
  getStore(characterName).set('sorceryPoints', value);
}

// Captures addStorageChangeListener registrations so tests can fire the
// store-change path the hook subscribes to.
const storageListeners = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (characterKey, propertyName) => {
    const store = getStore(characterKey);
    return store.has(propertyName) ? store.get(propertyName) : null;
  },
  setRuntimeValue: (characterKey, propertyName, value) => {
    getStore(characterKey).set(propertyName, value);
  },
  addStorageChangeListener: (_characterKey, listener) => {
    storageListeners.push(listener);
    return () => {
      const i = storageListeners.indexOf(listener);
      if (i >= 0) storageListeners.splice(i, 1);
    };
  },
}));

const mockGetClassFeatures = vi.fn();
vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: (...args) => mockGetClassFeatures(...args),
}));

const mockGuid = vi.fn(() => 'test-guid-1234');
vi.mock('../../services/ui/utils.js', () => ({
  default: {
    guid: (...args) => mockGuid(...args),
  },
}));

const mockAddEntry = vi.fn();
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: (...args) => mockAddEntry(...args),
}));

const SORCERER = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
const CAMPAIGN = 'test-campaign';

function resetFixture() {
  stores.clear();
  setSorceryPoints('TestSorcerer', 5);
  vi.clearAllMocks();
  mockGetClassFeatures.mockImplementation((stats) =>
    stats?.class?.name === 'Sorcerer'
      ? { maxSorceryPoints: 10, metamagicKnown: 2, creatingSpellSlotCosts: [] }
      : null
  );
  mockAddEntry.mockResolvedValue({});
}

beforeEach(resetFixture);

// ── spendSorceryPoints ──────────────────────────────────────────────────────

describe('spendSorceryPoints', () => {
  it('deducts points, persists the new value, and dispatches sorcery-points-updated', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const remaining = spendSorceryPoints('TestSorcerer', 3, CAMPAIGN);

    expect(remaining).toBe(2);
    expect(getStore('TestSorcerer').get('sorceryPoints')).toBe(2);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sorcery-points-updated' })
    );
    dispatchSpy.mockRestore();
  });

  it('clamps at 0 when spending more than available', () => {
    expect(spendSorceryPoints('TestSorcerer', 999, CAMPAIGN)).toBe(0);
  });

  it('spending 0 leaves the store unchanged', () => {
    expect(spendSorceryPoints('TestSorcerer', 0, CAMPAIGN)).toBe(5);
  });

  it('negative amount adds points back (restore flows)', () => {
    expect(spendSorceryPoints('TestSorcerer', -2, CAMPAIGN)).toBe(7);
  });

  it('treats unknown character without fallback as 0', () => {
    expect(spendSorceryPoints('UnknownCharacter', 5, CAMPAIGN)).toBe(0);
  });

  it('uses fallback when no stored value exists', () => {
    expect(spendSorceryPoints('UnknownCharacter', 2, CAMPAIGN, 10)).toBe(8);
  });
});

// ── getCurrentSorceryPoints ─────────────────────────────────────────────────

describe('getCurrentSorceryPoints', () => {
  it('returns the stored value, including 0', () => {
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(5);
    setSorceryPoints('TestSorcerer', 0);
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(0);
  });

  it('converts stored string values to numbers', () => {
    setSorceryPoints('TestSorcerer', '4');
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(4);
  });

  it('returns the fallback, or null, when nothing is stored', () => {
    expect(getCurrentSorceryPoints('Unknown', 10)).toBe(10);
    expect(getCurrentSorceryPoints('Unknown')).toBeNull();
  });
});

// ── getMaxSorceryPoints ─────────────────────────────────────────────────────

describe('getMaxSorceryPoints', () => {
  it('returns maxSorceryPoints from class features', () => {
    expect(getMaxSorceryPoints(SORCERER)).toBe(10);
    expect(mockGetClassFeatures).toHaveBeenCalledWith(SORCERER);
  });

  it('returns 0 when class features are missing or max is falsy', () => {
    mockGetClassFeatures.mockReturnValue(null);
    expect(getMaxSorceryPoints({ name: 'Wizard', class: { name: 'Wizard' } })).toBe(0);

    mockGetClassFeatures.mockReturnValue({ maxSorceryPoints: 0 });
    expect(getMaxSorceryPoints(SORCERER)).toBe(0);
  });
});

// ── logMetamagicUse ─────────────────────────────────────────────────────────

describe('logMetamagicUse', () => {
  it('posts a metamagic_use entry with full payload, guid, and store SP at call time', () => {
    const before = Date.now();
    logMetamagicUse(CAMPAIGN, 'TestSorcerer', 'Fireball', ['Empowered Spell'], 2);
    const after = Date.now();

    expect(mockAddEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'metamagic_use',
      characterName: 'TestSorcerer',
      spellName: 'Fireball',
      options: ['Empowered Spell'],
      sorceryPointsSpent: 2,
      remainingSorceryPoints: 5,
      id: 'test-guid-1234',
    }));
    const entry = mockAddEntry.mock.calls[0][1];
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });

  it('wraps non-array options in an array', () => {
    logMetamagicUse(CAMPAIGN, 'TestSorcerer', 'Fireball', 'Empowered Spell', 2);
    expect(mockAddEntry.mock.calls[0][1].options).toEqual(['Empowered Spell']);
  });

  it('logs error when addEntry rejects', async () => {
    const error = new Error('Network failure');
    mockAddEntry.mockRejectedValue(error);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

    logMetamagicUse(CAMPAIGN, 'TestSorcerer', 'Fireball', [], 2);
    await act(async () => {}); // flush the .catch microtask

    expect(consoleErrorSpy).toHaveBeenCalledWith('[useMetamagic] Error:', error);
    consoleErrorSpy.mockRestore();
  });
});

// ── useMetamagic hook (legacy default export; helpers above are the live lane) ─

describe('useMetamagic hook', () => {
  it('exposes currentSP and maxSP', () => {
    const { result } = renderHook(() => useMetamagic(SORCERER, CAMPAIGN));
    expect(result.current.currentSP).toBe(5);
    expect(result.current.maxSP).toBe(10);
  });

  it('returns 0/0 when playerStats is null', () => {
    const { result } = renderHook(() => useMetamagic(null, CAMPAIGN));
    expect(result.current.currentSP).toBe(0);
    expect(result.current.maxSP).toBe(0);
  });

  it('defaults currentSP to maxSP when nothing is stored', () => {
    getStore('TestSorcerer').delete('sorceryPoints');
    const { result } = renderHook(() => useMetamagic(SORCERER, CAMPAIGN));
    expect(result.current.currentSP).toBe(10);
  });

  it('spendSorceryPoints deducts, updates currentSP, and dispatches the event', () => {
    const { result } = renderHook(() => useMetamagic(SORCERER, CAMPAIGN));
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    let remaining;
    act(() => {
      remaining = result.current.spendSorceryPoints(3);
    });

    expect(remaining).toBe(2);
    expect(result.current.currentSP).toBe(2);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sorcery-points-updated' })
    );
    dispatchSpy.mockRestore();
  });

  it('logMetamagic delegates with campaign and character bound', () => {
    const { result } = renderHook(() => useMetamagic(SORCERER, CAMPAIGN));

    act(() => {
      result.current.logMetamagic('Fireball', ['Empowered Spell'], 2);
    });

    expect(mockAddEntry).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      type: 'metamagic_use',
      characterName: 'TestSorcerer',
      spellName: 'Fireball',
      sorceryPointsSpent: 2,
    }));
  });

  it('re-reads currentSP on sorcery-points-updated events and storage changes', async () => {
    const { result } = renderHook(() => useMetamagic(SORCERER, CAMPAIGN));

    // External producer restores points, then broadcasts (e.g. Font of Magic).
    setSorceryPoints('TestSorcerer', 8);
    act(() => {
      window.dispatchEvent(new CustomEvent('sorcery-points-updated'));
    });
    expect(result.current.currentSP).toBe(8);

    // Server-pushed store change without the custom event.
    setSorceryPoints('TestSorcerer', 1);
    act(() => {
      storageListeners.forEach((fn) => fn());
    });
    expect(result.current.currentSP).toBe(1);
  });
});
