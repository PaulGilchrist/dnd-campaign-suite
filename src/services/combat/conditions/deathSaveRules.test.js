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
    it('returns false for empty array', () => {
      expect(isStable([])).toBe(false);
    });

    it('returns false when fewer than 3 saves are marked', () => {
      expect(isStable([true, false, false])).toBe(false);
      expect(isStable([true, true, false])).toBe(false);
      expect(isStable([false, false, false])).toBe(false);
    });

    it('returns true when exactly 3 saves are marked', () => {
      expect(isStable([true, true, true])).toBe(true);
    });

    it('returns true when more than 3 saves are marked', () => {
      expect(isStable([true, false, true, true])).toBe(true);
      expect(isStable([true, true, true, true, true])).toBe(true);
    });

    it('ignores non-boolean falsy values', () => {
      expect(isStable([0, null, undefined, false])).toBe(false);
    });
  });

  describe('isDead', () => {
    it('returns false for empty array', () => {
      expect(isDead([])).toBe(false);
    });

    it('returns false when fewer than 3 failures are marked', () => {
      expect(isDead([true, false, false])).toBe(false);
      expect(isDead([true, true, false])).toBe(false);
      expect(isDead([false, false, false])).toBe(false);
    });

    it('returns true when exactly 3 failures are marked', () => {
      expect(isDead([true, true, true])).toBe(true);
    });

    it('returns true when more than 3 failures are marked', () => {
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

    it('treats 18 as nat20 when treat18AsNat20 is true', () => {
      mockD20(18);
      const result = rollDeathSave([], [], true);
      expect(result.roll).toBe(18);
      expect(result.result).toBe('nat20');
      expect(result.isNat20).toBe(true);
      expect(result.restoredToHp).toBe(1);
    });

    it('does not treat 18 as nat20 when treat18AsNat20 is false', () => {
      mockD20(18);
      const result = rollDeathSave([], [], false);
      expect(result.result).toBe('success');
      expect(result.isNat20).toBe(false);
      expect(result.restoredToHp).toBeNull();
    });

    it('marks a save in the first empty slot on roll >= 10', () => {
      mockD20(15);
      const result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('success');
      expect(result.roll).toBe(15);
      expect(result.newSaves).toEqual([true, false, false]);
      expect(result.newFailures).toEqual([false, false, false]);
    });

    it('marks a save in the second empty slot when first is filled', () => {
      mockD20(12);
      const result = rollDeathSave([true, false, false], [false, false, false]);
      expect(result.newSaves).toEqual([true, true, false]);
    });

    it('marks a save in the third empty slot when first two are filled', () => {
      mockD20(10);
      const result = rollDeathSave([true, true, false], [false, false, false]);
      expect(result.result).toBe('stable');
      expect(result.newSaves).toEqual([false, false, false]);
      expect(result.newFailures).toEqual([false, false, false]);
    });

    it('marks a failure in the first empty slot on roll < 10', () => {
      mockD20(5);
      const result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('failure');
      expect(result.roll).toBe(5);
      expect(result.newFailures).toEqual([true, false, false]);
      expect(result.newSaves).toEqual([false, false, false]);
    });

    it('marks 2 failures on natural 1', () => {
      mockD20(1);
      const result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('failure');
      expect(result.isNat1).toBe(true);
      expect(result.newFailures).toEqual([true, true, false]);
    });

    it('marks 2 failures on natural 1 even when only 1 slot remains', () => {
      mockD20(1);
      const result = rollDeathSave([false, false, false], [true, true, true]);
      expect(result.result).toBe('dead');
      expect(result.newFailures).toEqual([false, false, false]);
    });

    it('marks the 3rd failure and returns dead', () => {
      mockD20(3);
      const result = rollDeathSave([false, false, false], [true, true, false]);
      expect(result.result).toBe('dead');
      expect(result.newFailures).toEqual([false, false, false]);
      expect(result.newSaves).toEqual([false, false, false]);
    });

    it('does not modify saves when failing', () => {
      mockD20(4);
      const result = rollDeathSave([true, false, true], [false, false, false]);
      expect(result.newSaves).toEqual([true, false, true]);
    });

    it('does not modify failures when succeeding', () => {
      mockD20(14);
      const result = rollDeathSave([false, false, false], [true, false, false]);
      expect(result.newFailures).toEqual([true, false, false]);
    });

    it('resets saves and failures when reaching stable', () => {
      mockD20(10);
      const result = rollDeathSave([true, true, false], [true, false, false]);
      expect(result.result).toBe('stable');
      expect(result.newSaves).toEqual([false, false, false]);
      expect(result.newFailures).toEqual([false, false, false]);
    });

    it('resets saves and failures when reaching dead', () => {
      mockD20(2);
      const result = rollDeathSave([true, false, false], [true, true, false]);
      expect(result.result).toBe('dead');
      expect(result.newSaves).toEqual([false, false, false]);
      expect(result.newFailures).toEqual([false, false, false]);
    });
  });

  describe('rollDeathSaveWithAdvantage', () => {
    it('uses the higher of two rolls', () => {
      mockD20Sequence(3, 17);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.roll).toBe(17);
      expect(result.result).toBe('success');
      expect(result.rolls).toEqual([3, 17]);
    });

    it('uses the higher of two rolls when first is higher', () => {
      mockD20Sequence(17, 3);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.roll).toBe(17);
      expect(result.result).toBe('success');
      expect(result.rolls).toEqual([17, 3]);
    });

    it('restores 1 HP when best roll is nat20', () => {
      mockD20Sequence(5, 20);
      const result = rollDeathSaveWithAdvantage([], []);
      expect(result.roll).toBe(20);
      expect(result.result).toBe('nat20');
      expect(result.restoredToHp).toBe(1);
    });

    it('marks nat1 only when both rolls are 1', () => {
      mockD20Sequence(1, 1);
      const result = rollDeathSaveWithAdvantage([], []);
      expect(result.roll).toBe(1);
      expect(result.isNat1).toBe(true);
      expect(result.result).toBe('failure');
    });

    it('does not mark nat1 when only one roll is 1', () => {
      mockD20Sequence(1, 15);
      const result = rollDeathSaveWithAdvantage([], []);
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

    it('returns null restoredToHp on non-nat20', () => {
      mockD20Sequence(8, 12);
      const result = rollDeathSaveWithAdvantage([], []);
      expect(result.restoredToHp).toBeNull();
    });

    it('marks success when best roll >= 10', () => {
      mockD20Sequence(4, 13);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.result).toBe('success');
      expect(result.roll).toBe(13);
    });

    it('marks failure when best roll < 10', () => {
      mockD20Sequence(4, 6);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.result).toBe('failure');
      expect(result.roll).toBe(6);
    });

    it('marks success in the correct slot when best roll >= 10', () => {
      mockD20Sequence(3, 11);
      const result = rollDeathSaveWithAdvantage([true, false, false], [false, false, false]);
      expect(result.newSaves).toEqual([true, true, false]);
    });

    it('marks 2 failures on nat1 with two rolls', () => {
      mockD20Sequence(1, 1);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.newFailures).toEqual([true, true, false]);
    });

    it('returns dead when 3rd failure reached with advantage', () => {
      mockD20Sequence(2, 5);
      const result = rollDeathSaveWithAdvantage([false, false, false], [true, true, false]);
      expect(result.result).toBe('dead');
      expect(result.newFailures).toEqual([false, false, false]);
    });
  });
});
