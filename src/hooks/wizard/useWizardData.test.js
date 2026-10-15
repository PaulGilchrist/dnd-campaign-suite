// @maintained-by-ai
// Stable data-loading contract for the character wizard: deterministic mocked
// fetch of static JSON paths with pure mapping to hook state. Update only if
// the hook's URLs, output shape, or ruleset branches change.
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardData from './useWizardData.js';

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

describe('useWizardData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with empty arrays and loading state', () => {
    const { result } = renderHook(() => useWizardData('5e'));

    expect(result.current.backgrounds).toEqual([]);
    expect(result.current.racesData).toEqual([]);
    expect(result.current.allRacesData).toEqual([]);
    expect(result.current.classSubtypes).toEqual([]);
    expect(result.current.allClassesData).toEqual([]);
    expect(result.current.feats).toEqual([]);
    expect(result.current.magicItems).toEqual([]);
    expect(result.current.isDataLoading).toBe(true);
  });

  describe('5e ruleset', () => {
    it('should load races, classes, feats, and magic items and map subclasses to classSubtypes', async () => {
      const races = [{ name: 'Human' }, { name: 'Elf' }];
      const classes = [
        { name: 'Fighter', subclasses: ['Battle Master', 'Champion'] },
        { name: 'Wizard', subclasses: ['School of Evocation'] },
      ];
      const feats = [{ name: 'Actor' }, { name: 'Crusher' }];
      const magicItems = [{ name: '+1 Longsword' }];

      const responses = create5eResponses(races, classes, feats, magicItems);
      global.fetch = createMockFetch(responses);

      const { result } = renderHook(() => useWizardData('5e'));

      await waitFor(() => {
        expect(result.current.isDataLoading).toBe(false);
      });

      expect(result.current.racesData).toEqual(races);
      expect(result.current.allRacesData).toEqual(races);
      expect(result.current.classSubtypes).toEqual([
        { className: 'Fighter', subtypes: ['Battle Master', 'Champion'] },
        { className: 'Wizard', subtypes: ['School of Evocation'] },
      ]);
      expect(result.current.allClassesData).toEqual(classes);
      expect(result.current.feats).toEqual(feats);
      expect(result.current.magicItems).toEqual(magicItems);
      // 5e has no backgrounds — the hook explicitly clears them
      expect(result.current.backgrounds).toEqual([]);
    });
  });

  describe('2024 ruleset', () => {
    it('should load backgrounds, races, classes, feats, and magic items and map majors to classSubtypes', async () => {
      const backgrounds = [{ name: 'Acolyte' }, { name: 'Soldier' }];
      const races = [{ name: 'Human 2024' }];
      const classes = [{ name: 'Rogue', majors: ['Thief', 'Assassin'] }];
      const feats = [{ name: 'Alert' }];
      const magicItems = [{ name: 'Leather Armor' }];

      const responses = create2024Responses(
        backgrounds, races, classes, feats, magicItems
      );
      global.fetch = createMockFetch(responses);

      const { result } = renderHook(() => useWizardData('2024'));

      await waitFor(() => {
        expect(result.current.isDataLoading).toBe(false);
      });

      expect(result.current.backgrounds).toEqual(backgrounds);
      expect(result.current.racesData).toEqual(races);
      expect(result.current.allRacesData).toEqual(races);
      expect(result.current.classSubtypes).toEqual([
        { className: 'Rogue', subtypes: ['Thief', 'Assassin'] },
      ]);
      expect(result.current.allClassesData).toEqual(classes);
      expect(result.current.feats).toEqual(feats);
      expect(result.current.magicItems).toEqual(magicItems);
    });

    it('should prefer subclasses over majors for 2024 classes', async () => {
      const classes = [
        { name: 'Wizard', subclasses: ['Transmutation'], majors: ['Arcana'] },
      ];
      const responses = create2024Responses([], [], classes, [], []);
      global.fetch = createMockFetch(responses);

      const { result } = renderHook(() => useWizardData('2024'));

      await waitFor(() => {
        expect(result.current.classSubtypes).toEqual([
          { className: 'Wizard', subtypes: ['Transmutation'] },
        ]);
      });
    });
  });

  describe('data loading errors', () => {
    it('should handle failed loads gracefully and log the error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error');

      const { result } = renderHook(() => useWizardData('5e'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      expect(result.current.racesData).toEqual([]);
      expect(result.current.classSubtypes).toEqual([]);
      expect(result.current.feats).toEqual([]);
      expect(result.current.magicItems).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('ruleset switching', () => {
    it('should reload data when ruleset changes from 5e to 2024', async () => {
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

      const { result, rerender } = renderHook(({ initialRuleset }) =>
        useWizardData(initialRuleset)
      , { initialProps: { initialRuleset: '5e' } });

      await waitFor(() => {
        expect(result.current.racesData[0]?.name).toBe('5e Race');
      });

      expect(result.current.backgrounds).toEqual([]);

      rerender({ initialRuleset: '2024' });

      await waitFor(() => {
        expect(result.current.backgrounds.length).toBeGreaterThan(0);
      });

      expect(result.current.racesData[0]?.name).toBe('2024 Race');
      expect(result.current.backgrounds).toEqual([{ name: 'Acolyte' }]);
    });
  });
});
