// @improved-by-ai
// @cleaned-by-ai
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
    rollD20.mockReturnValue(15);
  });

  describe('d20 roll types', () => {
    const rollTypeTests = [
      ['rollAbilityCheck', 'check'],
      ['rollSavingThrow', 'save'],
      ['rollSkillCheck', 'skill'],
      ['rollAttack', 'attack'],
      ['rollInitiative', 'initiative'],
    ];

    for (const [fnName, expectedRollType] of rollTypeTests) {
      it(`sets popupHtml with type d20 and rollType "${expectedRollType}" when calling ${fnName}`, () => {
        const { result } = renderHook(() => useDiceRoll());
        const isInitiative = fnName === 'rollInitiative';
        act(() => {
          if (isInitiative) {
            result.current[fnName](4);
          } else {
            result.current[fnName]('Test', 5);
          }
        });

        expect(result.current.popupHtml).toEqual({
          type: 'd20',
          rollType: expectedRollType,
          name: isInitiative ? 'Initiative' : 'Test',
          rolls: [15, 15],
          bonus: isInitiative ? 4 : 5,
        });
      });
    }

    it('passes through positive, negative, and zero bonus values', () => {
      const { result: neg } = renderHook(() => useDiceRoll());
      act(() => { neg.current.rollAbilityCheck('Test', -5); });
      expect(neg.current.popupHtml.bonus).toBe(-5);

      const { result: pos } = renderHook(() => useDiceRoll());
      act(() => { pos.current.rollAttack('Test', 15); });
      expect(pos.current.popupHtml.bonus).toBe(15);

      const { result: zero } = renderHook(() => useDiceRoll());
      act(() => { zero.current.rollSkillCheck('Test', 0); });
      expect(zero.current.popupHtml.bonus).toBe(0);
    });
  });

  describe('damage rolls', () => {
    it('sets popupHtml with type damage and all fields', () => {
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

    it('passes critLabels from ctx, null when ctx is undefined or null', () => {
      const { result: withLabels } = renderHook(() => useDiceRoll());
      act(() => {
        withLabels.current.rollDamage({ name: 'Test', formula: '1d8', total: 5, rolls: [5], modifier: 0, context: { critLabels: 'critical' } });
      });
      expect(withLabels.current.popupHtml.critLabels).toBe('critical');

      const { result: undef } = renderHook(() => useDiceRoll());
      act(() => {
        undef.current.rollDamage({ name: 'Test', formula: '1d8', total: 5, rolls: [5], modifier: 0, context: undefined });
      });
      expect(undef.current.popupHtml.critLabels).toBeNull();

      const { result: nullCtx } = renderHook(() => useDiceRoll());
      act(() => {
        nullCtx.current.rollDamage({ name: 'Test', formula: '1d8', total: 5, rolls: [5], modifier: 0, context: null });
      });
      expect(nullCtx.current.popupHtml.critLabels).toBeNull();
    });

    it('handles empty rolls array', () => {
      const { result } = renderHook(() => useDiceRoll());
      act(() => {
        result.current.rollDamage({ name: 'Test', formula: '1d0', total: 0, rolls: [], modifier: 0, context: undefined });
      });
      expect(result.current.popupHtml.rolls).toEqual([]);
    });
  });

  describe('setPopupHtml', () => {
    it('allows direct setPopupHtml calls and clearing', () => {
      const { result } = renderHook(() => useDiceRoll());

      act(() => {
        result.current.setPopupHtml({ type: 'custom', value: 42 });
      });
      expect(result.current.popupHtml).toEqual({ type: 'custom', value: 42 });

      act(() => {
        result.current.setPopupHtml(null);
      });
      expect(result.current.popupHtml).toBeNull();
    });
  });
});
