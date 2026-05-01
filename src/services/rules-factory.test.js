import { describe, it, expect, vi, beforeEach } from 'vitest';
import rulesFactory from './rules-factory';

// Mock the rules modules
vi.mock('./rules.js', () => ({
  default: {
    getAbilityLongName: vi.fn(),
    getAbilities: vi.fn(),
    getActions: vi.fn(),
    getArmorClass: vi.fn(),
    getAttacks: vi.fn(),
    getHitPoints: vi.fn(),
    getLanguages: vi.fn(),
    getMagicItems: vi.fn(),
    getProficiencyChoiceCount: vi.fn(),
    getProficiencies: vi.fn(),
    getSpellAbilities: vi.fn(),
    getSpellMaxLevel: vi.fn(),
    getPlayerStats: vi.fn()
    }
}));

vi.mock('./rules-2024.js', () => ({
  default: {
    getAbilityLongName: vi.fn(),
    getAbilities: vi.fn(),
    getActions: vi.fn(),
    getArmorClass: vi.fn(),
    getAttacks: vi.fn(),
    getHitPoints: vi.fn(),
    getLanguages: vi.fn(),
    getMagicItems: vi.fn(),
    getProficiencyChoiceCount: vi.fn(),
    getProficiencies: vi.fn(),
    getSpellAbilities: vi.fn(),
    getSpellMaxLevel: vi.fn(),
    getPlayerStats: vi.fn()
    }
}));

vi.mock('./race-rules.js', () => ({
  default: {
    getImmunities: vi.fn(),
    getRace: vi.fn(),
    getResistances: vi.fn(),
    getSenses: vi.fn()
    }
}));

vi.mock('./race-rules-2024.js', () => ({
  default: {
    getImmunities: vi.fn(),
    getRace: vi.fn(),
    getResistances: vi.fn(),
    getSenses: vi.fn()
    }
}));

vi.mock('./class-rules.js', () => ({
  default: {
    getClass: vi.fn(),
    getDruidMaxWildShapeChallengeRating: vi.fn(),
    getDruidWildShapeUses: vi.fn(),
    getDruidBeastKnownForms: vi.fn(),
    getDruidBeastFlySpeed: vi.fn(),
    getRogueSneakAttack: vi.fn(),
    getFeatures: vi.fn()
    }
}));

vi.mock('./class-rules-2024.js', () => ({
  default: {
    getClass: vi.fn(),
    getDruidMaxWildShapeChallengeRating: vi.fn(),
    getDruidWildShapeUses: vi.fn(),
    getDruidBeastKnownForms: vi.fn(),
    getDruidBeastFlySpeed: vi.fn(),
    getRogueSneakAttack: vi.fn(),
    getFeatures: vi.fn()
    }
}));

import * as rules5e from './rules.js';
import * as rules2024 from './rules-2024.js';
import * as raceRules5e from './race-rules.js';
import * as raceRules2024 from './race-rules-2024.js';
import * as classRules5e from './class-rules.js';
import * as classRules2024 from './class-rules-2024.js';

describe('rulesFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
     });

  describe('getRules', () => {
    it('should return 5e rules by default', () => {
      const playerSummary = {};
      const rules = rulesFactory.getRules(playerSummary);

      expect(rules.rules).toBe(rules5e.default);
      expect(rules.raceRules).toBe(raceRules5e.default);
      expect(rules.classRules).toBe(classRules5e.default);
      });

    it('should return 5e rules when rules is 5e', () => {
      const playerSummary = { rules: '5e' };
      const rules = rulesFactory.getRules(playerSummary);

      expect(rules.rules).toBe(rules5e.default);
      expect(rules.raceRules).toBe(raceRules5e.default);
      expect(rules.classRules).toBe(classRules5e.default);
      });

    it('should return 2024 rules when rules is 2024', () => {
      const playerSummary = { rules: '2024' };
      const rules = rulesFactory.getRules(playerSummary);

      expect(rules.rules).toBe(rules2024.default);
      expect(rules.raceRules).toBe(raceRules2024.default);
      expect(rules.classRules).toBe(classRules2024.default);
      });
   });

  describe('getAbilityLongName', () => {
    it('should delegate to rules.getAbilityLongName', () => {
      rules5e.default.getAbilityLongName.mockReturnValue('Strength');
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getAbilityLongName('STR', playerSummary);

      expect(result).toBe('Strength');
      expect(rules5e.default.getAbilityLongName).toHaveBeenCalledWith('STR');
      });
   });

  describe('getAbilities', () => {
    it('should delegate to rules.getAbilities', async () => {
      const mockAbilities = [{ name: 'Strength', score: 15 }];
      rules5e.default.getAbilities.mockResolvedValue(mockAbilities);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = await rulesFactory.getAbilities(playerStats, playerSummary);

      expect(result).toBe(mockAbilities);
      expect(rules5e.default.getAbilities).toHaveBeenCalledWith(playerStats);
      });
   });

  describe('getActions', () => {
    it('should delegate to rules.getActions', () => {
      const mockActions = ['Attack', 'Dash'];
      rules5e.default.getActions.mockReturnValue(mockActions);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getActions(playerStats, playerSummary);

      expect(result).toBe(mockActions);
      expect(rules5e.default.getActions).toHaveBeenCalledWith(playerStats);
      });
   });

  describe('getHitPoints', () => {
    it('should delegate to rules.getHitPoints', () => {
      rules5e.default.getHitPoints.mockReturnValue(20);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getHitPoints(playerStats, playerSummary);

      expect(result).toBe(20);
      expect(rules5e.default.getHitPoints).toHaveBeenCalledWith(playerStats);
      });
   });

  describe('getLanguages', () => {
    it('should delegate to rules.getLanguages', () => {
      const mockLanguages = ['Common', 'Elvish'];
      rules5e.default.getLanguages.mockReturnValue(mockLanguages);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getLanguages(playerStats, playerSummary);

      expect(result).toBe(mockLanguages);
      expect(rules5e.default.getLanguages).toHaveBeenCalledWith(playerStats);
      });
   });

  describe('getMagicItems', () => {
    it('should delegate to rules.getMagicItems', () => {
      const mockMagicItems = [{ name: 'Ring of Protection' }];
      rules5e.default.getMagicItems.mockReturnValue(mockMagicItems);
      const allMagicItems = [];
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getMagicItems(allMagicItems, playerSummary);

      expect(result).toBe(mockMagicItems);
      expect(rules5e.default.getMagicItems).toHaveBeenCalledWith(allMagicItems, playerSummary);
      });
   });

  describe('getProficiencyChoiceCount', () => {
    it('should delegate to rules.getProficiencyChoiceCount', () => {
      rules5e.default.getProficiencyChoiceCount.mockReturnValue(4);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getProficiencyChoiceCount(playerStats, true, playerSummary);

      expect(result).toBe(4);
      expect(rules5e.default.getProficiencyChoiceCount).toHaveBeenCalledWith(playerStats, true);
      });
   });

  describe('getProficiencies', () => {
    it('should delegate to rules.getProficiencies', () => {
      const mockProficiencies = ['Light Armor', 'Simple Weapons'];
      rules5e.default.getProficiencies.mockReturnValue(mockProficiencies);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getProficiencies(playerStats, true, playerSummary);

      expect(result).toBe(mockProficiencies);
      expect(rules5e.default.getProficiencies).toHaveBeenCalledWith(playerStats, true);
      });
   });

  describe('getSpellMaxLevel', () => {
    it('should delegate to rules.getSpellMaxLevel', () => {
      rules5e.default.getSpellMaxLevel.mockReturnValue(3);
      const spellAbilities = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getSpellMaxLevel(spellAbilities, playerSummary);

      expect(result).toBe(3);
      expect(rules5e.default.getSpellMaxLevel).toHaveBeenCalledWith(spellAbilities);
      });
   });

  describe('getDruidMaxWildShapeChallengeRating', () => {
    it('should delegate to classRules.getDruidMaxWildShapeChallengeRating', () => {
      classRules5e.default.getDruidMaxWildShapeChallengeRating.mockReturnValue(1);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getDruidMaxWildShapeChallengeRating(playerStats, playerSummary);

      expect(result).toBe(1);
      expect(classRules5e.default.getDruidMaxWildShapeChallengeRating).toHaveBeenCalledWith(playerStats);
      });
   });

  describe('getDruidWildShapeUses', () => {
    it('should delegate to classRules.getDruidWildShapeUses', () => {
      classRules5e.default.getDruidWildShapeUses.mockReturnValue(2);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getDruidWildShapeUses(playerStats, playerSummary);

      expect(result).toBe(2);
      expect(classRules5e.default.getDruidWildShapeUses).toHaveBeenCalledWith(playerStats);
      });
   });

  describe('getDruidBeastKnownForms', () => {
    it('should delegate to classRules.getDruidBeastKnownForms', () => {
      classRules5e.default.getDruidBeastKnownForms.mockReturnValue(4);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getDruidBeastKnownForms(playerStats, playerSummary);

      expect(result).toBe(4);
      expect(classRules5e.default.getDruidBeastKnownForms).toHaveBeenCalledWith(playerStats);
      });
   });

  describe('getDruidBeastFlySpeed', () => {
    it('should delegate to classRules.getDruidBeastFlySpeed', () => {
      classRules5e.default.getDruidBeastFlySpeed.mockReturnValue(0);
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getDruidBeastFlySpeed(playerStats, playerSummary);

      expect(result).toBe(0);
      expect(classRules5e.default.getDruidBeastFlySpeed).toHaveBeenCalledWith(playerStats);
      });
   });

  describe('getRogueSneakAttack', () => {
    it('should delegate to classRules.getRogueSneakAttack', () => {
      classRules5e.default.getRogueSneakAttack.mockReturnValue({ dice_count: 1, dice_value: 6 });
      const playerStats = {};
      const playerSummary = { name: 'Test Character' };

      const result = rulesFactory.getRogueSneakAttack(playerStats, playerSummary);

      expect(result).toEqual({ dice_count: 1, dice_value: 6 });
      expect(classRules5e.default.getRogueSneakAttack).toHaveBeenCalledWith(playerStats);
      });
   });

  describe('getPlayerStats', () => {
    it('should gather all player stats', async () => {
      const mockPlayerStats = {};
      rules5e.default.getPlayerStats.mockResolvedValue(mockPlayerStats);
      raceRules5e.default.getImmunities.mockReturnValue([]);
      raceRules5e.default.getRace.mockReturnValue({ name: 'Human' });
      raceRules5e.default.getResistances.mockReturnValue([]);
      raceRules5e.default.getSenses.mockReturnValue(['Darkvision']);
      classRules5e.default.getClass.mockReturnValue({ name: 'Fighter' });

      const allClasses = [];
      const allEquipment = [];
      const allMagicItems = [];
      const allRaces = [];
      const allSpells = [];
      const playerSummary = { name: 'Test Character' };

      const result = await rulesFactory.getPlayerStats(
        allClasses,
        allEquipment,
        allMagicItems,
        allRaces,
        allSpells,
        playerSummary
        );

      expect(result.immunities).toEqual([]);
      expect(result.race).toEqual({ name: 'Human' });
      expect(result.resistances).toEqual([]);
      expect(result.senses).toEqual(['Darkvision']);
      expect(result.class).toEqual({ name: 'Fighter' });
      });
   });
});
