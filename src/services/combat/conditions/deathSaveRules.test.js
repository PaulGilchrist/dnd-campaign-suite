// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import { rollDeathSave, rollDeathSaveWithAdvantage, isStable, isDead } from './deathSaveRules.js';
import * as diceRoller from '../../dice/diceRoller.js';

function mockD20(value) {
  vi.spyOn(diceRoller, 'rollD20').mockReturnValue(value);
}

function mockD20Sequence(...values) {
  let index = 0;
  vi.spyOn(diceRoller, 'rollD20').mockImplementation(() => values[index++]);
}

describe('deathSaveRules', () => {
  describe('isStable', () => {
    it('returns false for empty or fewer than 3 marked saves', () => {
      expect(isStable([])).toBe(false);
      expect(isStable([true, false, false])).toBe(false);
      expect(isStable([true, true, false])).toBe(false);
      expect(isStable([false, false, false])).toBe(false);
    });

    it('returns true when 3 or more saves are marked', () => {
      expect(isStable([true, true, true])).toBe(true);
      expect(isStable([true, false, true, true])).toBe(true);
      expect(isStable([true, true, true, true, true])).toBe(true);
    });

    it('ignores non-boolean falsy values', () => {
      expect(isStable([0, null, undefined, false])).toBe(false);
    });
  });

  describe('isDead', () => {
    it('returns false for empty or fewer than 3 failures', () => {
      expect(isDead([])).toBe(false);
      expect(isDead([true, false, false])).toBe(false);
      expect(isDead([true, true, false])).toBe(false);
      expect(isDead([false, false, false])).toBe(false);
    });

    it('returns true when 3 or more failures are marked', () => {
      expect(isDead([true, true, true])).toBe(true);
      expect(isDead([true, true, true, true])).toBe(true);
    });

    it('ignores non-boolean falsy values', () => {
      expect(isDead([0, null, undefined, false])).toBe(false);
    });
  });

  describe('rollDeathSave', () => {
    it('restores 1 HP and resets on natural 20', () => {
      mockD20(20);
      const result = rollDeathSave([true, true, true], [true, true, true]);
      expect(result.roll).toBe(20);
      expect(result.result).toBe('nat20');
      expect(result.isNat20).toBe(true);
      expect(result.restoredToHp).toBe(1);
      expect(result.newSaves).toEqual([false, false, false]);
      expect(result.newFailures).toEqual([false, false, false]);
    });

    it('treats 18 as nat20 when treat18AsNat20 is true but not when false', () => {
      mockD20(18);
      let result = rollDeathSave([], [], true);
      expect(result.result).toBe('nat20');
      expect(result.isNat20).toBe(true);
      expect(result.restoredToHp).toBe(1);

      result = rollDeathSave([], [], false);
      expect(result.result).toBe('success');
      expect(result.isNat20).toBe(false);
      expect(result.restoredToHp).toBeNull();
    });

    it('marks saves in empty slots on roll >= 10', () => {
      mockD20(15);
      let result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('success');
      expect(result.newSaves).toEqual([true, false, false]);

      mockD20(12);
      result = rollDeathSave([true, false, false], [false, false, false]);
      expect(result.newSaves).toEqual([true, true, false]);

      mockD20(10);
      result = rollDeathSave([true, true, false], [false, false, false]);
      expect(result.result).toBe('stable');
      expect(result.newSaves).toEqual([true, true, true]);
    });

    it('marks failures in empty slots on roll < 10', () => {
      mockD20(5);
      let result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('failure');
      expect(result.newFailures).toEqual([true, false, false]);

      mockD20(3);
      result = rollDeathSave([false, false, false], [true, true, false]);
      expect(result.result).toBe('dead');
      expect(result.newFailures).toEqual([true, true, true]);
    });

    it('marks 2 failures on natural 1', () => {
      mockD20(1);
      let result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('failure');
      expect(result.isNat1).toBe(true);
      expect(result.newFailures).toEqual([true, true, false]);

      mockD20(1);
      result = rollDeathSave([false, false, false], [true, true, true]);
      expect(result.result).toBe('dead');
      expect(result.newFailures).toEqual([true, true, true]);
    });

    it('does not modify saves when failing and does not modify failures when succeeding', () => {
      mockD20(4);
      const result = rollDeathSave([true, false, true], [false, false, false]);
      expect(result.newSaves).toEqual([true, false, true]);

      mockD20(14);
      const result2 = rollDeathSave([false, false, false], [true, false, false]);
      expect(result2.newFailures).toEqual([true, false, false]);
    });

    it('preserves saves and failures when reaching stable or dead', () => {
      mockD20(10);
      let result = rollDeathSave([true, true, false], [true, false, false]);
      expect(result.result).toBe('stable');
      expect(result.newSaves).toEqual([true, true, true]);
      expect(result.newFailures).toEqual([true, false, false]);

      mockD20(2);
      result = rollDeathSave([true, false, false], [true, true, false]);
      expect(result.result).toBe('dead');
      expect(result.newSaves).toEqual([true, false, false]);
      expect(result.newFailures).toEqual([true, true, true]);
    });
  });

  describe('rollDeathSaveWithAdvantage', () => {
    it('uses the higher of two rolls', () => {
      mockD20Sequence(3, 17);
      let result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.roll).toBe(17);
      expect(result.result).toBe('success');
      expect(result.rolls).toEqual([3, 17]);

      mockD20Sequence(17, 3);
      result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.roll).toBe(17);
    });

    it('restores 1 HP when best roll is nat20, marks nat1 only when both rolls are 1', () => {
      mockD20Sequence(5, 20);
      let result = rollDeathSaveWithAdvantage([], []);
      expect(result.roll).toBe(20);
      expect(result.result).toBe('nat20');
      expect(result.restoredToHp).toBe(1);

      mockD20Sequence(1, 1);
      result = rollDeathSaveWithAdvantage([], []);
      expect(result.roll).toBe(1);
      expect(result.isNat1).toBe(true);
      expect(result.result).toBe('failure');

      mockD20Sequence(1, 15);
      result = rollDeathSaveWithAdvantage([], []);
      expect(result.isNat1).toBe(false);
      expect(result.roll).toBe(15);
    });

    it('treats best roll of 18 as nat20 when treat18AsNat20 is true', () => {
      mockD20Sequence(5, 18);
      const result = rollDeathSaveWithAdvantage([], [], true);
      expect(result.roll).toBe(18);
      expect(result.result).toBe('nat20');
      expect(result.isNat20).toBe(true);
    });

    it('marks 2 failures when best roll is nat1', () => {
      mockD20Sequence(1, 1);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.isNat1).toBe(true);
      expect(result.newFailures.filter(Boolean).length).toBe(2);
    });

    it('marks success when best roll >= 10 and failure when < 10', () => {
      mockD20Sequence(4, 13);
      let result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.result).toBe('success');
      expect(result.roll).toBe(13);

      mockD20Sequence(4, 6);
      result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.result).toBe('failure');
      expect(result.roll).toBe(6);
    });

    it('marks success in the correct slot when best roll >= 10', () => {
      mockD20Sequence(3, 11);
      const result = rollDeathSaveWithAdvantage([true, false, false], [false, false, false]);
      expect(result.newSaves).toEqual([true, true, false]);
    });

    it('marks 2 failures on nat1 with two rolls, returns dead when 3rd failure reached', () => {
      mockD20Sequence(1, 1);
      let result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.newFailures).toEqual([true, true, false]);

      mockD20Sequence(2, 5);
      result = rollDeathSaveWithAdvantage([false, false, false], [true, true, false]);
      expect(result.result).toBe('dead');
      expect(result.newFailures).toEqual([true, true, true]);
    });

    it('returns null restoredToHp on non-nat20', () => {
      mockD20Sequence(8, 12);
      const result = rollDeathSaveWithAdvantage([], []);
      expect(result.restoredToHp).toBeNull();
    });
  });
});
