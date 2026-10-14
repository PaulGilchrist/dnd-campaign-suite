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

const mockGetClassFeatures = vi.fn();
vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: (...args) => mockGetClassFeatures(...args),
}));

const mockGuid = vi.fn();
vi.mock('../../services/ui/utils.js', () => ({
  default: {
    guid: (...args) => mockGuid(...args),
  },
}));

const mockAddEntry = vi.fn();
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: (...args) => mockAddEntry(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function setSorceryPoints(characterName, value) {
  const store = getStore(characterName);
  store.set('sorceryPoints', value);
}

function withClassFeatures(features) {
  mockGetClassFeatures.mockReturnValue(features);
}

// ── spendSorceryPoints ──────────────────────────────────────────────────────

describe('spendSorceryPoints', () => {
  beforeEach(() => {
    clearStores();
    vi.clearAllMocks();
  });

  it('deducts sorcery points and returns remaining', () => {
    const remaining = spendSorceryPoints('TestSorcerer', 3, 'test-campaign');
    expect(remaining).toBe(2);
  });

  it('does not go below 0 when spending more than available', () => {
    const remaining = spendSorceryPoints('TestSorcerer', 999, 'test-campaign');
    expect(remaining).toBe(0);
  });

  it('handles spending 0 points without changing the store', () => {
    const remaining = spendSorceryPoints('TestSorcerer', 0, 'test-campaign');
    expect(remaining).toBe(5);
    expect(getStore('TestSorcerer').get('sorceryPoints')).toBe(5);
  });

  it('handles negative amount by adding points', () => {
    const remaining = spendSorceryPoints('TestSorcerer', -2, 'test-campaign');
    expect(remaining).toBe(7);
  });

  it('returns 0 for unknown character with no fallback', () => {
    const remaining = spendSorceryPoints('UnknownCharacter', 5, 'test-campaign');
    expect(remaining).toBe(0);
  });

  it('uses fallback when no stored value exists', () => {
    const remaining = spendSorceryPoints('UnknownCharacter', 2, 'test-campaign', 10);
    expect(remaining).toBe(8);
  });

  it('dispatches sorcery-points-updated event', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    spendSorceryPoints('TestSorcerer', 2, 'test-campaign');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sorcery-points-updated',
    }));
    dispatchSpy.mockRestore();
  });

  it('persists the new value in the store', () => {
    spendSorceryPoints('TestSorcerer', 2, 'test-campaign');
    expect(getStore('TestSorcerer').get('sorceryPoints')).toBe(3);
  });
});

// ── getCurrentSorceryPoints ─────────────────────────────────────────────────

describe('getCurrentSorceryPoints', () => {
  beforeEach(() => {
    clearStores();
    vi.clearAllMocks();
  });

  it('returns the stored value', () => {
    setSorceryPoints('TestSorcerer', 3);
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(3);
  });

  it('returns fallback when no value is stored', () => {
    expect(getCurrentSorceryPoints('Unknown', 10)).toBe(10);
  });

  it('returns null fallback when no value stored and no explicit fallback', () => {
    expect(getCurrentSorceryPoints('Unknown')).toBeNull();
  });

  it('returns 0 when stored value is 0', () => {
    setSorceryPoints('TestSorcerer', 0);
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(0);
  });

  it('converts string values to numbers', () => {
    const store = getStore('TestSorcerer');
    store.set('sorceryPoints', '4');
    expect(getCurrentSorceryPoints('TestSorcerer')).toBe(4);
  });
});

// ── getMaxSorceryPoints ─────────────────────────────────────────────────────

describe('getMaxSorceryPoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns maxSorceryPoints from class features', () => {
    withClassFeatures({ maxSorceryPoints: 10, metamagicKnown: 2, creatingSpellSlotCosts: [] });
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    expect(getMaxSorceryPoints(stats)).toBe(10);
  });

  it('returns 0 when class features returns null', () => {
    mockGetClassFeatures.mockReturnValue(null);
    expect(getMaxSorceryPoints({ name: 'Wizard', class: { name: 'Wizard' } })).toBe(0);
  });

  it('returns 0 when maxSorceryPoints is falsy', () => {
    withClassFeatures({ maxSorceryPoints: 0, metamagicKnown: 2, creatingSpellSlotCosts: [] });
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    expect(getMaxSorceryPoints(stats)).toBe(0);
  });
});

// ── logMetamagicUse ─────────────────────────────────────────────────────────

describe('logMetamagicUse', () => {
  beforeEach(() => {
    clearStores();
    vi.clearAllMocks();
  });

  it('posts a metamagic_use log entry with correct payload', () => {
    setSorceryPoints('TestSorcerer', 5);
    mockAddEntry.mockResolvedValue({});

    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', ['Empowered Spell'], 2);

    expect(mockAddEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'metamagic_use',
      characterName: 'TestSorcerer',
      spellName: 'Fireball',
      options: ['Empowered Spell'],
      sorceryPointsSpent: 2,
      remainingSorceryPoints: 5,
    }));
  });

  it('wraps non-array options in an array', () => {
    setSorceryPoints('TestSorcerer', 5);
    mockAddEntry.mockResolvedValue({});

    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', 'Empowered Spell', 2);

    const entry = mockAddEntry.mock.calls[0][1];
    expect(entry.options).toEqual(['Empowered Spell']);
  });

  it('passes empty array as-is when options is empty', () => {
    setSorceryPoints('TestSorcerer', 5);
    mockAddEntry.mockResolvedValue({});

    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', [], 2);

    const entry = mockAddEntry.mock.calls[0][1];
    expect(entry.options).toEqual([]);
  });

  it('encodes campaign name with spaces in the URL', () => {
    setSorceryPoints('TestSorcerer', 5);
    mockAddEntry.mockResolvedValue({});

    logMetamagicUse('my test campaign', 'TestSorcerer', 'Fireball', [], 2);

    expect(mockAddEntry).toHaveBeenCalledWith('my test campaign', expect.anything());
  });

  it('includes a timestamp and guid in the entry', () => {
    setSorceryPoints('TestSorcerer', 5);
    mockGuid.mockReturnValue('test-guid-1234');
    mockAddEntry.mockResolvedValue({});
    const before = Date.now();
    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', [], 2);
    const after = Date.now();

    const entry = mockAddEntry.mock.calls[0][1];
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
    expect(entry.id).toBe('test-guid-1234');
  });

  it('uses remaining SP from the store at call time', () => {
    setSorceryPoints('TestSorcerer', 5);
    mockAddEntry.mockResolvedValue({});

    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', ['Empowered Spell'], 2);

    const entry = mockAddEntry.mock.calls[0][1];
    expect(entry.remainingSorceryPoints).toBe(5);
  });

  it('logs error when addEntry rejects', async () => {
    setSorceryPoints('TestSorcerer', 5);
    const error = new Error('Network failure');
    mockAddEntry.mockRejectedValue(error);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

    logMetamagicUse('test-campaign', 'TestSorcerer', 'Fireball', [], 2);

    // addEntry.catch runs asynchronously; flush microtasks
    await act(async () => {});

    expect(consoleErrorSpy).toHaveBeenCalledWith('[useMetamagic] Error:', error);
    consoleErrorSpy.mockRestore();
  });
});

// ── useMetamagic hook ───────────────────────────────────────────────────────

describe('useMetamagic hook', () => {
  beforeEach(() => {
    clearStores();
    vi.clearAllMocks();
    withClassFeatures({ maxSorceryPoints: 10, metamagicKnown: 2, creatingSpellSlotCosts: [] });
  });

  it('returns current and max SP', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));
    expect(result.current.currentSP).toBe(5);
    expect(result.current.maxSP).toBe(10);
  });

  it('returns 0/0 when playerStats is null', () => {
    // Clear the class features mock so getClassFeatures(null) returns undefined
    mockGetClassFeatures.mockReset();
    const { result } = renderHook(() => useMetamagic(null, 'test-campaign'));
    expect(result.current.currentSP).toBe(0);
    expect(result.current.maxSP).toBe(0);
  });

  it('uses max SP as initial value when no sorceryPoints stored', () => {
    setSorceryPoints('TestSorcerer', null);
    const store = getStore('TestSorcerer');
    store.delete('sorceryPoints');

    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));
    expect(result.current.currentSP).toBe(10);
  });

  it('spendSorceryPoints deducts and returns remaining', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    let spent;
    act(() => {
      spent = result.current.spendSorceryPoints(3);
    });

    expect(result.current.currentSP).toBe(2);
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

  it('logMetamagic posts a log entry via logMetamagicUse', () => {
    setSorceryPoints('TestSorcerer', 5);
    mockAddEntry.mockResolvedValue({});

    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    act(() => {
      result.current.logMetamagic('Fireball', ['Empowered Spell'], 2);
    });

    const entry = mockAddEntry.mock.calls[0][1];
    expect(entry.type).toBe('metamagic_use');
    expect(entry.characterName).toBe('TestSorcerer');
    expect(entry.spellName).toBe('Fireball');
    expect(entry.options).toEqual(['Empowered Spell']);
    expect(entry.sorceryPointsSpent).toBe(2);
  });

  it('dispatches sorcery-points-updated event on spend', () => {
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    act(() => {
      result.current.spendSorceryPoints(2);
    });

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sorcery-points-updated',
    }));
    dispatchSpy.mockRestore();
  });

  it('updates currentSP when sorcery-points-updated event fires', async () => {
    setSorceryPoints('TestSorcerer', 5);
    const stats = { name: 'TestSorcerer', class: { name: 'Sorcerer' } };
    const { result } = renderHook(() => useMetamagic(stats, 'test-campaign'));

    // Flush effects so event listeners are registered
    await act(async () => {});
    expect(result.current.currentSP).toBe(5);

    await act(async () => {
      result.current.spendSorceryPoints(3);
    });
    expect(result.current.currentSP).toBe(2);

    // Simulate external change via event
    setSorceryPoints('TestSorcerer', 8);
    window.dispatchEvent(new CustomEvent('sorcery-points-updated'));

    // Flush effects to process the event listener
    await act(async () => {});
    expect(result.current.currentSP).toBe(8);
  });
});
