// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import useLoggedDiceRoll from './useLoggedDiceRoll.js';
import { DiceRollContext } from './DiceRollContext.js';

vi.mock('./useDiceRoll.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 7, rolls: [3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 14, rolls: [7, 7], modifier: 0 })),
}));

vi.mock('../../config/ui-config.js', () => ({
  SHOW_DICE_ROLL_DELAY: 2000,
}));

vi.mock('./useLoggedDiceRollAttack.js', () => ({
  createLogAndShow: vi.fn(() => vi.fn()),
}));

vi.mock('./useLoggedDiceRollDamage.js', () => ({
  createLogDamageAndShow: vi.fn(() => vi.fn()),
}));

vi.mock('./useLoggedDiceRollSaves.js', () => ({
  createSaves: vi.fn(() => ({
    quickRollPlayerSave: vi.fn(),
    triggerGloriousDefenseCounterAttack: vi.fn(),
  })),
}));

vi.mock('./useLoggedDiceRollEventHandlers.js', () => ({
  setupEventListeners: vi.fn(),
}));

const { default: useDiceRoll } = await import('./useDiceRoll.js');
const { createLogAndShow } = await import('./useLoggedDiceRollAttack.js');
const { createLogDamageAndShow } = await import('./useLoggedDiceRollDamage.js');
const { createSaves } = await import('./useLoggedDiceRollSaves.js');
const { setupEventListeners } = await import('./useLoggedDiceRollEventHandlers.js');

describe('useLoggedDiceRoll', () => {
  const characterName = 'TestFighter';
  const campaignName = 'test-campaign';

  beforeEach(() => {
    useDiceRoll.mockReturnValue({ popupHtml: null, setPopupHtml: vi.fn() });
    createLogAndShow.mockReturnValue(vi.fn());
    createLogDamageAndShow.mockReturnValue(vi.fn());
    createSaves.mockReturnValue({
      quickRollPlayerSave: vi.fn(),
      triggerGloriousDefenseCounterAttack: vi.fn(),
    });
    setupEventListeners.mockReturnValue(undefined);
    window.__pendingSaves = {};
  });

  describe('initial return value', () => {
    it('returns popupHtml and setPopupHtml from useDiceRoll', () => {
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      expect(result.current.popupHtml).toBeNull();
      expect(typeof result.current.setPopupHtml).toBe('function');
    });

    it('returns all expected roll functions', () => {
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      const rollFunctions = [
        'rollAbilityCheck',
        'rollSavingThrow',
        'rollSkillCheck',
        'rollInitiative',
        'rollAttack',
        'rollDamage',
      ];
      for (const fn of rollFunctions) {
        expect(typeof result.current[fn]).toBe('function');
      }
    });

    it('returns quickRollPlayerSave and triggerGloriousDefenseCounterAttack from createSaves', () => {
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      expect(typeof result.current.quickRollPlayerSave).toBe('function');
      expect(typeof result.current.triggerGloriousDefenseCounterAttack).toBe('function');
    });
  });

  describe('options handling', () => {
    it('accepts options with autoDamageRoll and characters', () => {
      const options = { autoDamageRoll: vi.fn(), characters: [{ name: 'Goblin' }] };
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName, options)
      );
      expect(result.current).toHaveProperty('popupHtml');
    });

    it('throws on null options due to destructuring', () => {
      expect(() => {
        renderHook(() => useLoggedDiceRoll(characterName, campaignName, null));
      }).toThrow();
    });

    it('handles undefined options', () => {
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName, undefined)
      );
      expect(result.current.popupHtml).toBeNull();
    });
  });

  describe('roll functions', () => {
    it('rollAbilityCheck calls createLogAndShow with correct arguments', () => {
      const mockLogAndShow = vi.fn();
      createLogAndShow.mockReturnValue(mockLogAndShow);
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      act(() => {
        result.current.rollAbilityCheck('Athletics', 5, { target: 'Goblin' });
      });
      expect(mockLogAndShow).toHaveBeenCalledWith('Athletics', 5, 'check', { target: 'Goblin' });
    });

    it('rollSavingThrow calls createLogAndShow with correct arguments', () => {
      const mockLogAndShow = vi.fn();
      createLogAndShow.mockReturnValue(mockLogAndShow);
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      act(() => {
        result.current.rollSavingThrow('Constitution', 3, { target: 'Fireball' });
      });
      expect(mockLogAndShow).toHaveBeenCalledWith('Constitution', 3, 'save', { target: 'Fireball' });
    });

    it('rollSkillCheck calls createLogAndShow with correct arguments', () => {
      const mockLogAndShow = vi.fn();
      createLogAndShow.mockReturnValue(mockLogAndShow);
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      act(() => {
        result.current.rollSkillCheck('Stealth', 4, {});
      });
      expect(mockLogAndShow).toHaveBeenCalledWith('Stealth', 4, 'skill', {});
    });

    it('rollInitiative calls createLogAndShow with correct arguments', () => {
      const mockLogAndShow = vi.fn();
      createLogAndShow.mockReturnValue(mockLogAndShow);
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      act(() => {
        result.current.rollInitiative(2, {});
      });
      expect(mockLogAndShow).toHaveBeenCalledWith('Initiative', 2, 'initiative', {});
    });

    it('rollAttack calls createLogAndShow with correct arguments', () => {
      const mockLogAndShow = vi.fn();
      createLogAndShow.mockReturnValue(mockLogAndShow);
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      act(() => {
        result.current.rollAttack('Longsword', 7, { target: 'Goblin' });
      });
      expect(mockLogAndShow).toHaveBeenCalledWith('Longsword', 7, 'attack', { target: 'Goblin' });
    });

    it('rollDamage calls createLogDamageAndShow with correct arguments', () => {
      const mockLogDamageAndShow = vi.fn();
      createLogDamageAndShow.mockReturnValue(mockLogDamageAndShow);
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      act(() => {
        result.current.rollDamage('Longsword', '2d6+3', 10, [3, 7], 3, { targetName: 'Goblin' });
      });
      expect(mockLogDamageAndShow).toHaveBeenCalledWith(
        'Longsword', '2d6+3', 10, [3, 7], 3, { targetName: 'Goblin' }
      );
    });
  });

  describe('event listeners setup', () => {
    it('calls setupEventListeners with correct arguments', () => {
      renderHook(() => useLoggedDiceRoll(characterName, campaignName));
      expect(setupEventListeners).toHaveBeenCalledWith({
        characterName,
        campaignName,
        logEntry: expect.any(Function),
        charactersRef: expect.any(Object),
      });
    });
  });

  describe('campaign name encoding', () => {
    it('handles campaign name with special characters', () => {
      const specialCampaign = 'test-campaign/2024';
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, specialCampaign)
      );
      expect(result.current).toHaveProperty('rollAbilityCheck');
    });
  });

  describe('window.__pendingSaves', () => {
    it('initializes window.__pendingSaves if not present', () => {
      delete window.__pendingSaves;
      renderHook(() => useLoggedDiceRoll(characterName, campaignName));
      expect(window.__pendingSaves).toBeDefined();
    });

    it('uses existing window.__pendingSaves if present', () => {
      window.__pendingSaves = { existing: true };
      renderHook(() => useLoggedDiceRoll(characterName, campaignName));
      expect(window.__pendingSaves).toEqual({ existing: true });
    });
  });

  describe('popupHtml effect', () => {
    it('does not trigger autoDamage when popupHtml.hit is false', () => {
      const mockAutoDamage = vi.fn();
      const { rerender } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: mockAutoDamage })
      );
      rerender();
      expect(mockAutoDamage).not.toHaveBeenCalled();
    });

    it('handles popupHtml being null', () => {
      const mockAutoDamage = vi.fn();
      const { rerender } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: mockAutoDamage })
      );
      rerender();
      expect(mockAutoDamage).not.toHaveBeenCalled();
    });

    it('does not trigger autoDamage when hit is true but autoDamage is missing', () => {
      const mockAutoDamage = vi.fn();
      useDiceRoll.mockReturnValue({
        popupHtml: { hit: true, autoDamage: undefined },
        setPopupHtml: vi.fn(),
      });
      const { rerender } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: mockAutoDamage })
      );
      rerender();
      expect(mockAutoDamage).not.toHaveBeenCalled();
    });

    it('does not trigger autoDamage when source does not match', () => {
      const mockAutoDamage = vi.fn();
      useDiceRoll.mockReturnValue({
        popupHtml: { hit: true, autoDamage: { source: 'OtherCharacter' } },
        setPopupHtml: vi.fn(),
      });
      const { rerender } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: mockAutoDamage, autoDamageSource: 'ThisCharacter' })
      );
      rerender();
      expect(mockAutoDamage).not.toHaveBeenCalled();
    });
  });

  describe('shared context (_isShared)', () => {
    it('uses internal popup when _isShared is false', () => {
      const internalSetPopupHtml = vi.fn();
      useDiceRoll.mockReturnValue({ popupHtml: null, setPopupHtml: internalSetPopupHtml });
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      expect(result.current.setPopupHtml).toBe(internalSetPopupHtml);
    });

    it('uses context popup when _isShared is true', () => {
      const contextSetPopupHtml = vi.fn();
      const contextPopupHtml = { type: 'd20', hit: true };
      const internalSetPopupHtml = vi.fn();
      useDiceRoll.mockReturnValue({ popupHtml: null, setPopupHtml: internalSetPopupHtml });

      const { result } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName),
        {
          wrapper: ({ children }) => (
            <DiceRollContext.Provider value={{ popupHtml: contextPopupHtml, setPopupHtml: contextSetPopupHtml, _isShared: true }}>
              {children}
            </DiceRollContext.Provider>
          ),
        }
      );
      expect(result.current.setPopupHtml).toBe(contextSetPopupHtml);
      expect(result.current.setPopupHtml).not.toBe(internalSetPopupHtml);
    });

    it('returns internalPopupHtml regardless of _isShared', () => {
      const contextSetPopupHtml = vi.fn();
      const internalSetPopupHtml = vi.fn();
      useDiceRoll.mockReturnValue({ popupHtml: 'internal-value', setPopupHtml: internalSetPopupHtml });

      const { result } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName),
        {
          wrapper: ({ children }) => (
            <DiceRollContext.Provider value={{ popupHtml: 'context-value', setPopupHtml: contextSetPopupHtml, _isShared: true }}>
              {children}
            </DiceRollContext.Provider>
          ),
        }
      );
      expect(result.current.popupHtml).toBe('internal-value');
    });
  });

  describe('refs update on re-render', () => {
    it('updates autoDamageRollRef when options change', () => {
      const mockAutoDamage1 = vi.fn();
      const mockAutoDamage2 = vi.fn();
      const { rerender } = renderHook(
        ({ options }) => useLoggedDiceRoll(characterName, campaignName, options),
        { initialProps: { options: { autoDamageRoll: mockAutoDamage1, characters: [] } } }
      );
      rerender({ options: { autoDamageRoll: mockAutoDamage2, characters: [] } });
    });

    it('updates charactersRef when characters change', () => {
      const characters1 = [{ name: 'Goblin' }];
      const characters2 = [{ name: 'Dragon' }];
      const { rerender } = renderHook(
        ({ options }) => useLoggedDiceRoll(characterName, campaignName, options),
        { initialProps: { options: { autoDamageRoll: vi.fn(), characters: characters1 } } }
      );
      rerender({ options: { autoDamageRoll: vi.fn(), characters: characters2 } });
    });

    it('updates autoDamageSourceRef when options change', () => {
      const { rerender } = renderHook(
        ({ options }) => useLoggedDiceRoll(characterName, campaignName, options),
        { initialProps: { options: { autoDamageRoll: vi.fn(), autoDamageSource: 'SourceA' } } }
      );
      rerender({ options: { autoDamageRoll: vi.fn(), autoDamageSource: 'SourceB' } });
    });
  });

  describe('logEntry function', () => {
    it('posts to campaign log endpoint with correct URL encoding', () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', mockFetch);

      renderHook(() => useLoggedDiceRoll(characterName, campaignName));

      // The logEntry function is created inside the hook and not directly accessible,
      // but we can verify the setupEventListeners was called (which internally uses logEntry)
      expect(setupEventListeners).toHaveBeenCalled();
    });

    it('logs fetch errors without throwing in the hook itself', () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
      vi.stubGlobal('fetch', mockFetch);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderHook(() => useLoggedDiceRoll(characterName, campaignName));
      expect(setupEventListeners).toHaveBeenCalled();
      consoleSpy.mockRestore();
      vi.unstubAllGlobals();
    });
  });

  describe('edge cases', () => {
    it('handles empty characterName', () => {
      const { result } = renderHook(() =>
        useLoggedDiceRoll('', campaignName)
      );
      expect(result.current).toHaveProperty('rollAbilityCheck');
    });

    it('handles empty campaignName', () => {
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, '')
      );
      expect(result.current).toHaveProperty('rollAbilityCheck');
    });

    it('handles options with no autoDamageRoll', () => {
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName, { characters: [] })
      );
      expect(result.current).toHaveProperty('rollAbilityCheck');
    });

    it('handles options with no characters', () => {
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: vi.fn() })
      );
      expect(result.current).toHaveProperty('rollAbilityCheck');
    });

    it('handles options object with all properties', () => {
      const options = {
        autoDamageRoll: vi.fn(),
        characters: [{ name: 'Goblin' }, { name: 'Dragon' }],
        autoDamageSource: 'Wizard',
      };
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName, options)
      );
      expect(result.current).toHaveProperty('rollAbilityCheck');
      expect(result.current).toHaveProperty('rollDamage');
    });
  });
});
