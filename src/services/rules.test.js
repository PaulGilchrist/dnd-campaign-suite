import { describe, it, expect, vi, beforeEach } from 'vitest';
import rules from './rules';
import classRules from './class-rules';
import raceRules from './race-rules';

// Mock dependencies
vi.mock('./utils', () => ({
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

vi.mock('./class-rules', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn()
       }
     }));

vi.mock('./race-rules', () => ({
  default: {
    getRace: vi.fn(),
    getRacialBonus: vi.fn(),
    getImmunities: vi.fn(),
    getResistances: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn()
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

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

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

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

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

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

      expect(languagesAllowed).toBeGreaterThanOrEqual(2);
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

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

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

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

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

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

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

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

      expect(languagesAllowed).toBeGreaterThanOrEqual(4); // 1 base + 2 backstory + 2 choices
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

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

       // Should include bonus language for level 6+
      expect(languagesAllowed).toBeGreaterThan(4);
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

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

       // Should include both bonus languages
      expect(languagesAllowed).toBeGreaterThan(5);
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

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

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

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, false);

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

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

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

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

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

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(allowed).toBeGreaterThanOrEqual(4); // 2 backstory + 2 subclass bonus
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

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, false);

      expect(proficiencies).toContain('Armor: Medium Armor');
       });
        });
});
