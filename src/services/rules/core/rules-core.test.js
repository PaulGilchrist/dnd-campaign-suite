import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([])
}));

vi.mock('../../ui/utils.js', () => ({
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

vi.mock('../../character/classRules.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn()
  }
}));

vi.mock('../../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(),
    getRacialBonus: vi.fn(),
    getImmunities: vi.fn(),
    getResistances: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn()
  },
  rules2024: {
    getRace: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn()
  }
}));

vi.mock('./abilityCalc2024.js', () => ({
  getAbilities: vi.fn(),
  getHitPoints: vi.fn(),
  getCarryingCapacity: vi.fn()
}));

vi.mock('./attackCalc2024.js', () => ({
  getAttacks: vi.fn()
}));

vi.mock('./spellCalc2024.js', () => ({
  getSpellAbilities: vi.fn()
}));

vi.mock('../../character/proficiencyUtils2024.js', () => ({
  getProficiencyChoiceCount: vi.fn(),
  getProficiencies: vi.fn()
}));

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn()
  }
}));

import rules from '../rules.js';
import classRules from '../../character/classRules.js';
import { rules5e as raceRules, rules2024 as raceRules2024 } from '../../character/race-rules/index.js';
import * as dataLoader from '../../ui/dataLoader.js';
import * as abilityCalc2024 from './abilityCalc2024.js';
import * as attackCalc2024 from './attackCalc2024.js';
import * as spellCalc2024 from './spellCalc2024.js';
import * as proficiencyUtils2024 from '../../character/proficiencyUtils2024.js';
import classRules2024 from '../../character/classRules2024.js';

describe('rules', () => {
  describe('getSpellMaxLevel', () => {
    it('should return null when no spell slots', () => {
      const spellAbilities = {
        spell_slots_level_1: 0,
        spell_slots_level_2: 0
      };

      const result = rules.getSpellMaxLevel(spellAbilities);

      expect(result).toBeNull();
    });

    it('should return max spell slot level', () => {
      const spellAbilities = {
        spell_slots_level_1: 4,
        spell_slots_level_2: 3,
        spell_slots_level_3: 3,
        spell_slots_level_4: 0
      };

      const result = rules.getSpellMaxLevel(spellAbilities);

      expect(result).toBe(3);
    });

    it('should return 9 when has 9th level slots', () => {
      const spellAbilities = {
        spell_slots_level_1: 4,
        spell_slots_level_9: 1
      };

      const result = rules.getSpellMaxLevel(spellAbilities);

      expect(result).toBe(9);
    });

    it('should handle null spellAbilities', () => {
      const result = rules.getSpellMaxLevel(null);

      expect(result).toBeNull();
    });

    it('should handle undefined spellAbilities', () => {
      const result = rules.getSpellMaxLevel(undefined);

      expect(result).toBeNull();
    });

    it('should return 1 when only has 1st level slots', () => {
      const spellAbilities = {
        spell_slots_level_1: 2
      };

      const result = rules.getSpellMaxLevel(spellAbilities);

      expect(result).toBe(1);
    });

    it('should ignore null spell slot values', () => {
      const spellAbilities = {
        spell_slots_level_1: null,
        spell_slots_level_2: 2
      };

      const result = rules.getSpellMaxLevel(spellAbilities);

      expect(result).toBe(2);
    });
  });

  describe('getAbilities', () => {
    beforeEach(() => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue([
        { name: 'Athletics', ability: 'Strength' },
        { name: 'Stealth', ability: 'Dexterity' },
        { name: 'Acrobatics', ability: 'Dexterity' },
        { name: 'Arcana', ability: 'Intelligence' },
        { name: 'History', ability: 'Intelligence' },
        { name: 'Perception', ability: 'Wisdom' },
        { name: 'Insight', ability: 'Wisdom' },
        { name: 'Persuasion', ability: 'Charisma' },
        { name: 'Deception', ability: 'Charisma' }
      ]);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight', 'Investigation', 'Perception']);

      raceRules.getRacialBonus.mockReturnValue(0);
    });

    it('should calculate abilities with correct totalScore and bonus', async () => {
      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 2, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        class: {
          name: 'Fighter',
          saving_throws: ['Strength', 'Constitution']
        },
        skillProficiencies: ['Athletics', 'Perception'],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);

      expect(abilities).toHaveLength(6);
      const str = abilities.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(17); // 15 + 2 + 0 + 0
      expect(str.bonus).toBe(3); // (17-10)/2
      expect(str.proficient).toBe(true);
      const proficiency = Math.floor((5 - 1) / 4 + 2); // 3
      expect(str.save).toBe(str.bonus + proficiency); // 3 + 3 = 6
    });

    it('should apply racial bonus from raceRules.getRacialBonus', async () => {
      raceRules.getRacialBonus.mockReturnValue(2);

      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        class: {
          name: 'Fighter',
          saving_throws: []
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);

      const str = abilities.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(17); // 15 + 0 + 0 + 2 (racial)
      expect(raceRules.getRacialBonus).toHaveBeenCalled();
    });

    it('should apply Barbarian Primal Champion bonus at level 20+', async () => {
      const playerStats = {
        level: 20,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        class: {
          name: 'Barbarian',
          saving_throws: []
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);

      const str = abilities.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(19); // 15 + 0 + 0 + 4 (Primal Champion)
      const con = abilities.find(a => a.name === 'Constitution');
      expect(con.totalScore).toBe(18); // 14 + 0 + 0 + 4 (Primal Champion)
    });

    it('should not apply Primal Champion before level 20', async () => {
      const playerStats = {
        level: 19,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        class: {
          name: 'Barbarian',
          saving_throws: []
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);

      const str = abilities.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(15); // No Primal Champion yet
    });

    it('should calculate proficiency bonus based on level', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        class: {
          name: 'Fighter',
          saving_throws: []
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities[0];
      expect(str.skills[0].bonus).toBe(str.bonus); // Not proficient, no proficiency added
    });

    it('should apply expertise bonus for Rogues', async () => {
      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Dexterity', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        class: {
          name: 'Rogue',
          saving_throws: []
        },
        skillProficiencies: ['Stealth'],
        expertise: ['Stealth']
      };

      const abilities = await rules.getAbilities(playerStats);
      const dex = abilities.find(a => a.name === 'Dexterity');
      const stealth = dex.skills.find(s => s.name === 'Stealth');
      const proficiency = Math.floor((5 - 1) / 4 + 2); // 3
      expect(stealth.bonus).toBe(dex.bonus + proficiency + proficiency); // Double proficiency
    });

    it('should add skills from ability-scores.json', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        class: {
          name: 'Fighter',
          saving_throws: []
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);

      const str = abilities.find(a => a.name === 'Strength');
      expect(str.skills).toContainEqual(expect.objectContaining({ name: 'Athletics', ability: 'Strength' }));
    });
  });

  describe('getPlayerStats', () => {
    beforeEach(() => {
      classRules.getClass.mockReturnValue({
        name: 'Fighter',
        hit_die: 10,
        saving_throws: ['Strength', 'Constitution'],
        proficiencies: [],
        class_levels: [
          {
            spellcasting: null
          }
        ]
      });

      raceRules.getRace.mockReturnValue({
        name: 'Human',
        languages: ['Common'],
        starting_proficiencies: [],
        traits: []
      });

      raceRules.getImmunities.mockReturnValue([]);
      raceRules.getResistances.mockReturnValue([]);
      raceRules.getSenses.mockReturnValue([]);
      raceRules.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });

      raceRules.getRacialBonus.mockReturnValue(0);
      classRules.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });

      vi.mocked(dataLoader.loadSkills).mockResolvedValue([
        { name: 'Athletics', ability: 'Strength' },
        { name: 'Stealth', ability: 'Dexterity' },
        { name: 'Arcana', ability: 'Intelligence' },
        { name: 'Perception', ability: 'Wisdom' },
        { name: 'Persuasion', ability: 'Charisma' }
      ]);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight', 'Investigation', 'Perception']);
    });

    it('should build complete player stats', async () => {
      const allClasses = [{ name: 'Fighter', hit_die: 10 }];
      const allEquipment = [];
      const allMagicItems = [];
      const allRaces = [{ name: 'Human' }];
      const allSpells = [];
      const playerSummary = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        inventory: { equipped: [], magicItems: [] },
        skillProficiencies: [],
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: []
      };

      const result = await rules.getPlayerStats(allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary);

      expect(result).toHaveProperty('proficiency');
      expect(result).toHaveProperty('class');
      expect(result).toHaveProperty('race');
      expect(result).toHaveProperty('abilities');
      expect(result).toHaveProperty('hitPoints');
      expect(result).toHaveProperty('initiative');
      expect(result).toHaveProperty('armorClass');
      expect(result).toHaveProperty('attacks');
      expect(result).toHaveProperty('actions');
      expect(result).toHaveProperty('bonusActions');
      expect(result).toHaveProperty('reactions');
      expect(result).toHaveProperty('languages');
      expect(result).toHaveProperty('proficiencies');
      expect(result).toHaveProperty('skillProficiencies');
    });

    it('should call all required services', async () => {
      const allClasses = [{ name: 'Fighter', hit_die: 10 }];
      const allEquipment = [];
      const allMagicItems = [];
      const allRaces = [{ name: 'Human' }];
      const allSpells = [];
      const playerSummary = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        inventory: { equipped: [], magicItems: [] },
        skillProficiencies: [],
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: []
      };

      await rules.getPlayerStats(allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary);

      expect(classRules.getClass).toHaveBeenCalled();
      expect(raceRules.getRace).toHaveBeenCalled();
      expect(raceRules.getImmunities).toHaveBeenCalled();
      expect(raceRules.getResistances).toHaveBeenCalled();
      expect(raceRules.getSenses).toHaveBeenCalled();
    });
  });

  describe('getSubModules', () => {
    it('should return 5e modules when rules is "5e"', () => {
      const modules = rules.getSubModules({ rules: '5e' });
      expect(modules.use2024).toBe(false);
      expect(modules.abilityCalc.getAbilities).toBeDefined();
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
      expect(modules.proficiencyUtils).toBeDefined();
      expect(modules.classRules).toBeDefined();
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

    it('should read rules from playerSummary when playerStats lacks rules', () => {
      const modules = rules.getSubModules({ name: 'Test' }, { rules: '2024' });
      expect(modules.use2024).toBe(true);
    });

    it('should prefer playerStats.rules over playerSummary.rules', () => {
      const modules = rules.getSubModules({ rules: '5e' }, { rules: '2024' });
      expect(modules.use2024).toBe(false);
    });
  });

  describe('loadSkills and loadPassiveSkills', () => {
    it('should use fallback skills when fetch fails', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue([
        { name: 'Acrobatics', ability: 'Dexterity' },
        { name: 'Athletics', ability: 'Strength' }
      ]);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight', 'Investigation', 'Perception']);

      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        class: {
          name: 'Fighter',
          saving_throws: []
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);
      expect(abilities).toHaveLength(1);
      expect(abilities[0].skills.length).toBeGreaterThan(0);
    });

    it('should load skills from data-loader when available', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue([
        { name: 'Athletics', ability: 'Strength' },
        { name: 'Custom Skill', ability: 'Strength' },
        { name: 'Acrobatics', ability: 'Dexterity' }
      ]);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight', 'Investigation', 'Perception']);

      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
        ],
        class: {
          name: 'Fighter',
          saving_throws: []
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find(a => a.name === 'Strength');
      expect(str.skills).toContainEqual(expect.objectContaining({ name: 'Custom Skill' }));
    });
  });

  describe('2024 ruleset dispatch', () => {
    describe('getHitPoints', () => {
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
        const playerStats = {
          rules: '5e',
          class: { hit_die: 10 },
          level: 1,
          abilities: [{ name: 'Constitution', bonus: 2 }]
        };
        const result = rules.getHitPoints(playerStats);
        expect(result).toBe(12);
        expect(abilityCalc2024.getHitPoints).not.toHaveBeenCalled();
      });
    });

    describe('getAbilities', () => {
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
        vi.mocked(dataLoader.loadSkills).mockResolvedValue([
          { name: 'Athletics', ability: 'Strength' }
        ]);
        vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight']);
        const playerStats = {
          rules: '5e',
          level: 1,
          abilities: [{ name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }],
          class: { name: 'Fighter', saving_throws: [] },
          skillProficiencies: [],
          expertise: []
        };
        const result = await rules.getAbilities(playerStats);
        expect(result).toHaveLength(1);
        expect(abilityCalc2024.getAbilities).not.toHaveBeenCalled();
      });
    });

    describe('getSpellAbilities', () => {
      beforeEach(() => {
        vi.clearAllMocks();
      });

      it('should dispatch to 2024 implementation when rules is "2024"', () => {
        const allSpells = [];
        const playerStats = { rules: '2024' };
        spellCalc2024.getSpellAbilities.mockReturnValue({ modifier: 5 });
        const result = rules.getSpellAbilities(allSpells, playerStats);
        expect(result).toEqual({ modifier: 5 });
        expect(spellCalc2024.getSpellAbilities).toHaveBeenCalledWith(allSpells, playerStats);
      });

      it('should use 5e when rules is "5e"', () => {
        const playerStats = {
          rules: '5e',
          level: 1,
          race: {},
          class: { class_levels: [{}] },
          abilities: [],
          spells: []
        };
        const result = rules.getSpellAbilities([], playerStats);
        expect(result).toBeNull();
        expect(spellCalc2024.getSpellAbilities).not.toHaveBeenCalled();
      });
    });

    describe('getAttacks', () => {
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
        const playerStats = {
          rules: '5e',
          level: 5,
          class: { name: 'Fighter' },
          abilities: [{ name: 'Strength', bonus: 3 }],
          inventory: { equipped: [] },
          spellAbilities: null
        };
        const result = rules.getAttacks([], [], playerStats);
        expect(Array.isArray(result)).toBe(true);
        expect(attackCalc2024.getAttacks).not.toHaveBeenCalled();
      });
    });

    describe('getPlayerStats', () => {
      beforeEach(() => {
        vi.clearAllMocks();
        classRules2024.getClass.mockReturnValue({
          name: 'Fighter',
          hit_die: 10,
          saving_throws: ['Strength', 'Constitution'],
          proficiencies: [],
          class_levels: [{ spellcasting: null }]
        });
        raceRules2024.getRace.mockReturnValue({
          name: 'Human',
          languages: ['Common'],
          starting_proficiencies: [],
          traits: []
        });
        classRules2024.getFeatures.mockReturnValue({
          actions: [],
          bonusActions: [],
          reactions: [],
          specialActions: [],
          characterAdvancement: []
        });
        raceRules2024.getTraits.mockReturnValue({
          actions: [],
          bonusActions: [],
          reactions: [],
          specialActions: [],
          characterAdvancement: []
        });
        raceRules2024.getSenses.mockReturnValue(['Darkvision 60 ft.']);
        abilityCalc2024.getAbilities.mockResolvedValue([
          { name: 'Strength', totalScore: 15, bonus: 2 },
          { name: 'Dexterity', totalScore: 14, bonus: 2 },
          { name: 'Constitution', totalScore: 13, bonus: 1 },
          { name: 'Intelligence', totalScore: 12, bonus: 1 },
          { name: 'Wisdom', totalScore: 10, bonus: 0 },
          { name: 'Charisma', totalScore: 8, bonus: -1 }
        ]);
        abilityCalc2024.getHitPoints.mockReturnValue(44);
        attackCalc2024.getAttacks.mockReturnValue([]);
        spellCalc2024.getSpellAbilities.mockReturnValue(null);
        proficiencyUtils2024.getProficiencies.mockReturnValue([2, ['Common']]);
        proficiencyUtils2024.getProficiencyChoiceCount.mockReturnValue(2);
      });

      it('should build complete player stats using 2024 rules', async () => {
        const allClasses = [];
        const allEquipment = [];
        const allMagicItems = [];
        const allRaces = [];
        const allSpells = [];
        const playerSummary = {
          rules: '2024',
          level: 1,
          class: { name: 'Fighter' },
          race: { name: 'Human' },
          abilities: [
            { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Intelligence', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
          ],
          inventory: { equipped: [], magicItems: [] },
          skillProficiencies: [],
          actions: [],
          bonusActions: [],
          reactions: [],
          specialActions: []
        };

        const result = await rules.getPlayerStats(allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary);

        expect(result.rules).toBe('2024');
        expect(result.proficiency).toBe(2);
        expect(classRules2024.getClass).toHaveBeenCalled();
        expect(raceRules2024.getRace).toHaveBeenCalled();
        expect(abilityCalc2024.getAbilities).toHaveBeenCalled();
        expect(abilityCalc2024.getHitPoints).toHaveBeenCalled();
        expect(result.senses).toEqual(['Darkvision 60 ft.']);
        expect(result.equipment).toBe(allEquipment);
        expect(raceRules2024.getSenses).toHaveBeenCalled();
      });

      it('should set senses and equipment early in 2024 mode', async () => {
        const playerSummary = {
          rules: '2024',
          level: 1,
          class: { name: 'Fighter' },
          race: { name: 'Human' },
          abilities: [
            { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Intelligence', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
            { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }
          ],
          inventory: { equipped: [], magicItems: [] },
          skillProficiencies: [],
          actions: [],
          bonusActions: [],
          reactions: [],
          specialActions: []
        };

        const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
        expect(result.senses).toEqual(['Darkvision 60 ft.']);
        expect(result.equipment).toBeDefined();
      });
    });
  });

  describe('dispatch edge cases', () => {
    describe('getRulesType fallback chain', () => {
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

      it('should handle missing rules field at every dispatch method', () => {
        const hpStats = {
          class: { hit_die: 10 },
          level: 1,
          abilities: [{ name: 'Constitution', bonus: 2 }]
        };
        expect(rules.getHitPoints(hpStats)).toBe(12);

        expect(rules.getAbilities({ abilities: [] })).resolves.toEqual([]);
      });
    });
  });

  describe('applyUmbralSightDarkvision', () => {
    it('should not add darkvision when Gloom Stalker has no existing darkvision (mock returns string array)', async () => {
      const playerSummary = {
        name: 'Test',
        level: 3,
        rules: '2024',
        class: { name: 'Ranger', major: { name: 'Stalker' } },
        race: { name: 'Human' },
        abilities: [
          { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 4 }] }
        ],
        inventory: { equipped: [], magicItems: [] },
        skillProficiencies: [],
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: []
      };

      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
      // Mock returns string format, so Umbral Sight won't find an object to enhance
      expect(result.senses).toEqual(['Darkvision 60 ft.']);
    });

    it('should add 60ft to existing Darkvision for Gloom Stalker (object format)', async () => {
      raceRules2024.getSenses.mockReturnValue([{ name: 'Darkvision', value: '60 ft.' }]);
      classRules2024.getClass.mockReturnValue({
        name: 'Ranger',
        hit_die: 10,
        saving_throws: ['Strength', 'Dexterity'],
        class_levels: [{ level: 3, features: [] }],
        major: { name: 'Stalker', features: [] }
      });
      const playerSummary = {
        name: 'Test',
        level: 3,
        rules: '2024',
        class: { name: 'Ranger', major: { name: 'Stalker' } },
        race: { name: 'Human' },
        abilities: [
          { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 4 }] }
        ],
        inventory: { equipped: [], magicItems: [] },
        skillProficiencies: [],
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: []
      };

      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
      expect(result.senses).toContainEqual({ name: 'Darkvision', value: '120 ft.' });
    });

    it('should not modify darkvision for non-Gloom Stalkers', async () => {
      raceRules2024.getSenses.mockReturnValue([{ name: 'Darkvision', value: '60 ft.' }]);
      classRules2024.getClass.mockReturnValue({
        name: 'Ranger',
        hit_die: 10,
        saving_throws: ['Strength', 'Dexterity'],
        class_levels: [{ level: 3, features: [] }],
        major: { name: 'Hunter', features: [] }
      });
      const playerSummary = {
        name: 'Test',
        level: 3,
        rules: '2024',
        class: { name: 'Ranger', major: { name: 'Hunter' } },
        race: { name: 'Human' },
        abilities: [
          { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 4 }] }
        ],
        inventory: { equipped: [], magicItems: [] },
        skillProficiencies: [],
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: []
      };

      const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
      expect(result.senses).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });
  });
});
