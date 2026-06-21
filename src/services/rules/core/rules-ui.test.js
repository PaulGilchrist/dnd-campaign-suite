// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((shortName) => {
      switch (shortName) {
        case 'STR': return 'Strength';
        case 'DEX': return 'Dexterity';
        case 'CON': return 'Constitution';
        case 'INT': return 'Intelligence';
        case 'WIS': return 'Wisdom';
        case 'CHA': return 'Charisma';
      }
    }),
  },
}));

vi.mock('../../shared/spell-utils.js', () => ({
  getSpellMaxLevel: vi.fn(),
}));

import rules from '../rules.js';
import * as utils from '../../ui/utils.js';
import * as spellUtils from '../../shared/spell-utils.js';

describe('rules-ui', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAbilityLongName', () => {
    it('should delegate to utils.getAbilityLongName for STR', () => {
      const result = rules.getAbilityLongName('STR');

      expect(result).toBe('Strength');
      expect(utils.default.getAbilityLongName).toHaveBeenCalledWith('STR');
    });

    it('should delegate to utils.getAbilityLongName for all ability scores', () => {
      const abilities = [
        ['STR', 'Strength'],
        ['DEX', 'Dexterity'],
        ['CON', 'Constitution'],
        ['INT', 'Intelligence'],
        ['WIS', 'Wisdom'],
        ['CHA', 'Charisma'],
      ];

      for (const [abbr, expected] of abilities) {
        const result = rules.getAbilityLongName(abbr);
        expect(result).toBe(expected);
      }

      expect(utils.default.getAbilityLongName).toHaveBeenCalledTimes(abilities.length);
    });

    it('should return undefined for unknown ability codes via delegation', () => {
      const result = rules.getAbilityLongName('UNKNOWN');

      expect(result).toBeUndefined();
      expect(utils.default.getAbilityLongName).toHaveBeenCalledWith('UNKNOWN');
    });

    it('should return undefined for lowercase ability codes via delegation', () => {
      const result1 = rules.getAbilityLongName('str');
      const result2 = rules.getAbilityLongName('dex');

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });
  });

  describe('getSpellMaxLevel', () => {
    it('should delegate to spell-utils.getSpellMaxLevel', () => {
      spellUtils.getSpellMaxLevel.mockReturnValue(5);

      const result = rules.getSpellMaxLevel({ spell_slots_level_5: 2 });

      expect(result).toBe(5);
      expect(spellUtils.getSpellMaxLevel).toHaveBeenCalledWith({ spell_slots_level_5: 2 });
    });

    it('should return null when delegated function returns null', () => {
      spellUtils.getSpellMaxLevel.mockReturnValue(null);

      const result = rules.getSpellMaxLevel({});

      expect(result).toBeNull();
      expect(spellUtils.getSpellMaxLevel).toHaveBeenCalledWith({});
    });

    it('should return the highest level with non-zero slots via delegation', () => {
      spellUtils.getSpellMaxLevel.mockReturnValue(9);

      const result = rules.getSpellMaxLevel({
        spell_slots_level_1: 4,
        spell_slots_level_3: 3,
        spell_slots_level_9: 1,
      });

      expect(result).toBe(9);
    });

    it('should handle null input delegation', () => {
      spellUtils.getSpellMaxLevel.mockReturnValue(null);

      const result = rules.getSpellMaxLevel(null);

      expect(result).toBeNull();
      expect(spellUtils.getSpellMaxLevel).toHaveBeenCalledWith(null);
    });
  });
});
