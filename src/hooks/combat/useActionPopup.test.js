import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useActionPopup, {
  buildFeatureDetailHtml,
  buildAbilityDetailHtml,
} from './useActionPopup.js';

// Mock usePopup to return controllable state.
// The real usePopup calls buildHtml inside showPopup and only calls setPopupHtml if truthy.
// We replicate that so tests verify handler behavior, not usePopup internals.
vi.mock('./usePopup.js', () => {
  let popupHtml = null;

  const createMockPopup = (handler) => {
    const setPopupHtml = vi.fn((html) => { popupHtml = html; });
    const showPopup = vi.fn((entity) => {
      const html = handler(entity);
      if (html) {
        setPopupHtml(html);
      }
    });
    const popup = { showPopup, setPopupHtml };
    Object.defineProperty(popup, 'popupHtml', { get: () => popupHtml });
    return popup;
  };

  const resetMock = () => {
    popupHtml = null;
  };

  return {
    default: vi.fn((handler) => createMockPopup(handler)),
    resetMock,
  };
});

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadBackgroundData: vi.fn(),
  loadWildMagicSurgeTable: vi.fn(async () => []),
}));

import { loadBackgroundData } from '../../services/ui/dataLoader.js';
import { resetMock } from './usePopup.js';

describe('useActionPopup', () => {
  beforeEach(() => {
    resetMock();
    vi.restoreAllMocks();
  });

  describe('buildFeatureDetailHtml', () => {
    it('should return HTML string with name, description, and details when present', () => {
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

    it('should return null when details is falsy', () => {
      expect(buildFeatureDetailHtml({ name: 'X', details: 0 })).toBeNull();
      expect(buildFeatureDetailHtml({ name: 'X', details: false })).toBeNull();
      expect(buildFeatureDetailHtml({ name: 'X', details: undefined })).toBeNull();
      expect(buildFeatureDetailHtml({ name: 'X', details: '' })).toBeNull();
      expect(buildFeatureDetailHtml({ name: 'Simple Feature', description: 'Just a description.' })).toBeNull();
    });

    it('should include undefined name and description when only details is present', () => {
      const result = buildFeatureDetailHtml({ details: 'Some detail.' });
      expect(result).toBe('<b>undefined</b><br/>undefined<br/><br/>Some detail.');
    });
  });

  describe('buildAbilityDetailHtml', () => {
    it('should return HTML for a matching ability name', () => {
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

    it('should throw TypeError when allAbilityScores is undefined or null', () => {
      const lookup = buildAbilityDetailHtml(undefined);
      expect(() => lookup('Strength')).toThrow(TypeError);
      const lookup2 = buildAbilityDetailHtml(null);
      expect(() => lookup2('Strength')).toThrow(TypeError);
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

  describe('spell preset', () => {
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

    it('should not set popupHtml when entity has no or empty description', () => {
      const { result } = renderHook(() => useActionPopup('spell'));
      act(() => {
        result.current.showPopup({ name: 'Fireball' });
      });
      expect(result.current.popupHtml).toBeNull();
      act(() => {
        result.current.showPopup({ name: 'Fireball', description: '' });
      });
      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('preset selection', () => {
    it('should return showPopup, popupHtml, and setPopupHtml for known presets', () => {
      for (const preset of ['feature', 'spell', 'ability']) {
        const { result } = renderHook(() => useActionPopup(preset, preset === 'ability' ? { allAbilityScores: [] } : {}));
        expect(result.current).toHaveProperty('showPopup');
        expect(result.current).toHaveProperty('popupHtml');
        expect(result.current).toHaveProperty('setPopupHtml');
      }
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
  });

  describe('showPopup behavior', () => {
    it('should set popupHtml when buildHtml returns content for feature preset', () => {
      const { result } = renderHook(() => useActionPopup('feature'));
      act(() => {
        result.current.showPopup({
          name: 'Test',
          description: 'Desc',
          details: 'Details here',
        });
      });
      expect(result.current.popupHtml).toBe(
        '<b>Test</b><br/>Desc<br/><br/>Details here'
      );
    });

    it('should not set popupHtml when buildHtml returns null for feature preset', () => {
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
  });

  describe('loadWeaponMasteries', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should fetch and return weapon masteries on first call', async () => {
      const mockMasteries = [
        { name: 'Finesse', description: 'Choose one of the weapon\'s stats.' },
        { name: 'Heavy', description: 'Use Strength for damage instead of Dexterity.' },
      ];
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockMasteries),
        })
      ));

      const { loadWeaponMasteries: freshLoad } = await import('./useActionPopup.js');
      const result = await freshLoad();

      expect(result).toEqual(mockMasteries);
      expect(fetch).toHaveBeenCalledWith('/data/2024/weapon-mastery.json');
    });

    it('should cache the result on second call', async () => {
      const mockMasteries = [{ name: 'Finesse' }];
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockMasteries),
        })
      ));

      const { loadWeaponMasteries: freshLoad } = await import('./useActionPopup.js');
      await freshLoad();
      await freshLoad();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should propagate fetch rejection', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))));

      const { loadWeaponMasteries: freshLoad } = await import('./useActionPopup.js');
      await expect(freshLoad()).rejects.toThrow('Network error');
    });
  });

  describe('showWeaponMasteryPopup', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should set popupHtml when mastery is found with description', async () => {
      const mockMasteries = [
        { name: 'Finesse', description: 'Choose one of the weapon\'s stats.' },
      ];
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockMasteries),
        })
      ));

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
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockMasteries),
        })
      ));

      const { showWeaponMasteryPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Heavy', setPopupHtml);

      expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('should not set popupHtml when mastery has no description', async () => {
      const masteriesNoDesc = [{ name: 'Finesse' }];
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(masteriesNoDesc),
        })
      ));

      const { showWeaponMasteryPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Finesse', setPopupHtml);

      expect(setPopupHtml).not.toHaveBeenCalled();
    });

    it('should handle fetch error gracefully (no popup)', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))));

      const { showWeaponMasteryPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Finesse', setPopupHtml);

      expect(setPopupHtml).not.toHaveBeenCalled();
    });
  });

  describe('loadBackgrounds', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should fetch and return backgrounds on first call', async () => {
      const mockBackgrounds = [
        { name: 'Acolyte', description: 'You have spent your life in the service of a temple.' },
      ];
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockBackgrounds),
        })
      ));

      const { loadBackgrounds: freshLoad } = await import('./useActionPopup.js');
      const result = await freshLoad();

      expect(result).toEqual(mockBackgrounds);
      expect(fetch).toHaveBeenCalledWith('/data/2024/backgrounds.json');
    });

    it('should cache the result on second call', async () => {
      const mockBackgrounds = [{ name: 'Acolyte' }];
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve(mockBackgrounds),
        })
      ));

      const { loadBackgrounds: freshLoad } = await import('./useActionPopup.js');
      await freshLoad();
      await freshLoad();

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should propagate fetch rejection', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))));

      const { loadBackgrounds: freshLoad } = await import('./useActionPopup.js');
      await expect(freshLoad()).rejects.toThrow('Network error');
    });
  });

  describe('showBackgroundPopup', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should set popupHtml with basic name and description', async () => {
      const mockBackgrounds = [
        { name: 'Acolyte', description: 'You have spent your life in the service of a temple.' },
      ];
      loadBackgroundData.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Acolyte', setPopupHtml, '2024');

      expect(loadBackgroundData).toHaveBeenCalledWith('2024');
      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Acolyte</b><br/><br/>You have spent your life in the service of a temple.'
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
      loadBackgroundData.mockResolvedValue(mockBackgrounds);

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
      loadBackgroundData.mockResolvedValue(mockBackgrounds);

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
      loadBackgroundData.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Acolyte', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Acolyte</b><br/><br/>Background details not found in database.'
      );
    });

    it('should handle fetch error gracefully with error message', async () => {
      loadBackgroundData.mockRejectedValue(new Error('Network error'));

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Acolyte', setPopupHtml, '2024');

      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Acolyte</b><br/><br/>Error loading background details: Network error. Check browser console for more details.'
      );
    });

    it('should match by index for 5e backgrounds and use correct data path', async () => {
      const mockBackgrounds = [
        { index: 'soldier', name: 'Soldier', description: 'Warfare is no stranger to you.' },
      ];
      loadBackgroundData.mockResolvedValue(mockBackgrounds);

      const { showBackgroundPopup: freshShow } = await import('./useActionPopup.js');
      const setPopupHtml = vi.fn();

      await freshShow('Soldier', setPopupHtml, '5e');

      expect(loadBackgroundData).toHaveBeenCalledWith('5e');
      expect(setPopupHtml).toHaveBeenCalledWith(
        '<b>Soldier</b><br/><br/>Warfare is no stranger to you.'
      );
    });
  });
});
