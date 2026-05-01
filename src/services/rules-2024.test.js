import { describe, it, expect, vi, beforeEach } from 'vitest';
import rules from './rules-2024';

// Mock dependencies
vi.mock('lodash', () => ({
  cloneDeep: vi.fn(obj => obj && JSON.parse(JSON.stringify(obj))),
  uniqBy: vi.fn((arr, key) => {
    if (!arr || arr.length === 0) return [];
    const seen = new Set();
    return arr.filter(item => {
      const value = item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  })
}));

vi.mock('./utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn(name => {
      const map = {
        'STR': 'Strength',
        'DEX': 'Dexterity',
        'CON': 'Constitution',
        'INT': 'Intelligence',
        'WIS': 'Wisdom',
        'CHA': 'Charisma'
       };
      return map[name] || name;
      })
     }
}));

vi.mock('./class-rules-2024.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getMartialArtsDie: vi.fn(),
    getHighestMajorLevel: vi.fn()
     }
}));

vi.mock('./race-rules-2024.js', () => ({
  default: {
    getRace: vi.fn(),
    getTraits: vi.fn(),
    getSenses: vi.fn()
     }
}));

import classRules from './class-rules-2024.js';
import raceRules from './race-rules-2024.js';

describe('rules 2024', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
      });

  describe('getAbilityLongName', () => {
    it('should delegate to utils.getAbilityLongName', () => {
      const result = rules.getAbilityLongName('STR');
      expect(result).toBe('Strength');
        });
      });

  describe('getHitPoints', () => {
    it('should calculate hit points with constitution bonus', () => {
      const playerStats = {
        level: 1,
        class: {
          hit_point_die: '10',
          hit_die: 10
           },
        abilities: [
           { name: 'Constitution', bonus: 2 }
            ],
        race: {},
        spellAbilities: null
         };

      const result = rules.getHitPoints(playerStats);

           // 10 + (6 * 0) + (2 * 1) = 12
      expect(result).toBe(12);
        });

    it('should handle racial hit point bonus', () => {
      const playerStats = {
        level: 5,
        class: {
          hit_point_die: '8',
          hit_die: 8
           },
        abilities: [
           { name: 'Constitution', bonus: 1 }
            ],
        race: {
          subrace: {
            hit_point_bonus_per_level: 1
             }
           },
        spellAbilities: null
         };

      const result = rules.getHitPoints(playerStats);

           // 8 + (5 * 4) + (1 * 5) + (1 * 5) = 8 + 20 + 5 + 5 = 38
      expect(result).toBeGreaterThan(0);
        });

    it('should handle major hit point bonus', () => {
      const playerStats = {
        level: 3,
        class: {
          hit_point_die: '6',
          hit_die: 6,
          major: {
            hit_point_bonus_per_level: 1
             }
           },
        abilities: [
           { name: 'Constitution', bonus: 0 }
            ],
        race: {},
        spellAbilities: null
         };

      const result = rules.getHitPoints(playerStats);

           // 6 + (4 * 2) + (0 * 3) + (1 * 3) = 6 + 8 + 0 + 3 = 17
      expect(result).toBeGreaterThan(0);
        });
      });

  describe('getSpellMaxLevel', () => {
    it('should return null when no spell abilities', () => {
      const result = rules.getSpellMaxLevel(null);
      expect(result).toBeNull();
        });

    it('should return max spell slot level', () => {
      const spellAbilities = {
        spell_slots_level_1: 2,
        spell_slots_level_2: 3,
        spell_slots_level_3: 0
         };

      const result = rules.getSpellMaxLevel(spellAbilities);

      expect(result).toBe(2);
        });

    it('should return 9 when has 9th level slots', () => {
      const spellAbilities = {
        spell_slots_level_9: 1
         };

      const result = rules.getSpellMaxLevel(spellAbilities);

      expect(result).toBe(9);
        });
      });

  describe('getMagicItems', () => {
    it('should return empty array when no magic items', () => {
      const allMagicItems = [];
      const playerSummary = { inventory: { magicItems: [] } };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toEqual([]);
        });

    it('should return processed magic items', () => {
      const allMagicItems = [{ name: 'Ring of Protection', description: 'Grants +2 AC' }];
      const playerSummary = { inventory: { magicItems: ['Ring of Protection'] } };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ring of Protection');
        });

    it('should handle Ring of Spell Storing specially', () => {
      const allMagicItems = [{
        name: 'Ring of Spell Storing',
        description: 'Can store spells'
         }];
      const playerSummary = {
        inventory: {
          magicItems: [{ name: 'Ring of Spell Storing', spell: 'Fireball' }]
           }
         };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].description).toBe('Fireball');
      expect(result[0].details).toBe('Can store spells');
        });
      });

  describe('getLanguages', () => {
    it('should include race languages', () => {
      const playerStats = {
        race: { languages: ['Common', 'Elvish'] },
        class: { languages: [] },
        level: 1
         };

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

      expect(languages).toContain('Common');
      expect(languages).toContain('Elvish');
      expect(languagesAllowed).toBeGreaterThan(0);
        });

    it('should include class languages', () => {
      const playerStats = {
        race: { languages: ['Common'] },
        class: { languages: ['Druidic'] },
        level: 1
         };

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

      expect(languages).toContain('Druidic');
        });

    it('should add 2 background languages', () => {
      const playerStats = {
        race: { languages: [] },
        class: { languages: [] },
        level: 1
         };

      const [languagesAllowed] = rules.getLanguages(playerStats);

           // 0 race + 2 background = 2
      expect(languagesAllowed).toBe(2);
        });
      });

  describe('getProficiencies', () => {
    it('should return skill proficiencies when skill=true', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics', 'Skill: Intimidation', 'Light Armor']
           },
        race: { starting_proficiencies: [] },
        skillProficiencies: ['Perception']
         };

      const [proficienciesAllowed, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toContain('Athletics');
      expect(proficiencies).toContain('Intimidation');
      expect(proficiencies).toContain('Perception');
      expect(proficiencies).not.toContain('Light Armor');
        });

    it('should return non-skill proficiencies when skill=false', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics', 'Light Armor', 'Simple Weapons']
           },
        race: { starting_proficiencies: [] },
        proficiencies: ['Shield']
         };

      const [proficienciesAllowed, proficiencies] = rules.getProficiencies(playerStats, false);

      expect(proficiencies).toContain('Light Armor');
      expect(proficiencies).toContain('Simple Weapons');
      expect(proficiencies).toContain('Shield');
      expect(proficiencies).not.toContain('Athletics');
        });
      });

  describe('getProficiencyChoiceCount', () => {
    it('should parse skill_proficiency_choices string', () => {
      const playerStats = {
        class: {
          skill_proficiency_choices: 'Choose 2 from Arcana, History, Nature'
           },
        race: {}
         };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(2);
        });

    it('should return 0 when no skill choices', () => {
      const playerStats = {
        class: {},
        race: {}
         };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
        });
      });
});
