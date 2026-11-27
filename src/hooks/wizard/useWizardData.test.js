// @maintained-by-ai 2026-11-26
// Stable data-loading contract for the character wizard: deterministic mocked
// fetch of static JSON paths with pure mapping to hook state. Update only if
// the hook's URLs, output shape, or ruleset branches change.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardData from './useWizardData.js';

// Full data slice of the hook's output shape (CharacterCreationWizard
// destructures all of these plus isDataLoading).
const DATA_KEYS = [
  'backgrounds',
  'racesData',
  'allRacesData',
  'classSubtypes',
  'allClassesData',
  'feats',
  'magicItems',
];

function createMockFetch(responses) {
  return vi.fn().mockImplementation((url) => {
    const handler = responses[url];
    if (handler) {
      return Promise.resolve(handler);
    }
    return Promise.resolve({ ok: false });
  });
}

function createJsonResponse(data) {
  return { ok: true, json: () => Promise.resolve(data) };
}

function create5eResponses(races, classes, feats, magicItems) {
  return {
    '/data/races.json': createJsonResponse(races),
    '/data/classes.json': createJsonResponse(classes),
    '/data/feats.json': createJsonResponse(feats),
    '/data/magic-items.json': createJsonResponse(magicItems),
  };
}

function create2024Responses(backgrounds, races, classes, feats, magicItems) {
  return {
    '/data/2024/backgrounds.json': createJsonResponse(backgrounds),
    '/data/2024/races.json': createJsonResponse(races),
    '/data/2024/classes.json': createJsonResponse(classes),
    '/data/2024/feats.json': createJsonResponse(feats),
    '/data/magic-items.json': createJsonResponse(magicItems),
  };
}

// Static rule-data GETs carry no SSE semantics, so counting one URL's calls
// pins traffic, not state (2026-11-24 fetch census: the races lane
// double-fetched the identical URL until the coalesce; both race views now
// share one GET, which no state assertion can distinguish).
function fetchCountFor(fetchMock, url) {
  return fetchMock.mock.calls.filter(([calledUrl]) => calledUrl === url).length;
}

describe('useWizardData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('5e: starts empty and loading, loads /data/ URLs, maps subclasses, clears backgrounds, one races GET', async () => {
    const races = [{ name: 'Human' }, { name: 'Elf' }];
    const classes = [
      { name: 'Fighter', subclasses: ['Battle Master', 'Champion'] },
      { name: 'Wizard', subclasses: ['School of Evocation'] },
      { name: 'Barbarian' },
    ];
    const feats = [{ name: 'Actor' }, { name: 'Crusher' }];
    const magicItems = [{ name: '+1 Longsword' }];

    const fetchMock = createMockFetch(
      create5eResponses(races, classes, feats, magicItems)
    );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useWizardData('5e'));

    // Contract before any fetch resolves: empty data slice, loading flag set.
    for (const key of DATA_KEYS) {
      expect(result.current[key]).toEqual([]);
    }
    expect(result.current.isDataLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isDataLoading).toBe(false);
    });

    expect(result.current.racesData).toEqual(races);
    expect(result.current.allRacesData).toEqual(races);
    expect(result.current.classSubtypes).toEqual([
      { className: 'Fighter', subtypes: ['Battle Master', 'Champion'] },
      { className: 'Wizard', subtypes: ['School of Evocation'] },
      { className: 'Barbarian', subtypes: [] },
    ]);
    expect(result.current.allClassesData).toEqual(classes);
    expect(result.current.feats).toEqual(feats);
    expect(result.current.magicItems).toEqual(magicItems);
    // 5e has no backgrounds — the hook explicitly clears them
    expect(result.current.backgrounds).toEqual([]);
    // One GET feeds both race views; magic items come from the shared
    // /data/ lane (an off-path URL would leave magicItems empty above).
    expect(fetchCountFor(fetchMock, '/data/races.json')).toBe(1);
  });

  it('2024: loads /data/2024/ URLs with shared magic items, majors map to subtypes with subclass precedence, one races GET', async () => {
    const backgrounds = [{ name: 'Acolyte' }, { name: 'Soldier' }];
    const races = [{ name: 'Human 2024' }];
    const classes = [
      { name: 'Rogue', majors: ['Thief', 'Assassin'] },
      { name: 'Wizard', subclasses: ['Transmutation'], majors: ['Arcana'] },
    ];
    const feats = [{ name: 'Alert' }];
    const magicItems = [{ name: 'Leather Armor' }];

    const fetchMock = createMockFetch(
      create2024Responses(backgrounds, races, classes, feats, magicItems)
    );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useWizardData('2024'));

    await waitFor(() => {
      expect(result.current.isDataLoading).toBe(false);
    });

    expect(result.current.backgrounds).toEqual(backgrounds);
    expect(result.current.racesData).toEqual(races);
    expect(result.current.allRacesData).toEqual(races);
    // majors fill the gap; subclasses win when both keys are present
    expect(result.current.classSubtypes).toEqual([
      { className: 'Rogue', subtypes: ['Thief', 'Assassin'] },
      { className: 'Wizard', subtypes: ['Transmutation'] },
    ]);
    expect(result.current.allClassesData).toEqual(classes);
    expect(result.current.feats).toEqual(feats);
    expect(result.current.magicItems).toEqual(magicItems);
    expect(fetchCountFor(fetchMock, '/data/2024/races.json')).toBe(1);
  });

  it('logs each failed URL and leaves the data slice empty without throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result } = renderHook(() => useWizardData('5e'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('/data/races.json'),
      expect.anything()
    );
    for (const key of DATA_KEYS) {
      expect(result.current[key]).toEqual([]);
    }
    consoleSpy.mockRestore();
  });

  it('reloads and swaps data when the ruleset changes from 5e to 2024', async () => {
    const responses = {
      '/data/races.json': createJsonResponse([{ name: '5e Race' }]),
      '/data/classes.json': createJsonResponse([
        { name: 'Fighter', subclasses: ['Battle Master'] },
      ]),
      '/data/feats.json': createJsonResponse([{ name: '5e Feat' }]),
      '/data/magic-items.json': createJsonResponse([]),
      '/data/2024/backgrounds.json': createJsonResponse([{ name: 'Acolyte' }]),
      '/data/2024/races.json': createJsonResponse([{ name: '2024 Race' }]),
      '/data/2024/classes.json': createJsonResponse([
        { name: 'Rogue', majors: ['Thief'] },
      ]),
      '/data/2024/feats.json': createJsonResponse([{ name: '2024 Feat' }]),
    };
    global.fetch = createMockFetch(responses);

    const { result, rerender } = renderHook(
      ({ ruleset }) => useWizardData(ruleset),
      { initialProps: { ruleset: '5e' } }
    );

    await waitFor(() => {
      expect(result.current.racesData[0]?.name).toBe('5e Race');
    });
    expect(result.current.classSubtypes).toEqual([
      { className: 'Fighter', subtypes: ['Battle Master'] },
    ]);
    expect(result.current.backgrounds).toEqual([]);

    rerender({ ruleset: '2024' });

    await waitFor(() => {
      expect(result.current.backgrounds.length).toBeGreaterThan(0);
    });

    expect(result.current.racesData[0]?.name).toBe('2024 Race');
    expect(result.current.feats).toEqual([{ name: '2024 Feat' }]);
    // majors mapping carries across the switch
    expect(result.current.classSubtypes).toEqual([
      { className: 'Rogue', subtypes: ['Thief'] },
    ]);
  });
});
