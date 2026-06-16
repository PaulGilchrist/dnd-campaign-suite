import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useDiceRoll from './useDiceRoll.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(() => 15),
}));

import { rollD20 } from '../../services/dice/diceRoller.js';

describe('useDiceRoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rollD20.mockReturnValue(15);
  });

  it('should return popupHtml, setPopupHtml, and roll functions', () => {
    const { result } = renderHook(() => useDiceRoll());
    expect(result.current.popupHtml).toBeNull();
    expect(typeof result.current.setPopupHtml).toBe('function');
    expect(typeof result.current.rollAbilityCheck).toBe('function');
    expect(typeof result.current.rollSavingThrow).toBe('function');
    expect(typeof result.current.rollSkillCheck).toBe('function');
    expect(typeof result.current.rollInitiative).toBe('function');
    expect(typeof result.current.rollAttack).toBe('function');
    expect(typeof result.current.rollDamage).toBe('function');
  });

  it('rollAbilityCheck should set popupHtml with type check', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAbilityCheck('Perception', 5);
    });
    expect(result.current.popupHtml).toEqual({
      type: 'd20',
      rollType: 'check',
      name: 'Perception',
      rolls: [15, 15],
      bonus: 5,
    });
  });

  it('rollSavingThrow should set popupHtml with type save', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollSavingThrow('Strength', 3);
    });
    expect(result.current.popupHtml).toEqual({
      type: 'd20',
      rollType: 'save',
      name: 'Strength',
      rolls: [15, 15],
      bonus: 3,
    });
  });

  it('rollSkillCheck should set popupHtml with type skill', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollSkillCheck('Stealth', 7);
    });
    expect(result.current.popupHtml).toEqual({
      type: 'd20',
      rollType: 'skill',
      name: 'Stealth',
      rolls: [15, 15],
      bonus: 7,
    });
  });

  it('rollInitiative should set popupHtml with type initiative', () => {
    const { result } = renderHook(() => useDiceRoll());
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

  it('rollAttack should set popupHtml with type attack', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAttack('Longsword', 6);
    });
    expect(result.current.popupHtml).toEqual({
      type: 'd20',
      rollType: 'attack',
      name: 'Longsword',
      rolls: [15, 15],
      bonus: 6,
    });
  });

  it('rollDamage should set popupHtml with type damage', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollDamage('Longsword', '1d8+3', 7, [4, 3], 3);
    });
    expect(result.current.popupHtml).toEqual({
      type: 'damage',
      name: 'Longsword',
      formula: '1d8+3',
      rolls: [4, 3],
      bonus: 0,
      modifier: 3,
    });
  });

  it('rollDamage should have bonus of 0', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollDamage('Fireball', '8d6', 20, [3, 4, 5, 2, 3, 3], 0);
    });
    expect(result.current.popupHtml.bonus).toBe(0);
  });

  it('should use different roll values when rollD20 returns different values', () => {
    rollD20.mockReturnValueOnce(10).mockReturnValueOnce(20);
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAttack('Spear', 2);
    });
    expect(result.current.popupHtml.rolls).toEqual([10, 20]);
  });

  it('should call rollD20 twice per d20 roll', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAbilityCheck('Athletics', 0);
    });
    expect(rollD20).toHaveBeenCalledTimes(2);
  });

  it('should handle zero bonus values', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAbilityCheck('Acrobatics', 0);
    });
    expect(result.current.popupHtml.bonus).toBe(0);
  });

  it('should handle negative bonus values', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollSavingThrow('Constitution', -2);
    });
    expect(result.current.popupHtml.bonus).toBe(-2);
  });

  it('should handle large bonus values', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAttack('Greatsword', 15);
    });
    expect(result.current.popupHtml.bonus).toBe(15);
  });

  it('should handle empty name in roll functions', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAbilityCheck('', 0);
    });
    expect(result.current.popupHtml.name).toBe('');
  });

  it('should handle rollDamage with empty rolls array', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollDamage('Test', '0', 0, [], 0);
    });
    expect(result.current.popupHtml.rolls).toEqual([]);
  });

  it('should handle rollDamage with single roll value', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollDamage('Test', '1d4', 3, [3], 0);
    });
    expect(result.current.popupHtml.rolls).toEqual([3]);
  });

  it('should handle different roll types in sequence', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAttack('Sword', 5);
    });
    expect(result.current.popupHtml.rollType).toBe('attack');
    act(() => {
      result.current.rollAbilityCheck('Perception', 3);
    });
    expect(result.current.popupHtml.rollType).toBe('check');
  });

  it('should handle rollInitiative with zero bonus', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollInitiative(0);
    });
    expect(result.current.popupHtml.name).toBe('Initiative');
    expect(result.current.popupHtml.rollType).toBe('initiative');
  });

  it('should handle rollAbilityCheck with large bonus', () => {
    const { result } = renderHook(() => useDiceRoll());
    act(() => {
      result.current.rollAbilityCheck('History', 20);
    });
    expect(result.current.popupHtml.bonus).toBe(20);
    expect(result.current.popupHtml.rollType).toBe('check');
  });
});
