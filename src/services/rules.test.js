import { describe, it, expect, vi } from 'vitest';

// Mock dataLoader before importing rules
vi.mock('./dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([])
}));

import rules from './rules.js';
import classRules from './classRules.js';
import { rules5e as raceRules } from './race-rules/index.js';
import { rules2024 as raceRules2024 } from './race-rules/index.js';
import * as dataLoader from './dataLoader.js';
import * as abilityCalc2024 from './abilityCalc2024.js';
import * as attackCalc2024 from './attackCalc2024.js';
import * as spellCalc2024 from './spellCalc2024.js';
import * as proficiencyUtils2024 from './proficiencyUtils2024.js';
import classRules2024 from './classRules2024.js';

// Mock dependencies
vi.mock('./utils.js', () => ({
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

vi.mock('./classRules.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn()
          }
        }));

vi.mock('./race-rules/index.js', () => ({
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
  getHitPoints: vi.fn()
}));

vi.mock('./attackCalc2024.js', () => ({
  getAttacks: vi.fn()
}));

vi.mock('./spellCalc2024.js', () => ({
  getSpellAbilities: vi.fn()
}));

vi.mock('./proficiencyUtils2024.js', () => ({
  getProficiencyChoiceCount: vi.fn(),
  getProficiencies: vi.fn()
}));

vi.mock('./classRules2024.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn()
  }
}));

describe('rules', () => {
  describe('getAbilityLongName', () => {
    it('should delegate to utils.getAbilityLongName', () => {
      const result = rules.getAbilityLongName('STR');
      expect(result).toBe('Strength');
     });
      });

  describe('getHitPoints', () => {
    it('should calculate hit points based on hit die, level, and constitution bonus', () => {
      const playerStats = {
        class: {
          hit_die: 10
            },
        level: 5,
        abilities: [
             { name: 'Constitution', bonus: 2 }
             ]
            };

      const result = rules.getHitPoints(playerStats);

        // hit_die + (hit_die/2 + 1) * (level - 1) + constitution.bonus * level
        // 10 + (5 + 1) * 4 + 2 * 5 = 10 + 24 + 10 = 44
      expect(result).toBe(44);
         });

    it('should include racial hit point bonus', () => {
      const playerStats = {
        class: {
          hit_die: 8
            },
        level: 5,
        abilities: [
             { name: 'Constitution', bonus: 1 }
             ],
        race: {
          subrace: {
            hit_point_bonus_per_level: 1
               }
            }
            };

      const result = rules.getHitPoints(playerStats);

       // 8 + (4 + 1) * 4 + 1 * 5 + 1 * 5 = 8 + 20 + 5 + 5 = 38
      expect(result).toBe(38);
         });

    it('should include subclass hit point bonus', () => {
      const playerStats = {
        class: {
          hit_die: 6,
          subclass: {
            hit_point_bonus_per_level: 1
               }
             },
        level: 5,
        abilities: [
             { name: 'Constitution', bonus: 0 }
             ]
            };

      const result = rules.getHitPoints(playerStats);

       // 6 + (3 + 1) * 4 + 0 * 5 + 1 * 5 = 6 + 16 + 0 + 5 = 27
      expect(result).toBe(27);
         });

    it('should handle level 1 character', () => {
      const playerStats = {
        class: {
          hit_die: 10
            },
        level: 1,
        abilities: [
             { name: 'Constitution', bonus: 2 }
             ]
            };

      const result = rules.getHitPoints(playerStats);

       // 10 + 0 + 2 * 1 = 12
      expect(result).toBe(12);
         });

    it('should handle missing constitution bonus', () => {
      const playerStats = {
        class: {
          hit_die: 10
            },
        level: 5,
        abilities: []
           };

      const result = rules.getHitPoints(playerStats);

       // Should handle undefined bonus gracefully
      expect(result).toBeDefined();
       });
        });

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

  describe('getProficiencyChoiceCount', () => {
    it('should count skill proficiency choices from class', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
                { choose: 2, from: ['Skill: Arcana', 'Skill: History'] }
                ]
             },
        race: {
          starting_proficiency_options: null
            }
            };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(2);
         });

    it('should count non-skill proficiency choices from class', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
                { choose: 1, from: ['Tool: Carpenter Tools'] }
                ]
             },
        race: {
          starting_proficiency_options: null
            }
            };

      const result = rules.getProficiencyChoiceCount(playerStats, false);

      expect(result).toBe(1);
         });

    it('should include race proficiency choices', () => {
      const playerStats = {
        class: {
          proficiency_choices: []
            },
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Skill: Stealth']
               }
            }
            };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(1);
         });

    it('should include subrace racial trait proficiency choices', () => {
      const playerStats = {
        class: {
          proficiency_choices: []
            },
        race: {
          starting_proficiency_options: null,
          subrace: {
            racial_traits: [
                   { proficiency_choices: { choose: 1, from: ['Skill: Nature'] } }
                   ]
               }
            }
            };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(1);
         });

    it('should sum all proficiency choices', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
                { choose: 2, from: ['Skill: Arcana', 'Skill: History'] }
                ]
             },
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Skill: Stealth']
              },
          subrace: {
            racial_traits: [
                   { proficiency_choices: { choose: 1, from: ['Skill: Nature'] } }
                   ]
               }
            }
            };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(4);
         });

    it('should handle missing proficiency_choices', () => {
      const playerStats = {
        class: {},
        race: {}
           };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
       });
        });

  describe('getLanguages', () => {
    it('should include race languages', () => {
      const playerStats = {
        race: {
          languages: ['Common', 'Elvish']
           },
        class: {
          languages: []
            },
        level: 1
           };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;
      void languages;

      expect(languages).toContain('Common');
      expect(languages).toContain('Elvish');
         });

    it('should include class languages', () => {
      const playerStats = {
        race: {
          languages: ['Common']
           },
        class: {
          languages: ['Druidic']
            },
        level: 1
           };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;
      void languages;

      expect(languages).toContain('Common');
      expect(languages).toContain('Druidic');
         });

    it('should add 2 backstory languages', () => {
      const playerStats = {
        race: {
          languages: ['Common']
           },
        class: {
          languages: []
            },
        level: 1
           };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;
      void languages;

       expect(_languagesAllowed).toBeGreaterThanOrEqual(2);
         });

    it('should include player languages', () => {
      const playerStats = {
        race: {
          languages: ['Common']
           },
        class: {
          languages: []
            },
        languages: ['Dwarvish'],
        level: 1
           };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;
      void languages;

      expect(languages).toContain('Common');
      expect(languages).toContain('Dwarvish');
         });

    it('should deduplicate languages', () => {
      const playerStats = {
        race: {
          languages: ['Common']
           },
        class: {
          languages: ['Common']
            },
        languages: ['Common'],
        level: 1
           };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;
      void languages;

      expect(languages.filter(l => l === 'Common')).toHaveLength(1);
         });

    it('should return sorted languages', () => {
      const playerStats = {
        race: {
          languages: ['Zebrian', 'Common']
           },
        class: {
          languages: []
            },
        level: 1
           };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;
      void languages;

      expect(languages[0]).toBe('Common');
         });

    it('should handle race language choices', () => {
      const playerStats = {
        race: {
          languages: ['Common'],
          language_choices: {
            choose: 2,
            options: ['Dwarvish', 'Elvish', 'Gnomish']
               }
            },
        class: {
          languages: []
            },
        level: 1
           };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;
      void languages;

       expect(_languagesAllowed).toBeGreaterThanOrEqual(4); // 1 base + 2 backstory + 2 choices
         });

    it('should handle Ranger bonus languages at level 6+', () => {
      const playerStats = {
        race: {
          languages: ['Common']
           },
        class: {
          name: 'Ranger',
          languages: ['Druidic'],
          language_choices: {
            choose: 1
               }
             },
        level: 6
           };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;
      void languages;

       // Should include bonus language for level 6+
       expect(_languagesAllowed).toBeGreaterThan(4);
         });

    it('should handle Ranger bonus languages at level 14+', () => {
      const playerStats = {
        race: {
          languages: ['Common']
           },
        class: {
          name: 'Ranger',
          languages: ['Druidic'],
          language_choices: {
            choose: 1
               }
             },
        level: 14
           };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;
      void languages;

       // Should include both bonus languages
       expect(_languagesAllowed).toBeGreaterThan(5);
       });
        });

  describe('getMagicItems', () => {
    it('should return null when no magic items', () => {
      const allMagicItems = [];
      const playerSummary = {
        inventory: {}
          };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toBeNull();
         });

    it('should return magic items with details', () => {
      const allMagicItems = [
             { name: 'Ring of Protection', description: 'Grants +1 AC', rarity: 'Rare' }
             ];
      const playerSummary = {
        inventory: {
          magicItems: [
                { name: 'Ring of Protection', quantity: 1 }
                ]
            }
           };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ring of Protection');
      expect(result[0].quantity).toBe(1);
         });

    it('should handle Ring of Spell Storing specially', () => {
      const allMagicItems = [
            { 
            name: 'Ring of Spell Storing', 
            description: 'Can store spells', 
            rarity: 'Rare'
               }
             ];
      const playerSummary = {
        inventory: {
          magicItems: [
                { name: 'Ring of Spell Storing', quantity: 1, spell: 'Fireball' }
                ]
            }
           };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].description).toBe('Fireball');
      expect(result[0].details).toBe('Can store spells');
         });

    it('should handle magic items not found in allMagicItems', () => {
      const allMagicItems = [];
      const playerSummary = {
        inventory: {
          magicItems: [
                { name: 'Custom Item', quantity: 1 }
                ]
            }
           };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Custom Item');
         });

    it('should use player magic item rarity if available', () => {
      const allMagicItems = [
             { name: 'Potion of Healing', rarity: 'Common' }
             ];
      const playerSummary = {
        inventory: {
          magicItems: [
                { name: 'Potion of Healing', quantity: 3, rarity: 'Uncommon' }
                ]
            }
           };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].rarity).toBe('Uncommon');
       });
        });

  describe('getActions', () => {
    beforeEach(() => {
        // Mock classRules.getFeatures and raceRules.getTraits
      classRules.getFeatures.mockReturnValue({
        actions: [{ name: 'Action Surge' }],
        bonusActions: [{ name: 'Second Wind' }],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          });

      raceRules.getTraits.mockReturnValue({
        actions: [{ name: 'Brave' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
       });
        });

    it('should combine actions from playerStats, features, and traits', () => {
      const playerStats = {
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: []
           };

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual(expect.objectContaining({ name: 'Attack' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Action Surge' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Brave' }));
         });

    it('should deduplicate actions by name', () => {
      classRules.getFeatures.mockReturnValue({
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          });

      const playerStats = {
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: []
           };

      const [actions] = rules.getActions(playerStats);

      expect(actions.filter(a => a.name === 'Attack')).toHaveLength(1);
         });

    it('should return sorted actions', () => {
      const playerStats = {
        actions: [{ name: 'Zebra Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: []
           };

      const [actions] = rules.getActions(playerStats);

       // Actions should be sorted alphabetically
      expect(actions[0].name).toBe('Action Surge');
         });

    it('should handle missing playerStats actions', () => {
      const playerStats = {};

      const [actions, bonusActions, reactions, specialActions, characterAdvancement] = rules.getActions(playerStats);

      expect(actions).toBeDefined();
      expect(bonusActions).toBeDefined();
      expect(reactions).toBeDefined();
      expect(specialActions).toBeDefined();
      expect(characterAdvancement).toBeDefined();
       });
        });

  describe('getProficiencies', () => {
    it('should return skill proficiencies when skill=true', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana', 'Skill: History', 'Tool: Carpenter Tools']
            },
        race: {
          starting_proficiencies: ['Skill: Stealth'],
          traits: [],
          subrace: null
           },
        skillProficiencies: ['Religion']
           };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, true);
      void _allowed;
      void proficiencies;

      expect(proficiencies).toContain('Arcana');
      expect(proficiencies).toContain('History');
      expect(proficiencies).toContain('Stealth');
      expect(proficiencies).toContain('Religion');
      expect(proficiencies).not.toContain('Carpenter Tools');
         });

    it('should return non-skill proficiencies when skill=false', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana', 'Tool: Carpenter Tools', 'Armor: Light Armor']
            },
        race: {
          starting_proficiencies: ['Tool: Thief Tools'],
          traits: [],
          subrace: null
           },
        proficiencies: ['Armor: Medium Armor']
           };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, false);
      void _allowed;

      expect(proficiencies).toContain('Tool: Carpenter Tools');
      expect(proficiencies).toContain('Tool: Thief Tools');
      expect(proficiencies).toContain('Armor: Light Armor');
      expect(proficiencies).toContain('Armor: Medium Armor');
      expect(proficiencies).not.toContain('Arcana');
         });

    it('should deduplicate proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana']
            },
        race: {
          starting_proficiencies: ['Skill: Arcana'],
          traits: [],
          subrace: null
           },
        skillProficiencies: []
           };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, true);
      void _allowed;
      void proficiencies;

      expect(proficiencies.filter(p => p === 'Arcana')).toHaveLength(1);
         });

    it('should return sorted proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Zebrian', 'Skill: Arcana']
            },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
           },
        skillProficiencies: []
           };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, true);
      void _allowed;
      void proficiencies;

      expect(proficiencies[0]).toBe('Arcana');
         });

    it('should include subclass skill proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: [],
          subclass: {
            name: 'Lore',
            bonus_skill_proficiencies: 2
               }
             },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
           },
        skillProficiencies: []
           };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, true);
      void _allowed;
      void proficiencies;

       expect(_allowed).toBeGreaterThanOrEqual(4); // 2 backstory + 2 subclass bonus
         });

    it('should include subclass tool proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: [],
          subclass: {
            name: 'Valor',
            bonus_proficiencies: ['Armor: Medium Armor']
               }
             },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
           },
        proficiencies: []
           };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, false);
      void _allowed;

      expect(proficiencies).toContain('Armor: Medium Armor');
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
          { name: 'Strength', baseScore: 15, abilityImprovements: 2, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 13, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 12, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
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
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
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
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 14, abilityImprovements: 0, miscBonus: 0 }
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
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
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
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
        ],
        class: {
          name: 'Fighter',
          saving_throws: []
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);
      const _proficiency = Math.floor((1 - 1) / 4 + 2); // 2
      void _proficiency;
      // skillProficiencies is empty, so the skill won't be proficient
      // bonus should just be the ability bonus
      const str = abilities[0];
      expect(str.skills[0].bonus).toBe(str.bonus); // Not proficient, no proficiency added
    });

    it('should apply expertise bonus for Rogues', async () => {
      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Dexterity', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
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
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
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

  describe('getArmorClass', () => {
    const createEquipment = () => [
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
      { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16, dex_bonus: false } },
      { name: 'Breastplate', equipment_category: 'Armor', armor_class: { base: 14, dex_bonus: true, max_bonus: 2 } },
      { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } },
      { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' } }
    ];

    it('should calculate AC for unarmored character', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 3 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13); // 10 + 3 (dex)
    });

    it('should calculate AC with armor', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13); // 11 (leather) + 2 (dex)
    });

    it('should calculate AC with armor and max dex bonus', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 4 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['Breastplate'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(16); // 14 (breastplate) + 2 (max dex bonus)
    });

    it('should calculate AC with shield', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['Leather Armor', 'Shield'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 11 + 2 + 2 (shield)
    });

    it('should calculate AC with magic armor', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['+1 Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(14); // 11 (leather) + 2 (dex) + 1 (magic)
    });

    it('should calculate AC with magic shield', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 1 }
        ],
        inventory: { equipped: ['Leather Armor', '+2 Shield'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(17); // 11 + 2 + 2 (shield) + 2 (magic shield)
    });

    it('should handle equipped items not found in equipment catalog', () => {
      const limitedEquipment = () => [
        { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } }
      ];
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        // 'Unknown Item' is not in limitedEquipment, triggers line 212 (return false)
        inventory: { equipped: ['Unknown Item', 'Leather Armor'] }
      };
      const [ac] = rules.getArmorClass(limitedEquipment(), playerStats);
      expect(ac).toBe(13); // 11 + 2 (dex)
    });

    it('should apply Monk wisdom bonus to AC', () => {
      const playerStats = {
        class: { name: 'Monk' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 },
          { name: 'Wisdom', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 10 + 2 (dex) + 3 (wisdom for Monk)
    });

    it('should apply Barbarian unarmored defense', () => {
      const playerStats = {
        class: { name: 'Barbarian' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 10 + 2 (dex) + 3 (con for Barbarian)
    });

    it('should apply Draconic Sorcerer unarmored defense', () => {
      const playerStats = {
        class: {
          name: 'Sorcerer',
          subclass: { name: 'Draconic' }
        },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Constitution', bonus: 2 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 13 + 2 (dex) for Draconic
    });

    it('should apply Defense fighting style', () => {
      const playerStats = {
        class: {
          name: 'Fighter',
          fightingStyles: ['Defense']
        },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(14); // 11 + 2 + 1 (Defense)
    });

    it('should apply Cloak of Protection', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: {
          equipped: [],
          magicItems: [{ name: 'Cloak of Protection' }]
        }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13); // 10 + 2 (dex) + 1 (Cloak)
    });

    it('should apply Ring of Protection', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: {
          equipped: [],
          magicItems: [{ name: 'Ring of Protection' }]
        }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13); // 10 + 2 (dex) + 1 (Ring)
    });

    it('should return AC contributions formula', () => {
      const playerStats = {
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Dexterity', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };

      const [ac, formula] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13);
      expect(formula).toContain('Unarmored AC (10)');
      expect(formula).toContain('Dexterity Bonus (3)');
    });
  });

  describe('getAttacks', () => {
    const createEquipment = () => [
      { name: 'Longsword', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d8', damage_type: 'Slashing' }, range: { normal: 5 } },
      { name: 'Shortbow', equipment_category: 'Weapon', weapon_range: 'Ranged', damage: { damage_dice: '1d6', damage_type: 'Piercing' }, range: { normal: 150 } },
      { name: 'Dagger', equipment_category: 'Weapon', weapon_range: 'Melee', damage: { damage_dice: '1d4', damage_type: 'Piercing' }, range: { normal: 5 } }
    ];

    const createSpells = () => [
      { name: 'Fireball', level: 3, damage: { damage_at_slot_level: { '3': '8d6' }, damage_type: 'Fire' }, range: 150, casting_time: '1 action' },
      { name: 'Magic Missile', level: 1, damage: { damage_at_slot_level: { '1': '3d4+3' }, damage_type: 'Force' }, range: 120, casting_time: '1 action' },
      { name: 'Light', level: 0, damage_type: 'Light' },
      { name: 'Mage Hand', level: 0, damage_type: 'Conjuration' }
    ];

    it('should add melee weapon attack', () => {
      const playerStats = {
        level: 5,
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Strength', bonus: 3 },
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['Longsword'] },
        spellAbilities: null
      };

      const attacks = rules.getAttacks(createEquipment(), createSpells(), playerStats);

      expect(attacks).toContainEqual(expect.objectContaining({
        name: 'Longsword',
        damage: '1d8+3',
        damageType: 'Slashing',
        type: 'Action'
      }));
    });

    it('should add ranged weapon attack', () => {
      const playerStats = {
        level: 5,
        class: { name: 'Ranger' },
        abilities: [
          { name: 'Dexterity', bonus: 3 }
        ],
        inventory: { equipped: ['Shortbow'] },
        spellAbilities: null
      };

      const attacks = rules.getAttacks(createEquipment(), createSpells(), playerStats);

      expect(attacks).toContainEqual(expect.objectContaining({
        name: 'Shortbow',
        damage: '1d6+3',
        damageType: 'Piercing',
        type: 'Action'
      }));
    });

    it('should add magic weapon attack with bonus', () => {
      const playerStats = {
        level: 5,
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Strength', bonus: 3 },
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['+1 Longsword'] },
        spellAbilities: null
      };

      const attacks = rules.getAttacks(createEquipment(), createSpells(), playerStats);

      expect(attacks).toContainEqual(expect.objectContaining({
        name: '+1 Longsword',
        type: 'Action'
      }));
      const longsword = attacks.find(a => a.name === '+1 Longsword');
      expect(longsword.damage).toBe('1d8+4'); // 1d8 + 3 (str) + 1 (magic)
    });

    it('should handle dual wielding', () => {
      const playerStats = {
        level: 5,
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Strength', bonus: 3 },
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['Longsword', 'Dagger'] },
        spellAbilities: null
      };

      const attacks = rules.getAttacks(createEquipment(), createSpells(), playerStats);

      expect(attacks).toContainEqual(expect.objectContaining({
        name: 'Longsword',
        type: 'Action'
      }));
      expect(attacks).toContainEqual(expect.objectContaining({
        name: 'Dagger',
        type: 'Bonus Action'
      }));
    });

    it('should add Monk unarmed strikes', () => {
      const playerStats = {
        level: 5,
        class: {
          name: 'Monk',
          class_levels: [
            null, null, null, null, {
              class_specific: {
                martial_arts: { dice_count: 1, dice_value: 6 }
              }
            }
          ]
        },
        abilities: [
          { name: 'Dexterity', bonus: 3 }
        ],
        inventory: { equipped: [] },
        spellAbilities: null
      };

      const attacks = rules.getAttacks(createEquipment(), createSpells(), playerStats);

      const unarmed = attacks.filter(a => a.name === 'Unarmed Strike');
      expect(unarmed).toHaveLength(2); // Action and Bonus Action
      expect(unarmed[0].damage).toBe('1d6+3');
    });

    it('should add spell attacks', () => {
      const playerStats = {
        level: 5,
        class: { name: 'Wizard' },
        abilities: [
          { name: 'Intelligence', bonus: 3 }
        ],
        inventory: { equipped: [] },
        spellAbilities: {
          modifier: 3,
          spells: [
            { name: 'Fireball', prepared: 'Prepared' }
          ]
        }
      };

      const attacks = rules.getAttacks(createEquipment(), createSpells(), playerStats);

      const fireball = attacks.find(a => a.name === 'Fireball');
      expect(fireball).toBeDefined();
      expect(fireball.damage).toBe('8d6');
      expect(fireball.hitBonus).toBe(3);
    });

    it('should apply Archery fighting style to ranged attacks', () => {
      const playerStats = {
        level: 5,
        class: {
          name: 'Ranger',
          fightingStyles: ['Archery']
        },
        abilities: [
          { name: 'Dexterity', bonus: 3 }
        ],
        inventory: { equipped: ['Shortbow'] },
        spellAbilities: null
      };

      const attacks = rules.getAttacks(createEquipment(), createSpells(), playerStats);

      const shortbow = attacks.find(a => a.name === 'Shortbow');
      const proficiency = Math.floor((5 - 1) / 4 + 2); // 3
      expect(shortbow.hitBonus).toBe(3 + proficiency + 2); // 3 (dex) + 3 (prof) + 2 (Archery) = 8
    });

    it('should use finesse (dex) for melee if higher', () => {
      const playerStats = {
        level: 5,
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Strength', bonus: 2 },
          { name: 'Dexterity', bonus: 4 }
        ],
        inventory: { equipped: ['Longsword'] },
        spellAbilities: null
      };

      const attacks = rules.getAttacks(createEquipment(), createSpells(), playerStats);

      const longsword = attacks.find(a => a.name === 'Longsword');
      expect(longsword.damage).toContain('4'); // Using dex bonus (4)
    });
  });

  describe('getSpellAbilities', () => {
    const createSpells = () => [
      { name: 'Fireball', level: 3, damage: { damage_at_slot_level: { '3': '8d6' }, damage_type: 'Fire' } },
      { name: 'Magic Missile', level: 1, damage: { damage_at_slot_level: { '1': '3d4+3' }, damage_type: 'Force' } },
      { name: 'Light', level: 0, damage_type: 'Light' },
      { name: 'Mage Hand', level: 0, damage_type: 'Conjuration' }
    ];

    it('should return null when no spellcasting', () => {
      const playerStats = {
        level: 1,
        race: {},
        class: {
          class_levels: [{}]
        },
        abilities: [],
        spells: []
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result).toBeNull();
    });

    it('should calculate spell abilities for wizard', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Wizard',
          spell_casting_ability: 'Intelligence',
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Intelligence',
                cantrips_known: 3,
                spells_known: 6
              }
            }
          ]
        },
        abilities: [
          { name: 'Intelligence', bonus: 3 }
        ],
        proficiency: 3,
        spells: ['Fireball', 'Magic Missile']
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result).not.toBeNull();
      expect(result.spellCastingAbility).toBe('Intelligence');
      expect(result.modifier).toBe(3);
      expect(result.toHit).toBe(6); // 3 + 3
      expect(result.saveDc).toBe(14); // 8 + 3 + 3
      expect(result.spells.length).toBeGreaterThanOrEqual(2);
    });

    it('should add Tiefling racial spells', () => {
      const playerStats = {
        level: 5,
        race: { name: 'Tiefling' },
        class: {
          name: 'Sorcerer',
          spell_casting_ability: 'Charisma',
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Charisma',
                cantrips_known: 3,
                spells_known: 6
              }
            }
          ]
        },
        abilities: [
          { name: 'Charisma', bonus: 2 }
        ],
        proficiency: 3,
        spells: []
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result.spells).toContainEqual(expect.objectContaining({ name: 'Thaumaturgy', prepared: 'Always' }));
      expect(result.spells).toContainEqual(expect.objectContaining({ name: 'Hellish Rebuke', prepared: 'Always' }));
    });

    it('should add High Elf racial cantrip', () => {
      const playerStats = {
        level: 1,
        race: { subrace: { name: 'High Elf' } },
        class: {
          name: 'Wizard',
          spell_casting_ability: 'Intelligence',
          class_levels: [
            {
              spellcasting: {
                spellCastingAbility: 'Intelligence',
                cantrips_known: 3,
                spells_known: 6
              }
            }
          ]
        },
        abilities: [
          { name: 'Intelligence', bonus: 2 }
        ],
        proficiency: 2,
        spells: []
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result.cantrips_known).toBeGreaterThan(3); // Base + High Elf bonus
    });

    it('should add Forest Gnome racial cantrip', () => {
      const playerStats = {
        level: 1,
        race: { subrace: { name: 'Forest Gnome' } },
        class: {
          name: 'Wizard',
          spell_casting_ability: 'Intelligence',
          class_levels: [
            {
              spellcasting: {
                spellCastingAbility: 'Intelligence',
                cantrips_known: 3,
                spells_known: 6
              }
            }
          ]
        },
        abilities: [
          { name: 'Intelligence', bonus: 2 }
        ],
        proficiency: 2,
        spells: []
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result.spells).toContainEqual(expect.objectContaining({ name: 'Minor Illusion', prepared: 'Always' }));
    });

    it('should set all spells to Always for known spellcasters', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Bard',
          spell_casting_ability: 'Charisma',
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Charisma',
                cantrips_known: 2,
                spells_known: 8
              }
            }
          ]
        },
        abilities: [
          { name: 'Charisma', bonus: 3 }
        ],
        proficiency: 3,
        spells: ['Fireball']
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      const fireball = result.spells.find(s => s.name === 'Fireball');
      expect(fireball.prepared).toBe('Always');
    });

    it('should calculate maxPreparedSpells for prepared casters', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Cleric',
          spell_casting_ability: 'Wisdom',
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Wisdom',
                cantrips_known: 3,
                spells_known: null
              }
            }
          ]
        },
        abilities: [
          { name: 'Wisdom', bonus: 3 }
        ],
        proficiency: 3,
        spells: ['Fireball']
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result.maxPreparedSpells).toBe(8); // 3 (wis) + 5 (level)
    });

    it('should apply Eldritch Knight school limits', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Fighter',
          spell_casting_ability: 'Intelligence',
          subclass: { name: 'Eldritch Knight' },
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Intelligence',
                cantrips_known: 3,
                spells_known: 8
              }
            }
          ]
        },
        abilities: [
          { name: 'Intelligence', bonus: 3 }
        ],
        proficiency: 3,
        spells: ['Fireball']
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result.schoolLimits).toEqual(['abjuration', 'evocation']);
    });

    it('should add cantrip for Land Druid subclass', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Druid',
          spell_casting_ability: 'Wisdom',
          subclass: { name: 'Land' },
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Wisdom',
                cantrips_known: 2,
                spells_known: 8
              }
            }
          ]
        },
        abilities: [
          { name: 'Wisdom', bonus: 3 }
        ],
        proficiency: 3,
        spells: []
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result.cantrips_known).toBe(3); // 2 + 1 for Land
    });

    it('should add subclass spells for characters meeting prerequisites', () => {
      const allSpells = [
        { name: 'Flame Strike', level: 5, classes: ['Druid'] }
      ];
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Druid',
          spell_casting_ability: 'Wisdom',
          subclass: {
            name: 'Land',
            circle: 'Land',
            spells: [
              { spell: { name: 'Flame Strike' }, prerequisites: [{ index: 'level-5' }, { name: 'circle-Land' }] }
            ]
          },
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Wisdom',
                cantrips_known: 2,
                spells_known: 8
              }
            }
          ]
        },
        abilities: [
          { name: 'Wisdom', bonus: 3 }
        ],
        proficiency: 3,
        spells: []
      };

      const result = rules.getSpellAbilities(allSpells, playerStats);

      const flameStrike = result.spells.find(s => s.name === 'Flame Strike');
      expect(flameStrike).toBeDefined();
      expect(flameStrike.prepared).toBe('Always');
    });

    it('should skip subclass spells not meeting prerequisites', () => {
      const allSpells = [
        { name: 'Flame Strike', level: 5, classes: ['Druid'] }
      ];
      const playerStats = {
        level: 3, // Doesn't meet level-5 prerequisite
        race: {},
        class: {
          name: 'Druid',
          spell_casting_ability: 'Wisdom',
          subclass: {
            name: 'Land',
            spells: [
              { spell: { name: 'Flame Strike' }, prerequisites: [{ index: 'level-5' }, { name: 'circle-Land' }] }
            ]
          },
          class_levels: [
            null, null, {
              spellcasting: {
                spellCastingAbility: 'Wisdom',
                cantrips_known: 2,
                spells_known: 8
              }
            }
          ]
        },
        abilities: [
          { name: 'Wisdom', bonus: 3 }
        ],
        proficiency: 2,
        spells: []
      };

      const result = rules.getSpellAbilities(allSpells, playerStats);

      const flameStrike = result.spells.find(s => s.name === 'Flame Strike');
      expect(flameStrike).toBeUndefined();
    });

    it('should set spells_known to null for Druid', () => {
      const allSpells = [
        { name: 'Fireball', level: 3, classes: ['Druid'], damage: { damage_at_slot_level: { '3': '8d6' } } },
        { name: 'Magic Missile', level: 1, classes: ['Wizard'], damage: { damage_at_slot_level: { '1': '3d4+3' } } },
        { name: 'Entangle', level: 1, classes: ['Druid'] },
        { name: 'Flame Strike', level: 5, classes: ['Druid'] }
      ];
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Druid',
          spell_casting_ability: 'Wisdom',
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Wisdom',
                cantrips_known: 2,
                spells_known: 8,
                spell_slots_level_1: 4,
                spell_slots_level_2: 3,
                spell_slots_level_3: 3
              }
            }
          ]
        },
        abilities: [
          { name: 'Wisdom', bonus: 3 }
        ],
        proficiency: 3,
        spells: ['Fireball']
      };

      const result = rules.getSpellAbilities(allSpells, playerStats);

      expect(result.spells_known).toBeNull();
      // Should have Fireball (from player) and some Druid spells up to level 3
      expect(result.spells.length).toBeGreaterThan(1);
    });

    it('should set spells_known to null for Paladin', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Paladin',
          spell_casting_ability: 'Charisma',
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Charisma',
                cantrips_known: 0,
                spells_known: 4
              }
            }
          ]
        },
        abilities: [
          { name: 'Charisma', bonus: 3 }
        ],
        proficiency: 3,
        spells: ['Fireball']
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result.spells_known).toBeNull();
    });

    it('should add subclass spells for Land Druid', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Druid',
          spell_casting_ability: 'Wisdom',
          subclass: {
            name: 'Land',
            spells: [
              { spell: { name: 'Flame Strike' }, prerequisites: [{ index: 'level-5' }, { name: 'circle-Land' }] }
            ]
          },
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Wisdom',
                cantrips_known: 2,
                spells_known: 8
              }
            }
          ]
        },
        abilities: [
          { name: 'Wisdom', bonus: 3 }
        ],
        proficiency: 3,
        spells: []
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      // Land Druid gets bonus cantrip
      expect(result.cantrips_known).toBeGreaterThan(2);
    });

    it('should calculate maxPreparedSpells for Paladin', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Paladin',
          spell_casting_ability: 'Charisma',
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Charisma',
                cantrips_known: 0,
                spells_known: 4
              }
            }
          ]
        },
        abilities: [
          { name: 'Charisma', bonus: 3 }
        ],
        proficiency: 3,
        spells: ['Fireball']
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      // maxPreparedSpells = charisma bonus + floor(level/2) = 3 + 2 = 5
      expect(result.maxPreparedSpells).toBe(5);
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
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 13, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 12, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
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
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 13, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 12, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
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
             { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
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
             { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
             { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0 }
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
            abilities: [{ name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }],
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

      describe('getProficiencyChoiceCount', () => {
        beforeEach(() => {
          vi.clearAllMocks();
        });

        it('should dispatch to 2024 proficiencyUtils via getSubModules', () => {
          proficiencyUtils2024.getProficiencyChoiceCount.mockReturnValue(5);
          const playerStats = { rules: '2024', class: {}, race: {} };
          const result = rules.getProficiencyChoiceCount(playerStats, true);
          expect(result).toBe(5);
          expect(proficiencyUtils2024.getProficiencyChoiceCount).toHaveBeenCalled();
        });

        it('should use 5e when rules is missing (default)', () => {
          const playerStats = {
            class: {
              proficiency_choices: [
                { choose: 3, from: ['Skill: Arcana'] }
              ]
            },
            race: { starting_proficiency_options: null }
          };
          const result = rules.getProficiencyChoiceCount(playerStats, true);
          expect(result).toBe(3);
        });
      });

      describe('getProficiencies', () => {
        beforeEach(() => {
          vi.clearAllMocks();
        });

        it('should dispatch to 2024 and use class.major as bonusSource', () => {
          proficiencyUtils2024.getProficiencies.mockReturnValue([5, ['Arcana', 'History']]);
          const playerStats = {
            rules: '2024',
            class: { major: { name: 'Evocation' } },
            race: { traits: [], starting_proficiencies: [] },
            proficiencies: []
          };
          const [, proficiencies] = rules.getProficiencies(playerStats, true);
          expect(proficiencies).toContain('Arcana');
          expect(proficiencyUtils2024.getProficiencies).toHaveBeenCalled();
        });

        it('should use 5e with race trait and subrace proficiencies', () => {
          const playerStats = {
            class: {
              proficiencies: ['Skill: Arcana'],
              subclass: { name: 'Lore' }
            },
            race: {
              starting_proficiencies: [],
              traits: [
                { proficiencies: ['Skill: Nature'] }
              ],
              subrace: {
                starting_proficiencies: ['Skill: Religion'],
                racial_traits: [
                  { proficiencies: ['Skill: History'] }
                ]
              }
            },
            skillProficiencies: []
          };
          const [, proficiencies] = rules.getProficiencies(playerStats, true);
          expect(proficiencies).toContain('Nature');
          expect(proficiencies).toContain('Religion');
          expect(proficiencies).toContain('History');
        });
      });

      describe('getActions', () => {
        beforeEach(() => {
          vi.clearAllMocks();
        });

        it('should include magic/utilize/craft actions in 2024 mode', () => {
          classRules2024.getFeatures.mockReturnValue({
            actions: [{ name: 'Feature Action' }],
            bonusActions: [{ name: 'Feature Bonus' }],
            reactions: [{ name: 'Feature Reaction' }],
            specialActions: [],
            characterAdvancement: []
          });
          raceRules2024.getTraits.mockReturnValue({
            actions: [{ name: 'Trait Action' }],
            bonusActions: [],
            reactions: [],
            specialActions: [],
            characterAdvancement: []
          });
          const playerStats = {
            rules: '2024',
            actions: ['String Action'],
            bonusActions: [{ name: 'Player Bonus' }],
            reactions: [{ name: 'Player Reaction' }],
            specialActions: [],
            magicActions: [{ name: 'Magic Action' }],
            utilizeActions: [{ name: 'Utilize Action' }],
            craftActions: [{ name: 'Craft Action' }]
          };
          const [actions, bonusActions, reactions] = rules.getActions(playerStats);
          expect(actions).toContainEqual(expect.objectContaining({ name: 'Magic Action' }));
          expect(actions).toContainEqual(expect.objectContaining({ name: 'Utilize Action' }));
          expect(actions).toContainEqual(expect.objectContaining({ name: 'Craft Action' }));
          expect(actions).toContainEqual(expect.objectContaining({ name: 'String Action', description: '' }));
          expect(bonusActions).toHaveLength(2);
          expect(reactions).toHaveLength(2);
        });

        it('should normalize string actions to objects in 2024 mode', () => {
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
          const playerStats = {
            rules: '2024',
            bonusActions: [],
            reactions: [],
            specialActions: ['Special String Action'],
            magicSpecialActions: [{ name: 'Magic Special' }]
          };
          const [, , , specialActions] = rules.getActions(playerStats);
          expect(specialActions).toContainEqual(expect.objectContaining({ name: 'Special String Action', description: '' }));
          expect(specialActions).toContainEqual(expect.objectContaining({ name: 'Magic Special' }));
        });

        it('should not include magic/utilize/craft actions in 5e mode', () => {
          classRules.getFeatures.mockReturnValue({
            actions: [{ name: 'Feature Action' }],
            bonusActions: [],
            reactions: [],
            specialActions: [],
            characterAdvancement: []
          });
          raceRules.getTraits.mockReturnValue({
            actions: [],
            bonusActions: [],
            reactions: [],
            specialActions: [],
            characterAdvancement: []
          });
          const playerStats = {
            bonusActions: [],
            reactions: [],
            specialActions: [],
            magicActions: [{ name: 'Magic Action' }],
            utilizeActions: [{ name: 'Utilize Action' }]
          };
          const [actions] = rules.getActions(playerStats);
          expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Magic Action' }));
          expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Utilize Action' }));
        });
      });

      describe('getArmorClass', () => {
        const baseEquipment2024 = () => [
          { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
          { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
        ];

        it('should not apply Defense fighting style in 2024 mode', () => {
          const playerStats = {
            rules: '2024',
            class: { name: 'Fighter', fightingStyles: ['Defense'] },
            abilities: [{ name: 'Dexterity', bonus: 2 }],
            inventory: { equipped: [] }
          };
          const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
          expect(ac).toBe(12); // 10 + 2 (dex), no Defense bonus
        });

        it('should not apply Cloak of Protection in 2024 mode', () => {
          const playerStats = {
            rules: '2024',
            class: { name: 'Wizard' },
            abilities: [{ name: 'Dexterity', bonus: 2 }],
            inventory: { equipped: [], magicItems: [{ name: 'Cloak of Protection' }] }
          };
          const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
          expect(ac).toBe(12);
        });

        it('should not apply Ring of Protection in 2024 mode', () => {
          const playerStats = {
            rules: '2024',
            class: { name: 'Wizard' },
            abilities: [{ name: 'Dexterity', bonus: 2 }],
            inventory: { equipped: [], magicItems: [{ name: 'Ring of Protection' }] }
          };
          const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
          expect(ac).toBe(12);
        });

        it('should not apply Barbarian unarmored defense in 2024 mode', () => {
          const playerStats = {
            rules: '2024',
            class: { name: 'Barbarian' },
            abilities: [
              { name: 'Dexterity', bonus: 2 },
              { name: 'Constitution', bonus: 3 }
            ],
            inventory: { equipped: [] }
          };
          const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
          expect(ac).toBe(12); // 10 + 2, no Con bonus
        });

        it('should not apply Draconic Sorcerer unarmored defense in 2024 mode', () => {
          const playerStats = {
            rules: '2024',
            class: { name: 'Sorcerer', subclass: { name: 'Draconic' } },
            abilities: [{ name: 'Dexterity', bonus: 2 }],
            inventory: { equipped: [] }
          };
          const [ac] = rules.getArmorClass(baseEquipment2024(), playerStats);
          expect(ac).toBe(12); // 10 + 2, no Draconic bonus
        });
      });

      describe('getLanguages', () => {
        it('should use class.major.language_choices in 2024 mode', () => {
          const playerStats = {
            rules: '2024',
            race: { languages: ['Common'] },
            class: { major: { language_choices: { choose: 3 } } },
            level: 1
          };
          const [languagesAllowed] = rules.getLanguages(playerStats);
          expect(languagesAllowed).toBeGreaterThanOrEqual(5); // 1 + 2 (background) + 3 (major)
        });

        it('should use class.subclass.language_choices in 5e mode', () => {
          const playerStats = {
            race: { languages: ['Common'] },
            class: {
              languages: [],
              subclass: { language_choices: { choose: 2 } }
            },
            level: 1
          };
          const [languagesAllowed] = rules.getLanguages(playerStats);
          expect(languagesAllowed).toBeGreaterThanOrEqual(4); // 1 + 2 (background) + 2 (subclass)
        });
      });

      describe('getMagicItems', () => {
        it('should return [] instead of null for empty magic items in 2024 mode', () => {
          const result = rules.getMagicItems([], { inventory: {} }, { rules: '2024' });
          expect(result).toEqual([]);
        });

        it('should return null for empty magic items in 5e mode', () => {
          const result = rules.getMagicItems([], { inventory: {} });
          expect(result).toBeNull();
        });

        it('should filter out not-found items in 2024 mode', () => {
          const allMagicItems = [{ name: 'Ring of Protection', rarity: 'Rare' }];
          const playerSummary = {
            inventory: {
              magicItems: [
                { name: 'Ring of Protection' },
                { name: 'Unknown Item' }
              ]
            }
          };
          const result = rules.getMagicItems(allMagicItems, playerSummary, { rules: '2024' });
          expect(result).toHaveLength(1);
          expect(result[0].name).toBe('Ring of Protection');
        });

        it('should keep not-found items in 5e mode', () => {
          const allMagicItems = [];
          const playerSummary = {
            inventory: {
              magicItems: [
                { name: 'Custom Item', quantity: 1 }
              ]
            }
          };
          const result = rules.getMagicItems(allMagicItems, playerSummary);
          expect(result).toHaveLength(1);
          expect(result[0].name).toBe('Custom Item');
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
              { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Constitution', baseScore: 13, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Intelligence', baseScore: 12, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
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
              { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Constitution', baseScore: 13, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Intelligence', baseScore: 12, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
              { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
            ],
            inventory: { equipped: [], magicItems: [] },
            skillProficiencies: [],
            actions: [],
            bonusActions: [],
            reactions: [],
            specialActions: []
          };

          const result = await rules.getPlayerStats([], [], [], [], [], playerSummary);
          // 2024 mode sets senses to [] early (before getSenses override), stores equipment
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
          // getHitPoints with undefined rules should use 5e formula
          const hpStats = {
            class: { hit_die: 10 },
            level: 1,
            abilities: [{ name: 'Constitution', bonus: 2 }]
          };
          expect(rules.getHitPoints(hpStats)).toBe(12);

          // getAbilities with undefined rules
          expect(rules.getAbilities({ abilities: [] })).resolves.toEqual([]);
        });
      });

      describe('Shield string variant in getArmorClass', () => {
        it('should handle "Shield" string in equipped items', () => {
          const equipment = [
            { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
            { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
          ];
          const playerStats = {
            class: { name: 'Fighter' },
            abilities: [{ name: 'Dexterity', bonus: 2 }],
            inventory: { equipped: ['Leather Armor', 'Shield'] }
          };
          const [ac] = rules.getArmorClass(equipment, playerStats);
          expect(ac).toBe(15); // 11 + 2 (dex) + 2 (shield)
        });
      });
    });
});
