import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useActionPopup, {
  buildFeatureDetailHtml,
  buildAbilityDetailHtml,
} from './useActionPopup.js';

vi.mock('./usePopup.js', () => ({
  default: function usePopupMock(buildHtml) {
    const React = require('react');
    const [popupHtml, setPopupHtml] = React.useState(null);
    const showPopup = React.useCallback((entity) => {
      const html = buildHtml(entity);
      if (html) {
        setPopupHtml(html);
      }
    }, [buildHtml]);
    return { showPopup, popupHtml, setPopupHtml };
  },
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadBackgroundData: vi.fn(),
}));

import { loadBackgroundData } from '../../services/ui/dataLoader.js';

describe('useActionPopup', () => {
  describe('buildFeatureDetailHtml', () => {
    it('should return null when entity has no details', () => {
      const entity = {
        name: 'Simple Feature',
        description: 'Just a description.',
      };
      const result = buildFeatureDetailHtml(entity);
      expect(result).toBeNull();
    });

    it('should return null when details is empty string', () => {
      const entity = {
        name: 'Simple Feature',
        description: 'Just a description.',
        details: '',
      };
      const result = buildFeatureDetailHtml(entity);
      expect(result).toBeNull();
    });

    it('should return HTML string with name, description, and details', () => {
      const entity = {
        name: 'Second Wind',
        description: 'You have a limited well of stamina.',
        details: 'You can use a bonus action to regain 1d10 + fighter level hit points.',
      };
      const result = buildFeatureDetailHtml(entity);
      expect(result).toBe(
        '<b>Second Wind</b><br/>You have a limited well of stamina.<br/><br/>You can use a bonus action to regain 1d10 + fighter level hit points.'
      );
    });

    it('should return null when entity.details is falsy (0, false, undefined)', () => {
      expect(buildFeatureDetailHtml({ name: 'X', details: 0 })).toBeNull();
      expect(buildFeatureDetailHtml({ name: 'X', details: false })).toBeNull();
      expect(buildFeatureDetailHtml({ name: 'X', details: undefined })).toBeNull();
    });

    it('should include undefined description in output when missing', () => {
      const entity = {
        name: 'Feature',
        details: 'Some details.',
      };
      const result = buildFeatureDetailHtml(entity);
      expect(result).toBe('<b>Feature</b><br/>undefined<br/><br/>Some details.');
    });

    it('should include undefined name and description in output when missing', () => {
      const entity = {
        details: 'Some details.',
      };
      const result = buildFeatureDetailHtml(entity);
      expect(result).toBe('<b>undefined</b><br/>undefined<br/><br/>Some details.');
    });
  });

  describe('buildAbilityDetailHtml', () => {
    it('should return a function that returns HTML for a matching ability name', () => {
      const allAbilityScores = [
        { full_name: 'Strength', description: 'Measures physical power.' },
        { full_name: 'Dexterity', description: 'Measures agility.' },
      ];
      const lookup = buildAbilityDetailHtml(allAbilityScores);
      const result = lookup('Strength');
      expect(result).toBe('<h3>Strength</h3>Measures physical power.<br/>');
    });

    it('should return null for unknown ability', () => {
      const allAbilityScores = [
        { full_name: 'Strength', description: 'Measures physical power.' },
      ];
      const lookup = buildAbilityDetailHtml(allAbilityScores);
      const result = lookup('Unknown');
      expect(result).toBeNull();
    });

    it('should match full_name case-sensitively', () => {
      const allAbilityScores = [
        { full_name: 'Strength', description: 'Measures physical power.' },
      ];
      const lookup = buildAbilityDetailHtml(allAbilityScores);
      const result = lookup('strength');
      expect(result).toBeNull();
    });

    it('should return null when allAbilityScores is empty array', () => {
      const lookup = buildAbilityDetailHtml([]);
      expect(lookup('Strength')).toBeNull();
    });

    it('should throw TypeError when allAbilityScores is undefined', () => {
      const lookup = buildAbilityDetailHtml(undefined);
      expect(() => lookup('Strength')).toThrow(TypeError);
    });

    it('should throw TypeError when allAbilityScores is null', () => {
      const lookup = buildAbilityDetailHtml(null);
      expect(() => lookup('Strength')).toThrow(TypeError);
    });

    it('should match the first occurrence when multiple abilities share a name', () => {
      const allAbilityScores = [
        { full_name: 'Strength', description: 'First.' },
        { full_name: 'Strength', description: 'Second.' },
      ];
      const lookup = buildAbilityDetailHtml(allAbilityScores);
      expect(lookup('Strength')).toBe('<h3>Strength</h3>First.<br/>');
    });
  });

  describe('spell preset (buildSpellDetailHtml)', () => {
    it('should set popupHtml when entity has a description', () => {
      const { result } = renderHook(() => useActionPopup('spell'));
      act(() => {
        result.current.showPopup({
          name: 'Fireball',
          description: 'A bright streak flashes from your pointing finger.',
        });
      });
      expect(result.current.popupHtml).toBe(
        '<b>Fireball</b><br/><br/>A bright streak flashes from your pointing finger.<br/>'
      );
    });

    it('should not set popupHtml when entity has no description', () => {
      const { result } = renderHook(() => useActionPopup('spell'));
      act(() => {
        result.current.showPopup({ name: 'Fireball' });
      });
      expect(result.current.popupHtml).toBeNull();
    });

    it('should not set popupHtml when description is empty string', () => {
      const { result } = renderHook(() => useActionPopup('spell'));
      act(() => {
        result.current.showPopup({ name: 'Fireball', description: '' });
      });
      expect(result.current.popupHtml).toBeNull();
    });

    it('should not set popupHtml when description is falsy (0, false)', () => {
      const { result } = renderHook(() => useActionPopup('spell'));
      act(() => {
        result.current.showPopup({ name: 'Fireball', description: 0 });
      });
      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('preset selection', () => {
    it('should return showPopup, popupHtml, and setPopupHtml for feature preset', () => {
      const { result } = renderHook(() => useActionPopup('feature'));
      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
      expect(typeof result.current.showPopup).toBe('function');
    });

    it('should return handlers for spell preset', () => {
      const { result } = renderHook(() => useActionPopup('spell'));
      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
    });

    it('should return handlers for ability preset', () => {
      const { result } = renderHook(() =>
        useActionPopup('ability', { allAbilityScores: [] })
      );
      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
    });

    it('should return handlers for custom function preset', () => {
      const customHandler = (entity) => `<b>${entity.name}</b>`;
      const { result } = renderHook(() => useActionPopup(customHandler));
      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
    });

    it('should return null handler for unknown preset', () => {
      const { result } = renderHook(() => useActionPopup('unknown'));
      expect(result.current).toHaveProperty('showPopup');
      expect(result.current).toHaveProperty('popupHtml');
      expect(result.current).toHaveProperty('setPopupHtml');
    });

    it('should handle null preset', () => {
      const { result } = renderHook(() => useActionPopup(null));
      expect(result.current).toHaveProperty('showPopup');
    });

    it('should handle undefined preset', () => {
      const { result } = renderHook(() => useActionPopup(undefined));
      expect(result.current).toHaveProperty('showPopup');
    });

    it('should handle empty string preset', () => {
      const { result } = renderHook(() => useActionPopup(''));
      expect(result.current).toHaveProperty('showPopup');
    });

    it('should handle number preset', () => {
      const { result } = renderHook(() => useActionPopup(42));
      expect(result.current).toHaveProperty('showPopup');
    });

    it('should handle object preset', () => {
      const { result } = renderHook(() => useActionPopup({ foo: 'bar' }));
      expect(result.current).toHaveProperty('showPopup');
    });

    it('should handle array preset', () => {
      const { result } = renderHook(() => useActionPopup(['a']));
      expect(result.current).toHaveProperty('showPopup');
    });

    it('should handle boolean preset', () => {
      const { result } = renderHook(() => useActionPopup(true));
      expect(result.current).toHaveProperty('showPopup');
    });

    it('should handle ability preset with missing context', () => {
      const { result } = renderHook(() => useActionPopup('ability'));
      expect(result.current).toHaveProperty('showPopup');
    });

    it('should handle ability preset with context but missing allAbilityScores', () => {
      const { result } = renderHook(() => useActionPopup('ability', { foo: 'bar' }));
      expect(result.current).toHaveProperty('showPopup');
    });
  });

  describe('showPopup behavior', () => {
    it('should set popupHtml when buildHtml returns content', () => {
      const { result } = renderHook(() => useActionPopup('feature'));
      act(() => {
        result.current.showPopup({
          name: 'Test',
          description: 'Desc',
          details: 'Details here',
        });
      });
      expect(result.current.popupHtml).toContain('<b>Test</b>');
    });

    it('should not set popupHtml when buildHtml returns null', () => {
      const { result } = renderHook(() => useActionPopup('feature'));
      act(() => {
        result.current.showPopup({ name: 'Test', description: 'Desc' });
      });
      expect(result.current.popupHtml).toBeNull();
    });

    it('should use custom function when passed as preset', () => {
      const customHandler = (entity) => `<b>${entity.name}</b>`;
      const { result } = renderHook(() => useActionPopup(customHandler));
      act(() => {
        result.current.showPopup({ name: 'Fireball' });
      });
      expect(result.current.popupHtml).toBe('<b>Fireball</b>');
    });

    it('should not show popup for unknown preset', () => {
      const { result } = renderHook(() => useActionPopup('unknown'));
      act(() => {
        result.current.showPopup({ name: 'Test', details: 'Stuff' });
      });
      expect(result.current.popupHtml).toBeNull();
    });

    it('should allow direct setPopupHtml', () => {
      const { result } = renderHook(() => useActionPopup('feature'));
      act(() => {
        result.current.setPopupHtml('<p>Direct</p>');
      });
      expect(result.current.popupHtml).toBe('<p>Direct</p>');
    });

    it('should allow clearing popupHtml via setPopupHtml(null)', () => {
      const { result } = renderHook(() => useActionPopup('feature'));
      act(() => {
        result.current.setPopupHtml('<p>Direct</p>');
      });
      act(() => {
        result.current.setPopupHtml(null);
      });
      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('loadWeaponMasteries', () => {
    beforeEach(() => {
      vi.resetModules();
      // Clear the module cache to reset the weaponMasteryCache variable
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch and return weapon masteries on first call', async () => {
      const mockMasteries = [
        { name: 'Finesse', description: 'Choose one of the weapon\'s stats.' },
        { name: 'Heavy', description: 'Use Strength for damage instead of Dexterity.' },
      ];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockMasteries),
        })
      );

      const { loadWeaponMasteries: freshLoad } = await import('./useActionPopup.js');
      const result = await freshLoad();

      expect(result).toEqual(mockMasteries);
      expect(global.fetch).toHaveBeenCalledWith('/data/2024/weapon-mastery.json');
    });

    it('should cache the result on second call', async () => {
      const mockMasteries = [{ name: 'Finesse' }];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockMasteries),
        })
      );

      const { loadWeaponMasteries: freshLoad } = await import('./useActionPopup.js');
      await freshLoad();
      await freshLoad();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should propagate fetch rejection', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const { loadWeaponMasteries: freshLoad } = await import('./useActionPopup.js');
      await expect(freshLoad()).rejects.toThrow('Network error');
    });

    it('should handle fetch returning non-JSON', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve('not an array'),
        })
      );

      const { loadWeaponMasteries: freshLoad } = await import('./useActionPopup.js');
      const result = await freshLoad();
      expect(result).toBe('not an array');
    });
  });

  describe('showWeaponMasteryPopup', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should set popupHtml when mastery is found with description', async () => {
      const mockMasteries = [
        { name: 'Finesse', description: 'Choose one of the weapon\'s stats.' },
      ];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockMasteries),
        })
      );

      const { showWeaponMasteryPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Finesse', setPopupHtml);

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Finesse</b><br/><br/>Choose one of the weapon\'s stats.<br/>'
      );
    });

    it('should not set popupHtml when mastery is not found', async () => {
      const mockMasteries = [
        { name: 'Finesse', description: 'Choose one of the weapon\'s stats.' },
      ];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockMasteries),
        })
      );

      const { showWeaponMasteryPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Heavy', setPopupHtml);

      expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('should not set popupHtml when mastery has no description', async () => {
      const mockMasteries = [
        { name: 'Finesse' },
      ];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockMasteries),
        })
      );

      const { showWeaponMasteryPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Finesse', setPopupHtml);

      expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('should handle fetch error gracefully (empty array)', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const { showWeaponMasteryPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Finesse', setPopupHtml);

      expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('should handle empty masteries array', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve([]),
        })
      );

      const { showWeaponMasteryPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Finesse', setPopupHtml);

      expect(setPopupHtml).not.toHaveBeenCalled();
    });
  });

  describe('loadBackgrounds', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch and return backgrounds on first call', async () => {
      const mockBackgrounds = [
        { name: 'Acolyte', description: 'You have spent your life in the service of a temple.' },
      ];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockBackgrounds),
        })
      );

      const { loadBackgrounds: freshLoad } = await import('./useActionPopup.js');
      const result = await freshLoad();

      expect(result).toEqual(mockBackgrounds);
      expect(global.fetch).toHaveBeenCalledWith('/data/2024/backgrounds.json');
    });

    it('should cache the result on second call', async () => {
      const mockBackgrounds = [{ name: 'Acolyte' }];
      global.fetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockBackgrounds),
        })
      );

      const { loadBackgrounds: freshLoad } = await import('./useActionPopup.js');
      await freshLoad();
      await freshLoad();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should propagate fetch rejection', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const { loadBackgrounds: freshLoad } = await import('./useActionPopup.js');
      await expect(freshLoad()).rejects.toThrow('Network error');
    });
  });

  describe('showBackgroundPopup', () => {
    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should set popupHtml with basic name and description', async () => {
      const mockBackgrounds = [
        { name: 'Acolyte', description: 'You have spent your life in the service of a temple.' },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Acolyte', setPopupHtml, '2024');

      expect(mockFn).toHaveBeenCalledWith('2024');
      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Acolyte</b><br/><br/>You have spent your life in the service of a temple.'
      );
    });

    it('should include ability_scores when present', async () => {
      const mockBackgrounds = [
        {
          name: 'Soldier',
          description: 'Warfare is no stranger to you.',
          ability_scores: 'Increase two abilities of your choice by 2, or three by 1.',
        },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Ability Scores:</b> Increase two abilities of your choice by 2, or three by 1.'
      );
    });

    it('should include feat when present', async () => {
      const mockBackgrounds = [
        {
          name: 'Soldier',
          description: 'Warfare is no stranger to you.',
          feat: 'Tough',
        },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Feat:</b> Tough'
      );
    });

    it('should include skill_proficiencies when present', async () => {
      const mockBackgrounds = [
        {
          name: 'Soldier',
          description: 'Warfare is no stranger to you.',
          skill_proficiencies: 'Athletics, Intuition',
        },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Skill Proficiencies:</b> Athletics, Intuition'
      );
    });

    it('should include tool_proficiencies when present', async () => {
      const mockBackgrounds = [
        {
          name: 'Soldier',
          description: 'Warfare is no stranger to you.',
          tool_proficiencies: 'One type of gaming set, a musician\'s instrument',
        },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Tool Proficiencies:</b> One type of gaming set, a musician\'s instrument'
      );
    });

    it('should include equipment when present', async () => {
      const mockBackgrounds = [
        {
          name: 'Soldier',
          description: 'Warfare is no stranger to you.',
          equipment: 'A shield, a suit of leather armor',
        },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Equipment:</b> A shield, a suit of leather armor'
      );
    });

    it('should include source (book) when present', async () => {
      const mockBackgrounds = [
        {
          name: 'Soldier',
          description: 'Warfare is no stranger to you.',
          book: 'Player\'s Handbook',
        },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Source:</b> Player\'s Handbook'
      );
    });

    it('should include source (page) when present', async () => {
      const mockBackgrounds = [
        {
          name: 'Soldier',
          description: 'Warfare is no stranger to you.',
          page: '42',
        },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Source:</b> 42'
      );
    });

    it('should include source (book and page) when both present', async () => {
      const mockBackgrounds = [
        {
          name: 'Soldier',
          description: 'Warfare is no stranger to you.',
          book: 'Player\'s Handbook',
          page: '42',
        },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Source:</b> Player\'s Handbook 42'
      );
    });

    it('should include all optional fields together', async () => {
      const mockBackgrounds = [
        {
          name: 'Soldier',
          description: 'Warfare is no stranger to you.',
          ability_scores: 'STR +2, CON +1',
          feat: 'Tough',
          skill_proficiencies: 'Athletics, Intuition',
          tool_proficiencies: 'Gaming set',
          equipment: 'A shield',
          book: 'Player\'s Handbook',
          page: '42',
        },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.<br/><br/><b>Ability Scores:</b> STR +2, CON +1<br/><br/><b>Feat:</b> Tough<br/><br/><b>Skill Proficiencies:</b> Athletics, Intuition<br/><br/><b>Tool Proficiencies:</b> Gaming set<br/><br/><b>Equipment:</b> A shield<br/><br/><b>Source:</b> Player\'s Handbook 42'
      );
    });

    it('should set error popup when background is not found', async () => {
      const mockBackgrounds = [
        { name: 'Acolyte', description: 'Temple life.' },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Background details not found in database.'
      );
    });

    it('should set error popup when background has no description', async () => {
      const mockBackgrounds = [
        { name: 'Acolyte' },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Acolyte', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Acolyte</b><br/><br/>Background details not found in database.'
      );
    });

    it('should handle fetch error gracefully with error message', async () => {
      const mockFn = loadBackgroundData;
      mockFn.mockRejectedValue(new Error('Network error'));

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Acolyte', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Acolyte</b><br/><br/>Error loading background details: Network error. Check browser console for more details.'
      );
    });

    it('should handle empty backgrounds array with error message', async () => {
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue([]);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Acolyte', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Acolyte</b><br/><br/>Background details not found in database.'
      );
    });

    it('should match by index for 5e backgrounds', async () => {
      const mockBackgrounds = [
        { index: 'soldier', name: 'Soldier', description: 'Warfare is no stranger to you.' },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '5e');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.'
      );
    });

    it('should use 5e data when rulesVersion is 5e', async () => {
      const mockBackgrounds = [
        { name: 'Soldier', description: '5e soldier description.' },
      ];
      const mockFn = loadBackgroundData;
      mockFn.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '5e');

      expect(mockFn).toHaveBeenCalledWith('5e');
      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>5e soldier description.'
      );
    });
  });
});
