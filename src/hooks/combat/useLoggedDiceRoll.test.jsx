// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import useLoggedDiceRoll from './useLoggedDiceRoll.js';
import { DiceRollContext } from './DiceRollContext.js';

vi.mock('./useDiceRoll.js', () => ({
  default: vi.fn(() => ({ popupHtml: null, setPopupHtml: vi.fn() })),
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

import useDiceRoll from './useDiceRoll.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { createLogDamageAndShow } from './useLoggedDiceRollDamage.js';
import { createSaves } from './useLoggedDiceRollSaves.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';

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
  });

  it('exposes the documented public API surface', () => {
    const { result } = renderHook(() => useLoggedDiceRoll(characterName, campaignName));
    expect(Object.keys(result.current).sort()).toEqual([
      'popupHtml',
      'quickRollPlayerSave',
      'rollAbilityCheck',
      'rollAttack',
      'rollDamage',
      'rollInitiative',
      'rollSavingThrow',
      'rollSkillCheck',
      'setPopupHtml',
      'triggerGloriousDefenseCounterAttack',
    ]);
  });

  describe('roll delegation', () => {
    const ctx = { target: 'Goblin' };
    const delegationTests = [
      ['rollAbilityCheck', ['Athletics', 5, ctx], ['Athletics', 5, 'check', ctx]],
      ['rollSavingThrow', ['Constitution', 3, ctx], ['Constitution', 3, 'save', ctx]],
      ['rollSkillCheck', ['Stealth', 4, ctx], ['Stealth', 4, 'skill', ctx]],
      ['rollAttack', ['Longsword', 7, ctx], ['Longsword', 7, 'attack', ctx]],
      ['rollInitiative', [2, ctx], ['Initiative', 2, 'initiative', ctx]],
    ];

    for (const [fnName, callArgs, expectedArgs] of delegationTests) {
      it(`${fnName} delegates to logAndShow`, () => {
        const mockLogAndShow = vi.fn();
        createLogAndShow.mockReturnValue(mockLogAndShow);
        const { result } = renderHook(() => useLoggedDiceRoll(characterName, campaignName));
        result.current[fnName](...callArgs);
        expect(mockLogAndShow).toHaveBeenCalledWith(...expectedArgs);
      });
    }

    it('rollDamage passes the payload straight to logDamageAndShow', () => {
      const mockLogDamageAndShow = vi.fn();
      createLogDamageAndShow.mockReturnValue(mockLogDamageAndShow);
      const { result } = renderHook(() => useLoggedDiceRoll(characterName, campaignName));
      const payload = {
        name: 'Longsword', formula: '2d6+3', total: 10, rolls: [3, 7],
        modifier: 3, context: { targetName: 'Goblin' },
      };
      result.current.rollDamage(payload);
      expect(mockLogDamageAndShow).toHaveBeenCalledWith(payload);
    });
  });

  it('wires helper factories with campaign context and shared refs', () => {
    const characters = [{ name: 'TestFighter' }];
    renderHook(() => useLoggedDiceRoll(characterName, campaignName, { characters }));
    expect(setupEventListeners).toHaveBeenCalledWith({
      characterName,
      campaignName,
      logEntry: expect.any(Function),
      charactersRef: expect.any(Object),
    });
    expect(createLogAndShow).toHaveBeenCalledWith(expect.objectContaining({
      characterName, campaignName, characters, logEntry: expect.any(Function),
    }));
    expect(createLogDamageAndShow).toHaveBeenCalledWith(expect.objectContaining({
      characterName, campaignName, characters, pendingSaves: {},
    }));
    expect(createSaves).toHaveBeenCalledWith(expect.objectContaining({
      characterName, campaignName, logAndShow: expect.any(Function),
    }));
  });

  describe('autoDamage via dice-roll-done event', () => {
    const autoDamage = { formula: '2d6+3', damageType: 'fire', source: characterName };
    const autoDamageTests = [
      ['rolls auto damage on a hit by this character', { autoDamageSource: characterName },
        { hit: true, autoDamage }, [autoDamage, undefined]],
      ['passes isCrit through to autoDamageRoll', { autoDamageSource: characterName },
        { hit: true, isCrit: true, autoDamage }, [autoDamage, true]],
      ['ignores auto damage from another source', { autoDamageSource: characterName },
        { hit: true, autoDamage: { ...autoDamage, source: 'OtherCharacter' } }, null],
      ['ignores auto damage when hit is false', { autoDamageSource: characterName },
        { hit: false, autoDamage }, null],
      ['ignores auto damage when no autoDamageSource option is provided', {},
        { hit: true, autoDamage }, null],
      ['ignores events without autoDamage detail', { autoDamageSource: characterName },
        { hit: true }, null],
    ];

    for (const [label, options, detail, expected] of autoDamageTests) {
      it(label, () => {
        const autoDamageRoll = vi.fn();
        renderHook(() =>
          useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll, ...options })
        );
        window.dispatchEvent(new CustomEvent('dice-roll-done', { detail }));
        if (expected) {
          expect(autoDamageRoll).toHaveBeenCalledWith(...expected);
        } else {
          expect(autoDamageRoll).not.toHaveBeenCalled();
        }
      });
    }

    it('removes the dice-roll-done listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() =>
        useLoggedDiceRoll(characterName, campaignName, { autoDamageRoll: vi.fn(), autoDamageSource: characterName })
      );
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('dice-roll-done', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('shared popup context (_isShared)', () => {
    for (const isShared of [true, false, undefined]) {
      it(`uses ${isShared ? 'context' : 'internal'} setPopupHtml when _isShared is ${isShared}`, () => {
        const contextSetPopupHtml = vi.fn();
        const internalSetPopupHtml = vi.fn();
        useDiceRoll.mockReturnValue({ popupHtml: null, setPopupHtml: internalSetPopupHtml });
        const { result } = renderHook(
          () => useLoggedDiceRoll(characterName, campaignName),
          {
            wrapper: ({ children }) => (
              <DiceRollContext.Provider value={{ popupHtml: { type: 'd20' }, setPopupHtml: contextSetPopupHtml, _isShared: isShared }}>
                {children}
              </DiceRollContext.Provider>
            ),
          }
        );
        expect(result.current.setPopupHtml).toBe(isShared ? contextSetPopupHtml : internalSetPopupHtml);
      });
    }

    it('always exposes the internal popupHtml, even when shared', () => {
      useDiceRoll.mockReturnValue({ popupHtml: 'internal-value', setPopupHtml: vi.fn() });
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
