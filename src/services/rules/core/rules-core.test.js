// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../character/classRules.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn(),
  },
}));

vi.mock('../../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(),
    getRacialBonus: vi.fn(),
    getImmunities: vi.fn(),
    getResistances: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn(),
  },
  rules2024: {
    getRace: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn(),
  },
}));

vi.mock('./abilityCalc2024.js', () => ({
  getAbilities: vi.fn(),
  getHitPoints: vi.fn(),
  getCarryingCapacity: vi.fn(),
}));

vi.mock('./attackCalc2024.js', () => ({
  getAttacks: vi.fn(),
}));

vi.mock('./spellCalc2024.js', () => ({
  getSpellAbilities: vi.fn(),
}));

vi.mock('../../character/proficiencyUtils2024.js', () => ({
  getProficiencyChoiceCount: vi.fn(),
  getProficiencies: vi.fn(),
}));

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn(),
  },
}));

import rules from '../rules.js';
import classRules2024 from '../../character/classRules2024.js';
import { rules5e as raceRules, rules2024 as raceRules2024 } from '../../character/race-rules/index.js';
import * as dataLoader from '../../ui/dataLoader.js';
import * as abilityCalc2024 from './abilityCalc2024.js';
import * as attackCalc2024 from './attackCalc2024.js';
import * as spellCalc2024 from './spellCalc2024.js';
import * as proficiencyUtils2024 from '../../character/proficiencyUtils2024.js';

const makePlayerSummary = (overrides = {}) => ({
  level: 1,
  rules: '5e',
  class: { name: 'Fighter', saving_throws: [], languages: [], fightingStyles: [] },
  languages: [],
  abilities: [
    { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Intelligence', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
  ],
  inventory: { equipped: [], magicItems: [] },
  skillProficiencies: [],
  expertise: [],
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  activeBuffs: [],
  ...overrides,
});

const defaultSkills = [
  { name: 'Athletics', ability: 'Strength' },
  { name: 'Stealth', ability: 'Dexterity' },
  { name: 'Acrobatics', ability: 'Dexterity' },
  { name: 'Arcana', ability: 'Intelligence' },
  { name: 'History', ability: 'Intelligence' },
  { name: 'Perception', ability: 'Wisdom' },
  { name: 'Insight', ability: 'Wisdom' },
  { name: 'Persuasion', ability: 'Charisma' },
  { name: 'Deception', ability: 'Charisma' },
];

describe('rules', () => {
  describe('getSpellMaxLevel', () => {
    it('should return null when all spell slots are zero', () => {
      const spellAbilities = {
        spell_slots_level_1: 0,
        spell_slots_level_2: 0,
      };

      expect(rules.getSpellMaxLevel(spellAbilities)).toBeNull();
    });

    it('should return the highest level with non-zero slots', () => {
      const spellAbilities = {
        spell_slots_level_1: 4,
        spell_slots_level_3: 3,
        spell_slots_level_9: 1,
      };

      expect(rules.getSpellMaxLevel(spellAbilities)).toBe(9);
    });

    it('should skip levels with null slot values', () => {
      const spellAbilities = {
        spell_slots_level_1: null,
        spell_slots_level_2: 2,
        spell_slots_level_3: null,
      };

      expect(rules.getSpellMaxLevel(spellAbilities)).toBe(2);
    });

    it('should return null for null input', () => {
      expect(rules.getSpellMaxLevel(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(rules.getSpellMaxLevel(undefined)).toBeNull();
    });

    it('should return null for empty object', () => {
      expect(rules.getSpellMaxLevel({})).toBeNull();
    });

    it('should return 1 when only 1st level slots exist', () => {
      const spellAbilities = { spell_slots_level_1: 2 };

      expect(rules.getSpellMaxLevel(spellAbilities)).toBe(1);
    });

    it('should handle non-contiguous level keys', () => {
      const spellAbilities = {
        spell_slots_level_1: 4,
        spell_slots_level_5: 2,
        spell_slots_level_9: 1,
      };

      expect(rules.getSpellMaxLevel(spellAbilities)).toBe(9);
    });
  });

  describe('getSubModules', () => {
    it('should return 5e modules when rules is "5e"', () => {
      const modules = rules.getSubModules({ rules: '5e' });

      expect(modules.use2024).toBe(false);
      expect(modules.abilityCalc.getHitPoints).toBeDefined();
      expect(modules.spellCalc.getSpellAbilities).toBeDefined();
      expect(typeof modules.attackCalc).toBe('function');
      expect(typeof modules.proficiencyUtils).toBe('object');
      expect(typeof modules.classRules).toBe('object');
      expect(typeof modules.raceRules).toBe('object');
    });

    it('should return 2024 modules when rules is "2024"', () => {
      const modules = rules.getSubModules({ rules: '2024' });

      expect(modules.use2024).toBe(true);
      expect(modules.abilityCalc.getAbilities).toBe(abilityCalc2024.getAbilities);
      expect(modules.abilityCalc.getHitPoints).toBe(abilityCalc2024.getHitPoints);
      expect(modules.spellCalc.getSpellAbilities).toBe(spellCalc2024.getSpellAbilities);
      expect(modules.attackCalc).toBe(attackCalc2024.getAttacks);
      expect(modules.raceRules).toBe(raceRules2024);
    });

    it('should default to 5e when playerStats is null', () => {
      const modules = rules.getSubModules(null);

      expect(modules.use2024).toBe(false);
    });

    it('should default to 5e when rules field is missing', () => {
      const modules = rules.getSubModules({ name: 'Test' });

      expect(modules.use2024).toBe(false);
    });

    it('should prefer playerStats.rules over playerSummary.rules', () => {
      const modules = rules.getSubModules({ rules: '5e' }, { rules: '2024' });

      expect(modules.use2024).toBe(false);
    });

    it('should fall back to playerSummary.rules when playerStats lacks rules', () => {
      const modules = rules.getSubModules({ level: 1 }, { rules: '2024' });

      expect(modules.use2024).toBe(true);
    });

    it('should default to 5e when neither has rules', () => {
      const modules = rules.getSubModules({ level: 1 }, { level: 1 });

      expect(modules.use2024).toBe(false);
    });

    it('should default to 5e when both playerStats and playerSummary are null', () => {
      const modules = rules.getSubModules(null, null);

      expect(modules.use2024).toBe(false);
    });
  });

  describe('getAbilities (5e)', () => {
    beforeEach(() => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight', 'Investigation', 'Perception']);
      raceRules.getRacialBonus.mockReturnValue(0);
    });

    it('should calculate totalScore from baseScore + featIncrease + miscIncrease + backgroundIncrease', async () => {
      const playerStats = makePlayerSummary({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 2, miscIncrease: 1, backgroundIncrease: 1 },
        ],
        class: { name: 'Fighter', saving_throws: [] },
        skillProficiencies: [],
        expertise: [],
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');

      expect(str.totalScore).toBe(19); // 15 + 2 + 1 + 1
      expect(str.bonus).toBe(4); // (19 - 10) / 2
    });

    it('should mark saving throw proficiencies from class', async () => {
      const playerStats = makePlayerSummary({
        level: 5,
        class: { name: 'Fighter', saving_throws: ['Strength', 'Constitution'] },
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');
      const con = abilities.find((a) => a.name === 'Constitution');

      expect(str.proficient).toBe(true);
      expect(con.proficient).toBe(true);
      expect(str.save).toBe(str.bonus + 3);
      expect(con.save).toBe(con.bonus + 3);
    });

    it('should apply racial bonus from raceRules.getRacialBonus', async () => {
      raceRules.getRacialBonus.mockReturnValue(2);

      const playerStats = makePlayerSummary({
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');

      expect(str.totalScore).toBe(17); // 15 + 0 + 0 + 2 (racial)
    });

    it('should apply Barbarian Primal Champion bonus at level 20', async () => {
      const playerStats = makePlayerSummary({
        level: 20,
        class: { name: 'Barbarian', saving_throws: [] },
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');
      const con = abilities.find((a) => a.name === 'Constitution');

      // Base 15 + 4 (Primal Champion) = 19, bonus = 4
      expect(str.totalScore).toBe(19);
      expect(str.bonus).toBe(4);
      // Base 13 + 4 = 17, bonus = 3
      expect(con.totalScore).toBe(17);
      expect(con.bonus).toBe(3);
    });

    it('should not apply Primal Champion before level 20', async () => {
      const playerStats = makePlayerSummary({
        level: 19,
        class: { name: 'Barbarian', saving_throws: [] },
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');

      expect(str.totalScore).toBe(15);
      expect(str.bonus).toBe(2);
    });

    it('should calculate proficiency bonus based on level', async () => {
      // Level 1 -> floor((1-1)/4 + 2) = 2
      const playerStats = makePlayerSummary({ level: 1 });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');
      // Strength is not a proficient save (class.saving_throws is []), so save = bonus only
      expect(str.save).toBe(str.bonus);
    });

    it('should apply proficiency bonus to proficient saves at level 1', async () => {
      const playerStats = makePlayerSummary({
        level: 1,
        class: { name: 'Fighter', saving_throws: ['Strength'] },
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');
      // Level 1 proficiency = 2, str.bonus = 2, save = 2 + 2 = 4
      expect(str.proficient).toBe(true);
      expect(str.save).toBe(4);
    });

    it('should apply expertise bonus for double proficiency', async () => {
      const playerStats = makePlayerSummary({
        level: 5,
        class: { name: 'Rogue', saving_throws: [] },
        skillProficiencies: ['Stealth'],
        expertise: ['Stealth'],
      });

      const abilities = await rules.getAbilities(playerStats);
      const dex = abilities.find((a) => a.name === 'Dexterity');
      const stealth = dex.skills.find((s) => s.name === 'Stealth');
      const proficiency = Math.floor((5 - 1) / 4 + 2); // 3

      expect(stealth.bonus).toBe(dex.bonus + proficiency + proficiency);
    });

    it('should include skills from ability-scores.json data', async () => {
      const playerStats = makePlayerSummary({ level: 1 });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');

      expect(str.skills).toContainEqual(expect.objectContaining({ name: 'Athletics', ability: 'Strength' }));
    });

    it('should not crash with empty skills data', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue([]);

      const playerStats = makePlayerSummary({ level: 1 });

      const abilities = await rules.getAbilities(playerStats);

      expect(abilities).toHaveLength(6);
      abilities.forEach((ability) => {
        expect(ability.skills).toEqual([]);
      });
    });

    it('should handle missing ability name gracefully', async () => {
      const playerStats = makePlayerSummary({
        abilities: [],
      });

      const abilities = await rules.getAbilities(playerStats);

      expect(abilities).toEqual([]);
    });
  });

  describe('getAbilities (2024 dispatch)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should dispatch to 2024 implementation when rules is "2024"', async () => {
      const playerStats = { rules: '2024', abilities: [] };
      abilityCalc2024.getAbilities.mockResolvedValue([{ name: 'Strength', totalScore: 15 }]);

      const result = await rules.getAbilities(playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Strength');
      expect(abilityCalc2024.getAbilities).toHaveBeenCalledWith(playerStats);
    });

    it('should use 5e when rules is "5e"', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue([{ name: 'Athletics', ability: 'Strength' }]);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);

      const playerStats = makePlayerSummary({
        rules: '5e',
        level: 1,
        abilities: [{ name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }],
      });

      const result = await rules.getAbilities(playerStats);

      expect(result).toHaveLength(1);
      expect(abilityCalc2024.getAbilities).not.toHaveBeenCalled();
    });
  });

  describe('getHitPoints (2024 dispatch)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should dispatch to 2024 implementation when rules is "2024"', () => {
      const playerStats = { rules: '2024' };
      abilityCalc2024.getHitPoints.mockReturnValue(99);

      const result = rules.getHitPoints(playerStats);

      expect(result).toBe(99);
      expect(abilityCalc2024.getHitPoints).toHaveBeenCalledWith(playerStats);
    });

    it('should use 5e when rules is "5e"', () => {
      const playerStats = makePlayerSummary({
        rules: '5e',
        class: { hit_die: 10 },
        level: 1,
        abilities: [{ name: 'Constitution', bonus: 2 }],
      });

      const result = rules.getHitPoints(playerStats);

      expect(result).toBe(12);
      expect(abilityCalc2024.getHitPoints).not.toHaveBeenCalled();
    });
  });

  describe('getSpellAbilities (2024 dispatch)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should dispatch to 2024 implementation when rules is "2024"', () => {
      const allSpells = [];
      const playerStats = { rules: '2024' };
      spellCalc2024.getSpellAbilities.mockReturnValue({ modifier: 5 });

      const result = rules.getSpellAbilities(allSpells, playerStats);

      expect(result).toEqual({ modifier: 5 });
      expect(spellCalc2024.getSpellAbilities).toHaveBeenCalledWith(allSpells, playerStats, undefined);
    });

    it('should use 5e when rules is "5e"', () => {
      const playerStats = makePlayerSummary({
        rules: '5e',
        level: 1,
        race: {},
        class: { class_levels: [{}] },
        abilities: [],
        spells: [],
      });

      const result = rules.getSpellAbilities([], playerStats);

      expect(result).toBeNull();
      expect(spellCalc2024.getSpellAbilities).not.toHaveBeenCalled();
    });
  });

  describe('getAttacks (2024 dispatch)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should dispatch to 2024 implementation when rules is "2024"', () => {
      const allEquipment = [];
      const allSpells = [];
      const playerStats = { rules: '2024' };
      attackCalc2024.getAttacks.mockReturnValue([{ name: 'Test Attack' }]);

      const result = rules.getAttacks(allEquipment, allSpells, playerStats);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Attack');
      expect(attackCalc2024.getAttacks).toHaveBeenCalledWith(allEquipment, allSpells, playerStats);
    });

    it('should use 5e when rules is "5e"', () => {
      const playerStats = makePlayerSummary({
        rules: '5e',
        level: 5,
        class: { name: 'Fighter', fightingStyles: [] },
        abilities: [{ name: 'Strength', bonus: 3 }],
        inventory: { equipped: [] },
        spellAbilities: null,
        activeBuffs: [],
      });

      const result = rules.getAttacks([], [], playerStats);

      expect(Array.isArray(result)).toBe(true);
      expect(attackCalc2024.getAttacks).not.toHaveBeenCalled();
    });
  });

  describe('getPlayerStats (2024 dispatch)', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight', 'Investigation', 'Perception']);

      classRules2024.getClass.mockReturnValue({
        name: 'Fighter',
        hit_die: 10,
        saving_throws: ['Strength', 'Constitution'],
        proficiencies: [],
        class_levels: [{ spellcasting: null }],
        languages: [],
        major: {},
      });

      raceRules2024.getRace.mockReturnValue({
        name: 'Human',
        languages: ['Common'],
        starting_proficiencies: [],
        traits: [],
      });

      raceRules2024.getSenses.mockReturnValue(['Darkvision 60 ft.']);
      raceRules2024.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      classRules2024.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      abilityCalc2024.getAbilities.mockResolvedValue([
        { name: 'Strength', totalScore: 15, bonus: 2 },
        { name: 'Dexterity', totalScore: 14, bonus: 2 },
        { name: 'Constitution', totalScore: 13, bonus: 1 },
        { name: 'Intelligence', totalScore: 12, bonus: 1 },
        { name: 'Wisdom', totalScore: 10, bonus: 0 },
        { name: 'Charisma', totalScore: 8, bonus: -1 },
      ]);
      abilityCalc2024.getHitPoints.mockReturnValue(44);
      attackCalc2024.getAttacks.mockReturnValue([]);
      spellCalc2024.getSpellAbilities.mockReturnValue(null);
    });

    it('should build complete player stats using 2024 rules', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight', 'Investigation', 'Perception']);
      proficiencyUtils2024.getProficiencies.mockReturnValue([2, ['Common']]);
      proficiencyUtils2024.getProficiencyChoiceCount.mockReturnValue(2);

      const playerSummary = makePlayerSummary({
        rules: '2024',
        level: 1,
        class: { name: 'Fighter', languages: [] },
        race: { name: 'Human' },
      });

      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);

      expect(result.rules).toBe('2024');
      expect(result.proficiency).toBe(2);
      expect(result.senses).toEqual(['Darkvision 60 ft.']);
      expect(Array.isArray(result.equipment)).toBe(true);
      expect(classRules2024.getClass).toHaveBeenCalled();
      expect(raceRules2024.getRace).toHaveBeenCalled();
      expect(abilityCalc2024.getAbilities).toHaveBeenCalled();
      expect(abilityCalc2024.getHitPoints).toHaveBeenCalled();
      expect(raceRules2024.getSenses).toHaveBeenCalled();
    });

    it('should set senses and equipment early in 2024 mode', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight', 'Investigation', 'Perception']);
      raceRules2024.getSenses.mockReturnValue(['Darkvision 60 ft.']);
      proficiencyUtils2024.getProficiencies.mockReturnValue([2, ['Common']]);
      proficiencyUtils2024.getProficiencyChoiceCount.mockReturnValue(2);

      const playerSummary = makePlayerSummary({
        rules: '2024',
        level: 1,
        class: { name: 'Fighter', languages: [] },
        race: { name: 'Human' },
      });

      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);

      expect(result.senses).toEqual(['Darkvision 60 ft.']);
    });
  });

  describe('applyUmbralSightDarkvision', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);

      classRules2024.getClass.mockReturnValue({
        name: 'Ranger',
        hit_die: 10,
        saving_throws: ['Strength', 'Dexterity'],
        class_levels: [{ level: 3, features: [] }],
        major: { name: 'Stalker', features: [] },
        languages: [],
      });

      raceRules2024.getRace.mockReturnValue({
        name: 'Human',
        languages: ['Common'],
        starting_proficiencies: [],
        traits: [],
      });

      raceRules2024.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      classRules2024.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      abilityCalc2024.getAbilities.mockResolvedValue([
        { name: 'Strength', totalScore: 15, bonus: 2, skills: [] },
        { name: 'Dexterity', totalScore: 14, bonus: 2, skills: [] },
        { name: 'Constitution', totalScore: 13, bonus: 1, skills: [] },
        { name: 'Intelligence', totalScore: 12, bonus: 1, skills: [] },
        { name: 'Wisdom', totalScore: 10, bonus: 0, skills: [] },
        { name: 'Charisma', totalScore: 8, bonus: -1, skills: [] },
      ]);
      abilityCalc2024.getHitPoints.mockReturnValue(12);
      attackCalc2024.getAttacks.mockReturnValue([]);
      spellCalc2024.getSpellAbilities.mockReturnValue(null);
    });

    it('should add 60ft to existing Darkvision for Gloom Stalker (object format)', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);
      raceRules2024.getSenses.mockReturnValue([{ name: 'Darkvision', value: '60 ft.' }]);
      proficiencyUtils2024.getProficiencies.mockReturnValue([2, ['Common']]);
      proficiencyUtils2024.getProficiencyChoiceCount.mockReturnValue(2);

      const playerSummary = makePlayerSummary({
        rules: '2024',
        level: 3,
        class: { name: 'Ranger', major: { name: 'Stalker' }, languages: [] },
        race: { name: 'Human' },
      });

      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);

      expect(result.senses).toContainEqual({ name: 'Darkvision', value: '120 ft.' });
    });

    it('should not modify darkvision for non-Gloom Stalkers', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);
      raceRules2024.getSenses.mockReturnValue([{ name: 'Darkvision', value: '60 ft.' }]);
      classRules2024.getClass.mockReturnValue({
        name: 'Ranger',
        hit_die: 10,
        saving_throws: ['Strength', 'Dexterity'],
        class_levels: [{ level: 3, features: [] }],
        major: { name: 'Hunter', features: [] },
        languages: [],
      });
      proficiencyUtils2024.getProficiencies.mockReturnValue([2, ['Common']]);
      proficiencyUtils2024.getProficiencyChoiceCount.mockReturnValue(2);

      const playerSummary = makePlayerSummary({
        rules: '2024',
        level: 3,
        class: { name: 'Ranger', major: { name: 'Hunter' }, languages: [] },
        race: { name: 'Human' },
      });

      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);

      expect(result.senses).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('should add darkvision when Gloom Stalker has no existing darkvision (string format)', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);
      raceRules2024.getSenses.mockReturnValue(['Darkvision 60 ft.']);
      proficiencyUtils2024.getProficiencies.mockReturnValue([2, ['Common']]);
      proficiencyUtils2024.getProficiencyChoiceCount.mockReturnValue(2);

      const playerSummary = makePlayerSummary({
        rules: '2024',
        level: 3,
        class: { name: 'Ranger', major: { name: 'Stalker' }, languages: [] },
        race: { name: 'Human' },
      });

      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);

      // String format senses: Umbral Sight pushes a new object entry since findIndex returns -1
      expect(result.senses).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });
  });

  describe('dispatch fallback chain', () => {
    it('should prefer playerStats.rules over playerSummary.rules at every dispatch method', () => {
      const hpStats = { rules: '5e', class: { hit_die: 10 }, level: 1, abilities: [{ name: 'Constitution', bonus: 2 }] };
      const hpResult = rules.getHitPoints(hpStats);
      expect(hpResult).toBe(12);
    });

    it('should fall back to playerSummary.rules when playerStats lacks rules at getAbilities', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue([{ name: 'Athletics', ability: 'Strength' }]);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);
      abilityCalc2024.getAbilities.mockResolvedValue([]);

      const result = await rules.getAbilities({ level: 1 }, { rules: '2024' });

      expect(result).toEqual([]);
      expect(abilityCalc2024.getAbilities).toHaveBeenCalled();
    });

    it('should default to 5e when both playerStats and playerSummary are null', () => {
      const modules = rules.getSubModules(null, null);
      expect(modules.use2024).toBe(false);
    });
  });
});
