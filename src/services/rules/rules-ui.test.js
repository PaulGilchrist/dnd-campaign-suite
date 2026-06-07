import { describe, it, expect, vi } from 'vitest';

vi.mock('../ui/utils.js', () => ({
  default: {
    getAbilityLongName: (abbr) => {
      const map = {
        'STR': 'Strength',
        'DEX': 'Dexterity',
        'CON': 'Constitution',
        'INT': 'Intelligence',
        'WIS': 'Wisdom',
        'CHA': 'Charisma'
      };
      return map[abbr];
    }
  }
}));

vi.mock('../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([])
}));

import rules from './rules.js';

describe('rules', () => {
  describe('getAbilityLongName', () => {
    it('should delegate to utils.getAbilityLongName', () => {
      const result = rules.getAbilityLongName('STR');
      expect(result).toBe('Strength');
    });
  });
});
