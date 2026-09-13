// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import useLoggedDiceRoll from './useLoggedDiceRoll.js';
import { DiceRollContext } from './DiceRollContext.js';
import { clearRuntimeState, seedTrackedResources } from '../runtime/useRuntimeState.js';

vi.mock('./useDiceRoll.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 7, rolls: [3, 4], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 14, rolls: [7, 7], modifier: 0 })),
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
    clearRuntimeState(campaignName);
    seedTrackedResources(campaignName, { pendingSavePrompts: {} });
  });

  describe('initial return value', () => {
    it('returns popupHtml, setPopupHtml, and all roll functions', () => {
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      expect(result.current.popupHtml).toBeNull();
      expect(typeof result.current.setPopupHtml).toBe('function');
      expect(typeof result.current.rollAbilityCheck).toBe('function');
      expect(typeof result.current.rollSavingThrow).toBe('function');
      expect(typeof result.current.rollSkillCheck).toBe('function');
      expect(typeof result.current.rollInitiative).toBe('function');
      expect(typeof result.current.rollAttack).toBe('function');
      expect(typeof result.current.rollDamage).toBe('function');
      expect(typeof result.current.quickRollPlayerSave).toBe('function');
      expect(typeof result.current.triggerGloriousDefenseCounterAttack).toBe('function');
    });
  });

  describe('roll delegation', () => {
    const delegationTests = [
      ['rollAbilityCheck', 'check', ['Athletics', 5], { target: 'Goblin' }],
      ['rollSavingThrow', 'save', ['Constitution', 3], { target: 'Fireball' }],
      ['rollSkillCheck', 'skill', ['Stealth', 4], {}],
      ['rollAttack', 'attack', ['Longsword', 7], { target: 'Goblin' }],
    ];

    for (const [fnName, rollType, callArgs, context] of delegationTests) {
      it(`delegates ${fnName} to createLogAndShow with type "${rollType}"`, () => {
        const mockLogAndShow = vi.fn();
        createLogAndShow.mockReturnValue(mockLogAndShow);
        const { result } = renderHook(() =>
          useLoggedDiceRoll(characterName, campaignName)
        );
        act(() => {
          result.current[fnName](...callArgs, context);
        });
        expect(mockLogAndShow).toHaveBeenCalledWith(...callArgs, rollType, context);
      });
    }

    it('delegates rollInitiative to createLogAndShow with name "Initiative" and type "initiative"', () => {
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

    it('delegates rollDamage to createLogDamageAndShow with all arguments', () => {
      const mockLogDamageAndShow = vi.fn();
      createLogDamageAndShow.mockReturnValue(mockLogDamageAndShow);
      const { result } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName)
      );
      act(() => {
        result.current.rollDamage({ name: 'Longsword', formula: '2d6+3', total: 10, rolls: [3, 7], modifier: 3, context: { targetName: 'Goblin' } });
      });
      expect(mockLogDamageAndShow).toHaveBeenCalledWith(
        { name: 'Longsword', formula: '2d6+3', total: 10, rolls: [3, 7], modifier: 3, context: { targetName: 'Goblin' } }
      );
    });
  });

  describe('event listeners setup', () => {
    it('calls setupEventListeners with characterName, campaignName, logEntry function, and charactersRef', () => {
      const characters = [{ name: 'TestFighter' }];
      renderHook(() => useLoggedDiceRoll(characterName, campaignName, { characters }));
      expect(setupEventListeners).toHaveBeenCalledWith({
        characterName,
        campaignName,
        logEntry: expect.any(Function),
        charactersRef: expect.any(Object),
      });
    });
  });

  describe('autoDamage via dice-roll-done custom event', () => {
    it('triggers autoDamage when hit is true, autoDamage exists, and source matches', async () => {
      const mockAutoDamage = vi.fn();
      const autoDamageData = { formula: '2d6+3', damageType: 'fire', source: 'TestFighter' };
      useDiceRoll.mockReturnValue({
        popupHtml: { hit: true, autoDamage: autoDamageData },
        setPopupHtml: vi.fn(),
      });
      vi.useFakeTimers();
      renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: mockAutoDamage, autoDamageSource: 'TestFighter' })
      );
      window.dispatchEvent(new CustomEvent('dice-roll-done', { detail: { autoDamage: autoDamageData, isCrit: undefined } }));
      await vi.runAllTimersAsync();
      vi.useRealTimers();
      expect(mockAutoDamage).toHaveBeenCalledWith(autoDamageData, undefined);
    });

    it('passes isCrit to autoDamageRoll when present in the event detail', async () => {
      const mockAutoDamage = vi.fn();
      const autoDamageData = { formula: '2d6+3', damageType: 'fire', source: 'TestFighter' };
      useDiceRoll.mockReturnValue({
        popupHtml: { hit: true, autoDamage: autoDamageData, isCrit: true },
        setPopupHtml: vi.fn(),
      });
      vi.useFakeTimers();
      renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: mockAutoDamage, autoDamageSource: 'TestFighter' })
      );
      window.dispatchEvent(new CustomEvent('dice-roll-done', { detail: { autoDamage: autoDamageData, isCrit: true } }));
      await vi.runAllTimersAsync();
      vi.useRealTimers();
      expect(mockAutoDamage).toHaveBeenCalledWith(autoDamageData, true);
    });

    it('does not trigger autoDamage when source does not match', async () => {
      const mockAutoDamage = vi.fn();
      useDiceRoll.mockReturnValue({
        popupHtml: { hit: true, autoDamage: { formula: '2d6', source: 'OtherCharacter' } },
        setPopupHtml: vi.fn(),
      });
      vi.useFakeTimers();
      renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: mockAutoDamage, autoDamageSource: 'ThisCharacter' })
      );
      await vi.runAllTimersAsync();
      vi.useRealTimers();
      expect(mockAutoDamage).not.toHaveBeenCalled();
    });

    it('does not trigger autoDamage when hit is false', async () => {
      const mockAutoDamage = vi.fn();
      useDiceRoll.mockReturnValue({
        popupHtml: { hit: false, autoDamage: { formula: '2d6', source: 'TestFighter' } },
        setPopupHtml: vi.fn(),
      });
      vi.useFakeTimers();
      renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: mockAutoDamage, autoDamageSource: 'TestFighter' })
      );
      await vi.runAllTimersAsync();
      vi.useRealTimers();
      expect(mockAutoDamage).not.toHaveBeenCalled();
    });

    it('does not trigger autoDamage when autoDamageSource is not provided in options', async () => {
      const mockAutoDamage = vi.fn();
      useDiceRoll.mockReturnValue({
        popupHtml: { hit: true, autoDamage: { formula: '2d6', source: 'TestFighter' } },
        setPopupHtml: vi.fn(),
      });
      vi.useFakeTimers();
      renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: mockAutoDamage })
      );
      window.dispatchEvent(new CustomEvent('dice-roll-done', { detail: { autoDamage: { formula: '2d6', source: 'TestFighter' } } }));
      await vi.runAllTimersAsync();
      vi.useRealTimers();
      expect(mockAutoDamage).not.toHaveBeenCalled();
    });
  });

  describe('event listener cleanup', () => {
    it('removes the dice-roll-done event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName, { autoDamageSource: 'TestFighter' })
      );
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('dice-roll-done', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('shared context (_isShared)', () => {
    it('uses context setPopupHtml when _isShared is true', () => {
      const contextSetPopupHtml = vi.fn();
      const internalSetPopupHtml = vi.fn();
      useDiceRoll.mockReturnValue({ popupHtml: null, setPopupHtml: internalSetPopupHtml });

      const { result } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName),
        {
          wrapper: ({ children }) => (
            <DiceRollContext.Provider value={{ popupHtml: { type: 'd20' }, setPopupHtml: contextSetPopupHtml, _isShared: true }}>
              {children}
            </DiceRollContext.Provider>
          ),
        }
      );
      expect(result.current.setPopupHtml).toBe(contextSetPopupHtml);
    });

    it('uses internal setPopupHtml when _isShared is false or absent', () => {
      const contextSetPopupHtml = vi.fn();
      const internalSetPopupHtml = vi.fn();
      useDiceRoll.mockReturnValue({ popupHtml: null, setPopupHtml: internalSetPopupHtml });

      const { result } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName),
        {
          wrapper: ({ children }) => (
            <DiceRollContext.Provider value={{ popupHtml: { type: 'd20' }, setPopupHtml: contextSetPopupHtml }}>
              {children}
            </DiceRollContext.Provider>
          ),
        }
      );
      expect(result.current.setPopupHtml).toBe(internalSetPopupHtml);
    });

    it('always returns internal popupHtml regardless of context value', () => {
      const internalSetPopupHtml = vi.fn();
      useDiceRoll.mockReturnValue({ popupHtml: 'internal-value', setPopupHtml: internalSetPopupHtml });

      const { result } = renderHook(
        () => useLoggedDiceRoll(characterName, campaignName),
        {
          wrapper: ({ children }) => (
            <DiceRollContext.Provider value={{ popupHtml: 'context-value', setPopupHtml: vi.fn(), _isShared: true }}>
              {children}
            </DiceRollContext.Provider>
          ),
        }
      );
      expect(result.current.popupHtml).toBe('internal-value');
    });
  });
});
