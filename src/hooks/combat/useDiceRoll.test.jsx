// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import useDiceRoll from './useDiceRoll.js';
import { DiceRollContext } from './DiceRollContext.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

import { rollD20 } from '../../services/dice/diceRoller.js';

describe('useDiceRoll', () => {
  const UseDiceRollWrapper = ({ children }) => {
    const [popupHtml, setPopupHtml] = React.useState(null);
    return (
      <DiceRollContext.Provider value={{ popupHtml, setPopupHtml }}>
        {children}
      </DiceRollContext.Provider>
    );
  };

  beforeEach(() => {
    rollD20.mockReturnValue(15);
  });

  describe('initial state', () => {
    it('should return popupHtml, setPopupHtml, and roll functions', () => {
      const { result } = renderHook(() => useDiceRoll(), { wrapper: UseDiceRollWrapper });
      expect(result.current.popupHtml).toBeNull();
      expect(typeof result.current.setPopupHtml).toBe('function');
      expect(typeof result.current.rollAbilityCheck).toBe('function');
      expect(typeof result.current.rollSavingThrow).toBe('function');
      expect(typeof result.current.rollSkillCheck).toBe('function');
      expect(typeof result.current.rollInitiative).toBe('function');
      expect(typeof result.current.rollAttack).toBe('function');
      expect(typeof result.current.rollDamage).toBe('function');
    });
  });

  describe('d20 roll types', () => {
    it.each([
      ['rollAbilityCheck', 'rollAbilityCheck', 'check', 'Perception', 5],
      ['rollSavingThrow', 'rollSavingThrow', 'save', 'Strength', 3],
      ['rollSkillCheck', 'rollSkillCheck', 'skill', 'Stealth', 7],
      ['rollAttack', 'rollAttack', 'attack', 'Longsword', 6],
    ])('should set popupHtml with type %s when calling %s', (_, fnName, rollType, name, bonus) => {
      rollD20.mockReturnValue(15);
      const { result } = renderHook(() => useDiceRoll(), { wrapper: UseDiceRollWrapper });
      act(() => {
        result.current[fnName](name, bonus);
      });
      expect(result.current.popupHtml).toEqual({
        type: 'd20',
        rollType,
        name,
        rolls: [15, 15],
        bonus,
      });
    });

    it('should set popupHtml with type initiative when calling rollInitiative', () => {
      rollD20.mockReturnValue(15);
      const { result } = renderHook(() => useDiceRoll(), { wrapper: UseDiceRollWrapper });
      act(() => {
        result.current.rollInitiative(4);
      });
      expect(result.current.popupHtml).toEqual({
        type: 'd20',
        rollType: 'initiative',
        name: 'Initiative',
        rolls: [15, 15],
        bonus: 4,
      });
    });

    it('should pass through different bonus values', () => {
      const { result: neg } = renderHook(() => useDiceRoll(), { wrapper: UseDiceRollWrapper });
      act(() => {
        neg.current.rollAbilityCheck('Test', -5);
      });
      expect(neg.current.popupHtml.bonus).toBe(-5);

      const { result: pos } = renderHook(() => useDiceRoll(), { wrapper: UseDiceRollWrapper });
      act(() => {
        pos.current.rollAttack('Test', 15);
      });
      expect(pos.current.popupHtml.bonus).toBe(15);
    });
  });

  describe('damage rolls', () => {
    it('should set popupHtml with type damage', () => {
      const { result } = renderHook(() => useDiceRoll(), { wrapper: UseDiceRollWrapper });
      act(() => {
        result.current.rollDamage('Longsword', '1d8+3', 7, [4, 3], 3);
      });
      expect(result.current.popupHtml).toEqual({
        type: 'damage',
        name: 'Longsword',
        formula: '1d8+3',
        rolls: [4, 3],
        total: 7,
        bonus: 0,
        modifier: 3,
      });
    });

    it('should pass through rolls array as provided', () => {
      const { result } = renderHook(() => useDiceRoll(), { wrapper: UseDiceRollWrapper });
      act(() => {
        result.current.rollDamage('Test', '8d6', 20, [3, 4, 5, 2, 3, 3], 0);
      });
      expect(result.current.popupHtml.rolls).toEqual([3, 4, 5, 2, 3, 3]);
    });
  });
});
