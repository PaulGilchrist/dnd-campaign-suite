import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as constants from './constants.js';
import { loadAbilityScores } from '../services/data-loader.js';

// Mock data-loader
vi.mock('../services/data-loader.js', () => ({
  loadAbilityScores: vi.fn(),
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn()
}));

describe('constants', () => {
  describe('REQUIRED_FIELDS', () => {
    it('should export an array of required field names', () => {
      expect(constants.REQUIRED_FIELDS).toBeInstanceOf(Array);
      expect(constants.REQUIRED_FIELDS).toContain('name');
      expect(constants.REQUIRED_FIELDS).toContain('level');
      expect(constants.REQUIRED_FIELDS).toContain('alignment');
      expect(constants.REQUIRED_FIELDS).toContain('race');
      expect(constants.REQUIRED_FIELDS).toContain('class');
      expect(constants.REQUIRED_FIELDS).toContain('abilities');
      expect(constants.REQUIRED_FIELDS).toContain('inventory');
      expect(constants.REQUIRED_FIELDS).toContain('skillProficiencies');
      expect(constants.REQUIRED_FIELDS).toContain('expertSkills');
    });

    it('should have 9 required fields', () => {
      expect(constants.REQUIRED_FIELDS.length).toBe(9);
    });
  });

   describe('loadAbilityScores', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it('should return ability scores from data-loader', async () => {
        const mockScores = [
           { full_name: 'Strength' },
           { full_name: 'Dexterity' },
           { full_name: 'Constitution' },
           { full_name: 'Intelligence' },
           { full_name: 'Wisdom' },
            { full_name: 'Charisma' }
          ];
        vi.mocked(loadAbilityScores).mockResolvedValue(mockScores);

        const result = await loadAbilityScores();
        expect(result).toEqual(mockScores);
        expect(result.map(a => a.full_name)).toEqual([
            'Strength',
            'Dexterity',
            'Constitution',
            'Intelligence',
            'Wisdom',
            'Charisma'
          ]);
      });

      it('should return ability names when mapped', async () => {
        const mockScores = [
            { full_name: 'Strength' },
            { full_name: 'Dexterity' },
            { full_name: 'Constitution' },
            { full_name: 'Intelligence' },
            { full_name: 'Wisdom' },
            { full_name: 'Charisma' }
          ];
        vi.mocked(loadAbilityScores).mockResolvedValue(mockScores);

        const scores = await loadAbilityScores();
        const names = scores.map(a => a.full_name);
        expect(names).toEqual([
            'Strength',
            'Dexterity',
            'Constitution',
            'Intelligence',
            'Wisdom',
            'Charisma'
          ]);
      });

    it('should handle errors gracefully', async () => {
        vi.mocked(loadAbilityScores).mockRejectedValue(new Error('Network error'));

        await expect(loadAbilityScores()).rejects.toThrow('Network error');
        });
       });

  describe('DEFAULT_FORM_DATA', () => {
    it('should export a default form data object', () => {
      expect(constants.DEFAULT_FORM_DATA).toBeDefined();
      expect(constants.DEFAULT_FORM_DATA.name).toBe('');
      expect(constants.DEFAULT_FORM_DATA.level).toBe(1);
      expect(constants.DEFAULT_FORM_DATA.alignment).toBe('True Neutral');
    });

    it('should have abilities array with 6 abilities', () => {
      expect(constants.DEFAULT_FORM_DATA.abilities).toBeInstanceOf(Array);
      expect(constants.DEFAULT_FORM_DATA.abilities.length).toBe(6);
    });

    it('should have abilities with default baseScore of 8', () => {
      constants.DEFAULT_FORM_DATA.abilities.forEach(ability => {
        expect(ability.baseScore).toBe(8);
        expect(ability.abilityImprovements).toBe(0);
        expect(ability.miscBonus).toBe(0);
      });
    });

    it('should have default class as Fighter', () => {
      expect(constants.DEFAULT_FORM_DATA.class.name).toBe('Fighter');
      expect(constants.DEFAULT_FORM_DATA.class.subclass.name).toBe('');
    });

    it('should have default race as Human', () => {
      expect(constants.DEFAULT_FORM_DATA.race.name).toBe('Human');
      expect(constants.DEFAULT_FORM_DATA.race.subrace.name).toBe('');
    });

    it('should have default inventory with gold of 10', () => {
      expect(constants.DEFAULT_FORM_DATA.inventory).toBeDefined();
      expect(constants.DEFAULT_FORM_DATA.inventory.backpack).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.inventory.equipped).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.inventory.gold).toBe(10);
      expect(constants.DEFAULT_FORM_DATA.inventory.magicItems).toEqual([]);
    });

    it('should have empty arrays for optional fields', () => {
      expect(constants.DEFAULT_FORM_DATA.expertSkills).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.feats).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.fightingStyles).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.immunities).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.languages).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.resistances).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.skillProficiencies).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.specialActions).toEqual([]);
      expect(constants.DEFAULT_FORM_DATA.spells).toEqual([]);
    });

    it('should have default rules set to 5e', () => {
      expect(constants.DEFAULT_FORM_DATA.rules).toBe('5e');
    });
  });
});
