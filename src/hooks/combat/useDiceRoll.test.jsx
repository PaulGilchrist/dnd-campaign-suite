// @maintained-by-ai: 2026-10-14
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useDiceRoll from './useDiceRoll.js';
import { rollD20 } from '../../services/dice/diceRoller.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

describe('useDiceRoll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Distinct values pin both rolls and their order in popupHtml
    rollD20.mockReturnValueOnce(15).mockReturnValue(3);
  });

  describe('d20 rolls', () => {
    // [fnName, rollType, name (undefined = fixed 'Initiative'), bonus]
    const rollTypeTests = [
      ['rollAbilityCheck', 'check', 'Test', 7],
      ['rollSavingThrow', 'save', 'Test', -3],
      ['rollSkillCheck', 'skill', 'Test', 0],
      ['rollAttack', 'attack', 'Test', 5],
      ['rollInitiative', 'initiative', undefined, 4],
    ];

    for (const [fnName, rollType, name, bonus] of rollTypeTests) {
      it(`${fnName} opens a d20 popup with rollType "${rollType}"`, () => {
        const { result } = renderHook(() => useDiceRoll());
        act(() => {
          if (name === undefined) {
            result.current[fnName](bonus);
          } else {
            result.current[fnName](name, bonus);
          }
        });

        // Always rolls twice for possible adv/disadv
        expect(rollD20).toHaveBeenCalledTimes(2);
        expect(result.current.popupHtml).toEqual({
          type: 'd20',
          rollType,
          name: name ?? 'Initiative',
          rolls: [15, 3],
          bonus,
        });
      });
    }
  });

  describe('rollDamage', () => {
    it('opens a damage popup with all fields, critLabels null without context', () => {
      const { result } = renderHook(() => useDiceRoll());
      act(() => {
        result.current.rollDamage({ name: 'Longsword', formula: '1d8+3', total: 7, rolls: [4, 3], modifier: 3, context: undefined });
      });
      expect(result.current.popupHtml).toEqual({
        type: 'damage',
        name: 'Longsword',
        formula: '1d8+3',
        rolls: [4, 3],
        total: 7,
        bonus: 0,
        modifier: 3,
        critLabels: null,
      });
    });

    it('reads critLabels from context, null for null context', () => {
      const { result } = renderHook(() => useDiceRoll());
      act(() => {
        result.current.rollDamage({ name: 'Test', formula: '1d8', total: 5, rolls: [5], modifier: 0, context: { critLabels: 'critical' } });
      });
      expect(result.current.popupHtml.critLabels).toBe('critical');

      act(() => {
        result.current.rollDamage({ name: 'Test', formula: '1d8', total: 5, rolls: [5], modifier: 0, context: null });
      });
      expect(result.current.popupHtml.critLabels).toBeNull();
    });
  });
});
