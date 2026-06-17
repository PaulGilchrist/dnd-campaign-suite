import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useLoggedDiceRoll from './useLoggedDiceRoll.js';

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
    vi.clearAllMocks();
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
      expect(typeof result.current.rollAbilityCheck).toBe('function');
      expect(typeof result.current.rollSavingThrow).toBe('function');
      expect(typeof result.current.rollSkillCheck).toBe('function');
      expect(typeof result.current.rollInitiative).toBe('function');
      expect(typeof result.current.rollAttack).toBe('function');
      expect(typeof result.current.rollDamage).toBe('function');
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
  });
});
