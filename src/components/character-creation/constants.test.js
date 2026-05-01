import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as constants from './constants';

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

  describe('loadAbilityNames', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return ability names from fetched JSON', async () => {
      const mockResponse = {
        ok: true,
        json: async () => [
          { full_name: 'Strength' },
          { full_name: 'Dexterity' },
          { full_name: 'Constitution' },
          { full_name: 'Intelligence' },
          { full_name: 'Wisdom' },
          { full_name: 'Charisma' }
        ]
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const abilityNames = await constants.loadAbilityNames();
      expect(abilityNames).toEqual([
        'Strength',
        'Dexterity',
        'Constitution',
        'Intelligence',
        'Wisdom',
        'Charisma'
      ]);
      expect(global.fetch).toHaveBeenCalledWith('/data/ability-scores.json');
    });

    it('should return fallback ability names when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      console.error = vi.fn();

      const abilityNames = await constants.loadAbilityNames();
      expect(abilityNames).toEqual([
        'Strength',
        'Dexterity',
        'Constitution',
        'Intelligence',
        'Wisdom',
        'Charisma'
      ]);
    });

    it('should return fallback ability names when response is not ok', async () => {
      const mockResponse = { ok: false };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);
      console.error = vi.fn();

      const abilityNames = await constants.loadAbilityNames();
      expect(abilityNames).toEqual([
        'Strength',
        'Dexterity',
        'Constitution',
        'Intelligence',
        'Wisdom',
        'Charisma'
      ]);
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
