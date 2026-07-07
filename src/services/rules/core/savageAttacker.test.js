// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  applySavageAttacker,
  applySavageAttackerFull,
  savageAttackerApplies,
} from './savageAttacker.js';

/**
 * Deterministic Math.random harness.
 * Saves the original Math.random, replaces it with a controlled function,
 * and restores on cleanup. This is the pattern used throughout the project
 * (see diceRoller.test.js, npcGenerator.test.js, countercharmHandler.test.js).
 */
function useDeterministicRandom(values) {
  const original = Math.random;
  const iterator = values[Symbol.iterator]();

  Math.random = () => {
    const next = iterator.next();
    return next.done ? 0 : next.value;
  };

  return {
    restore: () => {
      Math.random = original;
    },
  };
}

describe('savageAttacker', () => {
  describe('applySavageAttacker', () => {
    it('returns non-array and empty inputs unchanged', () => {
      expect(applySavageAttacker(null)).toBe(null);
      expect(applySavageAttacker(undefined)).toBe(undefined);
      expect(applySavageAttacker(5)).toBe(5);
      expect(applySavageAttacker('string')).toBe('string');
      expect(applySavageAttacker([])).toEqual([]);
    });

    it('returns first rolls when second total is lower', () => {
      // firstRolls = [3, 4], total=7
      // second: Math.random=0 => reroll=1 for roll=3 (Math.floor(0*3)+1=1), reroll=1 for roll=4 (Math.floor(0*4)+1=1) => total=2 < 7
      const restore = useDeterministicRandom([0, 0]);
      try {
        const rolls = [3, 4];
        const result = applySavageAttacker(rolls);
        expect(result).toEqual([3, 4]);
      } finally {
        restore.restore();
      }
    });

    it('does not mutate the input array', () => {
      const rolls = [3, 4];
      const restore = useDeterministicRandom([0]);
      try {
        applySavageAttacker(rolls);
        expect(rolls).toEqual([3, 4]);
      } finally {
        restore.restore();
      }
    });
  });

  describe('applySavageAttackerFull', () => {
    it('returns original rolls when input is falsy or invalid', () => {
      expect(applySavageAttackerFull([3, 4], null)).toEqual({ rolls: [3, 4], secondRolls: [], higher: false });
      expect(applySavageAttackerFull([3, 4], undefined)).toEqual({ rolls: [3, 4], secondRolls: [], higher: false });
      expect(applySavageAttackerFull([], '2d6')).toEqual({ rolls: [], secondRolls: [], higher: false });
      expect(applySavageAttackerFull('3,4', '2d6')).toEqual({ rolls: '3,4', secondRolls: [], higher: false });
      expect(applySavageAttackerFull([3, 4], 'invalid')).toEqual({ rolls: [3, 4], secondRolls: [], higher: false });
      expect(applySavageAttackerFull([3, 4], 'd6')).toEqual({ rolls: [3, 4], secondRolls: [], higher: false });
      expect(applySavageAttackerFull([3, 4], '2d')).toEqual({ rolls: [3, 4], secondRolls: [], higher: false });
      expect(applySavageAttackerFull([3, 4, 5], '2d6')).toEqual({ rolls: [3, 4, 5], secondRolls: [], higher: false });
      expect(applySavageAttackerFull([3, 4], '2d0')).toEqual({ rolls: [3, 4], secondRolls: [], higher: false });
      expect(applySavageAttackerFull([3, 4], '2d-6')).toEqual({ rolls: [3, 4], secondRolls: [], higher: false });
    });

    it('returns second rolls when second total is higher', () => {
      // firstRolls = [1, 1] => total=2
      // second: random=0.99 => reroll=Math.floor(0.99*6)+1=6 each => [6,6] => total=12 > 2
      const restore = useDeterministicRandom([0.99, 0.99]);
      try {
        const result = applySavageAttackerFull([1, 1], '2d6');
        expect(result.rolls).toEqual([6, 6]);
        expect(result.secondRolls).toEqual([6, 6]);
        expect(result.higher).toBe(true);
      } finally {
        restore.restore();
      }
    });

    it('returns first rolls when first total is higher', () => {
      // firstRolls = [6, 6] => total=12 (max possible)
      // second: random=0 => [1,1] => total=2 < 12 => returns first
      const restore = useDeterministicRandom([0, 0]);
      try {
        const result = applySavageAttackerFull([6, 6], '2d6');
        expect(result.rolls).toEqual([6, 6]);
        expect(result.secondRolls).toEqual([1, 1]);
        expect(result.higher).toBe(false);
      } finally {
        restore.restore();
      }
    });

    it('does not mutate the input array', () => {
      const rolls = [3, 4];
      const restore = useDeterministicRandom([0, 0]);
      try {
        applySavageAttackerFull(rolls, '2d6');
        expect(rolls).toEqual([3, 4]);
      } finally {
        restore.restore();
      }
    });
  });

  describe('savageAttackerApplies', () => {
    it('returns false for null, undefined, and empty objects', () => {
      expect(savageAttackerApplies(null)).toBe(false);
      expect(savageAttackerApplies(undefined)).toBe(false);
      expect(savageAttackerApplies({})).toBe(false);
    });

    it('returns false when automation or passives is missing', () => {
      expect(savageAttackerApplies({ automation: {} })).toBe(false);
      expect(savageAttackerApplies({ automation: { passives: [] } })).toBe(false);
    });

    it('returns false when no matching passive exists', () => {
      const ps = {
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'great_weapon_fighting', name: 'Great Weapon Fighting' },
            { type: 'passive_rule', effect: 'crit_on_1', name: 'Critical Threats' },
            { type: 'feature', effect: 'reroll_damage_once_per_turn', name: 'Savage Attacker' },
            { type: 'passive_rule', effect: 'reroll_damage_once', name: 'Some Feat' },
          ],
        },
      };
      expect(savageAttackerApplies(ps)).toBe(false);
    });

    it('returns true when reroll_damage_once_per_turn passive exists', () => {
      const ps = {
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'reroll_damage_once_per_turn', name: 'Savage Attacker' },
          ],
        },
      };
      expect(savageAttackerApplies(ps)).toBe(true);
    });
  });
});
