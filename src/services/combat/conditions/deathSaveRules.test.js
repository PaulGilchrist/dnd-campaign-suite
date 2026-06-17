import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rollDeathSave, rollDeathSaveWithAdvantage, isStable, isDead } from './deathSaveRules.js';

describe('deathSaveRules', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isStable', () => {
    it('returns true when 3 saves are marked', () => {
      expect(isStable([true, true, true])).toBe(true);
    });

    it('returns false when 2 saves are marked', () => {
      expect(isStable([true, true, false])).toBe(false);
    });

    it('returns false when 0 saves are marked', () => {
      expect(isStable([false, false, false])).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(isStable([])).toBe(false);
    });

    it('returns true when any 3 are true', () => {
      expect(isStable([true, false, true, true])).toBe(true);
    });
  });

  describe('isDead', () => {
    it('returns true when 3 failures are marked', () => {
      expect(isDead([true, true, true])).toBe(true);
    });

    it('returns false when 2 failures are marked', () => {
      expect(isDead([true, true, false])).toBe(false);
    });

    it('returns false when 0 failures are marked', () => {
      expect(isDead([false, false, false])).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(isDead([])).toBe(false);
    });
  });

  describe('rollDeathSave', () => {
    it('returns nat20 result when roll is 20', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999);
      const result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('nat20');
      expect(result.roll).toBe(20);
      expect(result.isNat20).toBe(true);
      expect(result.restoredToHp).toBe(1);
      expect(result.newSaves).toEqual([false, false, false]);
      expect(result.newFailures).toEqual([false, false, false]);
    });

    it('returns nat20 result when roll is 18 with treat18AsNat20', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.899);
      const result = rollDeathSave([false, false, false], [false, false, false], true);
      expect(result.result).toBe('nat20');
      expect(result.roll).toBe(18);
      expect(result.isNat20).toBe(true);
      expect(result.restoredToHp).toBe(1);
    });

    it('does not treat 18 as nat20 when treat18AsNat20 is false', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.899);
      const result = rollDeathSave([false, false, false], [false, false, false], false);
      expect(result.result).toBe('success');
      expect(result.isNat20).toBe(false);
      expect(result.restoredToHp).toBeNull();
    });

    it('marks a save when roll is 10 or above', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.499);
      const result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('success');
      expect(result.newSaves[0]).toBe(true);
    });

    it('marks a save when roll is exactly 10', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.45);
      const result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('success');
    });

    it('marks a failure when roll is below 10', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.049);
      const failResult = rollDeathSave([false, false, false], [false, false, false]);
      expect(failResult.result).toBe('failure');
      expect(failResult.newFailures[0]).toBe(true);
    });

    it('marks 2 failures on natural 1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const result = rollDeathSave([false, false, false], [false, false, false]);
      expect(result.result).toBe('failure');
      expect(result.isNat1).toBe(true);
      expect(result.newFailures.filter(Boolean).length).toBe(2);
    });

    it('returns stable when 3rd save is filled', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.499);
      const result = rollDeathSave([true, true, false], [false, false, false]);
      expect(result.result).toBe('stable');
      expect(result.newSaves).toEqual([false, false, false]);
      expect(result.newFailures).toEqual([false, false, false]);
    });

    it('returns dead when 3rd failure is filled', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const result = rollDeathSave([false, false, false], [true, true, false]);
      expect(result.result).toBe('dead');
      expect(result.newFailures).toEqual([false, false, false]);
      expect(result.newSaves).toEqual([false, false, false]);
    });

    it('does not exceed 3 failures even with nat1', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.0);
      const result = rollDeathSave([false, false, false], [true, true, true]);
      expect(result.result).toBe('dead');
      expect(result.newFailures.filter(Boolean).length).toBeLessThanOrEqual(3);
    });

    it('returns result object with roll value', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = rollDeathSave([false, false, false], [false, false, false]);
      expect(typeof result.roll).toBe('number');
      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.roll).toBeLessThanOrEqual(20);
    });

    it('marks first empty save slot', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.499);
      const result = rollDeathSave([false, true, false], [false, false, false]);
      expect(result.newSaves[0]).toBe(true);
      expect(result.newSaves[2]).toBe(false);
    });

  });

  describe('rollDeathSaveWithAdvantage', () => {
    it('uses the higher of two rolls', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.0).mockReturnValueOnce(0.999);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.roll).toBe(20);
      expect(result.result).toBe('nat20');
    });

    it('uses the lower of two rolls for disadvantage-like scenario', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValueOnce(0.0);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.roll).toBe(20);
      expect(result.result).toBe('nat20');
    });

    it('marks nat20 when best roll is 20', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.999);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.result).toBe('nat20');
      expect(result.roll).toBe(20);
    });

    it('marks nat1 only when best roll is 1', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.0).mockReturnValueOnce(0.0);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.isNat1).toBe(true);
      expect(result.result).toBe('failure');
    });

    it('does not mark nat1 when only one roll is 1', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.0).mockReturnValueOnce(0.5);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.isNat1).toBe(false);
    });

    it('includes rolls array', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.75);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(Array.isArray(result.rolls)).toBe(true);
      expect(result.rolls.length).toBe(2);
    });

    it('treats 18 as nat20 with treat18AsNat20', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.899).mockReturnValueOnce(0.5);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false], true);
      expect(result.result).toBe('nat20');
      expect(result.isNat20).toBe(true);
    });

    it('marks success when best roll >= 10', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.6);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.result).toBe('success');
      expect(result.roll).toBe(13);
    });

    it('marks failure when best roll < 10', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.4);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.result).toBe('failure');
    });

    it('marks 2 failures on nat1 best roll', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.0).mockReturnValueOnce(0.0);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.isNat1).toBe(true);
      expect(result.newFailures.filter(Boolean).length).toBe(2);
    });

    it('restores 1 HP on nat20', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.999).mockReturnValueOnce(0.5);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.restoredToHp).toBe(1);
    });

    it('returns null restoredToHp on non-nat20', () => {
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.75);
      const result = rollDeathSaveWithAdvantage([false, false, false], [false, false, false]);
      expect(result.restoredToHp).toBeNull();
    });
  });
});
