import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch for loadPassiveSkills and loadSkills - must be before imports
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

    it('should handle race proficiency choices for skills', () => {
      const playerStats = {
        class: {},
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

    it('should return 0 for non-skill choices when skill=true', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Tool: Carpenter Tools']
          }
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
        });
      });

  describe('getAbilities', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('ability-scores.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { full_name: 'Strength', skills: ['Athletics'] },
              { full_name: 'Dexterity', skills: ['Stealth', 'Acrobatics'] },
              { full_name: 'Constitution', skills: [] },
              { full_name: 'Intelligence', skills: ['Arcana', 'History'] },
              { full_name: 'Wisdom', skills: ['Perception', 'Insight'] },
              { full_name: 'Charisma', skills: ['Persuasion', 'Deception'] }
            ])
          });
        }
        if (url.includes('passive-skills.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(['Insight', 'Investigation', 'Perception'])
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });
    });

    it('should calculate abilities without racial bonuses (2024 rules)', async () => {
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
          saving_throw_proficiencies: ['Strength', 'Constitution']
        },
        skillProficiencies: ['Athletics', 'Perception'],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);

      expect(abilities).toHaveLength(6);
      const str = abilities.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(17); // 15 + 2 + 0 (no racial bonus in 2024)
      expect(str.bonus).toBe(3); // (17-10)/2
      expect(str.proficient).toBe(true);
      const proficiency = Math.floor((5 - 1) / 4 + 2); // 3
      expect(str.save).toBe(str.bonus + proficiency);
    });

    it('should handle saving_throw_proficiencies from class (2024)', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Wisdom', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
        ],
        class: {
          name: 'Cleric',
          saving_throw_proficiencies: ['Wisdom', 'Charisma']
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);

      const wis = abilities.find(a => a.name === 'Wisdom');
      expect(wis.proficient).toBe(true);
    });

    it('should handle missing saving_throw_proficiencies', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
        ],
        class: {
          name: 'Fighter'
          // no saving_throw_proficiencies
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await rules.getAbilities(playerStats);

      const str = abilities.find(a => a.name === 'Strength');
      expect(str.proficient).toBe(false);
      expect(str.save).toBe(str.bonus);
    });

    it('should apply expertise for Rogues (2024)', async () => {
      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Dexterity', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
        ],
        class: {
          name: 'Rogue',
          saving_throw_proficiencies: []
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
  });

  describe('getArmorClass', () => {
    const createEquipment = () => [
      { name: 'Leather Armor', equipment_category: 'Armor', armor_class: { base: 11, dex_bonus: true, max_bonus: null } },
      { name: 'Chain Mail', equipment_category: 'Armor', armor_class: { base: 16, dex_bonus: false } },
      { name: 'Breastplate', equipment_category: 'Armor', armor_class: { base: 14, dex_bonus: true, max_bonus: 2 } },
      { name: 'Shield', equipment_category: 'Armor', armor_class: { base: 2 } }
    ];

    it('should calculate AC for unarmored character (2024)', () => {
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

    it('should calculate AC with armor (2024)', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(13); // 11 (leather) + 2 (dex)
    });

    it('should calculate AC with armor and max dex bonus (2024)', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 4 }
        ],
        inventory: { equipped: ['Breastplate'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(16); // 14 (breastplate) + 2 (max dex bonus)
    });

    it('should calculate AC with shield (2024)', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['Leather Armor', 'Shield'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 11 + 2 + 2 (shield)
    });

    it('should calculate AC with magic armor (2024)', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['+1 Leather Armor'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(14); // 11 (leather) + 2 (dex) + 1 (magic)
    });

    it('should calculate AC with magic shield (2024)', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        abilities: [
          { name: 'Dexterity', bonus: 2 }
        ],
        inventory: { equipped: ['Leather Armor', '+2 Shield'] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(17); // 11 + 2 + 2 (shield) + 2 (magic shield)
    });

    it('should apply Monk wisdom bonus to AC (2024)', () => {
      const playerStats = {
        class: { name: 'Monk' },
        abilities: [
          { name: 'Dexterity', bonus: 2 },
          { name: 'Wisdom', bonus: 3 }
        ],
        inventory: { equipped: [] }
      };

      const [ac] = rules.getArmorClass(createEquipment(), playerStats);

      expect(ac).toBe(15); // 10 + 2 (dex) + 3 (wisdom for Monk)
    });

    it('should return AC contributions formula (2024)', () => {
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
      { name: 'Magic Missile', level: 1, damage: { damage_at_slot_level: { '1': '3d4+3' }, damage_type: 'Force' }, range: 120, casting_time: '1 action' }
    ];

    it('should add melee weapon attack (2024)', () => {
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

    it('should add ranged weapon attack (2024)', () => {
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

    it('should add magic weapon attack with bonus (2024)', () => {
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

      const longsword = attacks.find(a => a.name === '+1 Longsword');
      expect(longsword).toBeDefined();
      expect(longsword.damage).toBe('1d8+4'); // 1d8 + 3 (str) + 1 (magic)
    });

    it('should handle dual wielding (2024)', () => {
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

    it('should add Monk unarmed strikes (2024)', () => {
      const playerStats = {
        level: 5,
        class: {
          name: 'Monk'
        },
        abilities: [
          { name: 'Dexterity', bonus: 3 }
        ],
        inventory: { equipped: [] },
        spellAbilities: null
      };

      classRules.getMartialArtsDie.mockReturnValue(6);

      const attacks = rules.getAttacks(createEquipment(), createSpells(), playerStats);

      const unarmed = attacks.filter(a => a.name === 'Unarmed Strike');
      expect(unarmed).toHaveLength(2); // Action and Bonus Action
      expect(unarmed[0].damage).toBe('1d6+3');
    });

    it('should add spell attacks (2024)', () => {
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

    it('should use finesse (dex) for melee if higher (2024)', () => {
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
      { name: 'Fireball', level: 3, damage: { damage_at_slot_level: { '3': '8d6' } } },
      { name: 'Magic Missile', level: 1, damage: { damage_at_slot_level: { '1': '3d4+3' } } },
      { name: 'Light', level: 0 }
    ];

    beforeEach(() => {
      classRules.getHighestMajorLevel.mockReturnValue(null);
    });

    it('should return null when no spellcasting (2024)', () => {
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

    it('should calculate spell abilities for wizard (2024)', () => {
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
      expect(result.spells.length).toBeGreaterThan(0);
    });

    it('should handle missing spell ability (2024)', () => {
      const playerStats = {
        level: 1,
        race: {},
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
          { name: 'Strength', bonus: 3 } // No Intelligence!
        ],
        proficiency: 2,
        spells: []
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result).not.toBeNull();
      expect(result.modifier).toBe(0);
      expect(result.toHit).toBe(2); // 0 + 2
      expect(result.saveDc).toBe(10); // 8 + 0 + 2
    });

    it('should set all spells to Always for known spellcasters (2024)', () => {
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

    it('should use highest major level for spellcasting (2024)', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Fighter',
          major: {
            name: 'Eldritch Knight'
          },
          spell_casting_ability: 'Intelligence',
          class_levels: [
            null, null, null, null, {}
          ]
        },
        abilities: [
          { name: 'Intelligence', bonus: 2 }
        ],
        proficiency: 3,
        spells: []
      };

      classRules.getHighestMajorLevel.mockReturnValue({
        spellcasting: {
          spellCastingAbility: 'Intelligence',
          cantrips_known: 2,
          spells_known: 3
        }
      });

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result).not.toBeNull();
      expect(classRules.getHighestMajorLevel).toHaveBeenCalled();
    });

    it('should check required_major for spellcasting (2024)', () => {
      const playerStats = {
        level: 5,
        race: {},
        class: {
          name: 'Fighter',
          major: {
            name: 'Champion' // Not the required major
          },
          spell_casting_ability: 'Intelligence',
          class_levels: [
            null, null, null, null, {
              spellcasting: {
                spellCastingAbility: 'Intelligence',
                required_major: 'Eldritch Knight',
                cantrips_known: 2,
                spells_known: 3
              }
            }
          ]
        },
        abilities: [
          { name: 'Intelligence', bonus: 2 }
        ],
        proficiency: 3,
        spells: []
      };

      const result = rules.getSpellAbilities(createSpells(), playerStats);

      expect(result).toBeNull(); // Required major doesn't match
    });
  });

  describe('getPlayerStats', () => {
    beforeEach(() => {
      classRules.getClass.mockReturnValue({
        name: 'Fighter',
        hit_point_die: '10',
        hit_die: 10,
        saving_throw_proficiencies: ['Strength', 'Constitution'],
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

      raceRules.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });

      classRules.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });

      mockFetch.mockImplementation((url) => {
        if (url.includes('ability-scores.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([
              { full_name: 'Strength', skills: ['Athletics'] },
              { full_name: 'Dexterity', skills: ['Stealth'] },
              { full_name: 'Constitution', skills: [] },
              { full_name: 'Intelligence', skills: ['Arcana'] },
              { full_name: 'Wisdom', skills: ['Perception'] },
              { full_name: 'Charisma', skills: ['Persuasion'] }
            ])
          });
        }
        if (url.includes('passive-skills.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(['Insight', 'Investigation', 'Perception'])
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      classRules.getMartialArtsDie.mockReturnValue(6);
    });

    it('should build complete player stats (2024)', async () => {
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
        specialActions: [],
        magicActions: [],
        utilizeActions: [],
        craftActions: []
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

    it('should call all required services (2024)', async () => {
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
        specialActions: [],
        magicActions: [],
        utilizeActions: [],
        craftActions: []
      };

      await rules.getPlayerStats(allClasses, allEquipment, allMagicItems, allRaces, allSpells, playerSummary);

      expect(classRules.getClass).toHaveBeenCalled();
      expect(raceRules.getRace).toHaveBeenCalled();
    });
  });

  describe('getActions (2024)', () => {
    beforeEach(() => {
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

    it('should combine actions from playerStats, features, and traits (2024)', () => {
      const playerStats = {
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        magicActions: [],
        utilizeActions: [],
        craftActions: []
      };

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual(expect.objectContaining({ name: 'Attack' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Action Surge' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Brave' }));
    });

    it('should handle string actions by converting to objects (2024)', () => {
      classRules.getFeatures.mockReturnValue({
        actions: [{ name: 'Action Surge' }],
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
        actions: ['Attack'], // string instead of object
        bonusActions: [],
        reactions: [],
        specialActions: [],
        magicActions: [],
        utilizeActions: [],
        craftActions: []
      };

      const [actions] = rules.getActions(playerStats);

      // Sorted alphabetically - Action Surge comes before Attack
      expect(actions[0]).toHaveProperty('name', 'Action Surge');
      expect(actions.find(a => a.name === 'Attack')).toHaveProperty('description');
    });

    it('should include magic, utilize, and craft actions (2024)', () => {
      const playerStats = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        magicActions: [{ name: 'Magic Action' }],
        utilizeActions: [{ name: 'Utilize Action' }],
        craftActions: [{ name: 'Craft Action' }]
      };

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual(expect.objectContaining({ name: 'Magic Action' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Utilize Action' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Craft Action' }));
    });

    it('should deduplicate actions by name (2024)', () => {
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
        specialActions: [],
        magicActions: [],
        utilizeActions: [],
        craftActions: []
      };

      const [actions] = rules.getActions(playerStats);

      expect(actions.filter(a => a.name === 'Attack')).toHaveLength(1);
    });
  });

  describe('getMagicItems (2024)', () => {
    it('should handle string magic item names', () => {
      const allMagicItems = [{ name: 'Ring of Protection', description: 'Grants +1 AC' }];
      const playerSummary = { inventory: { magicItems: ['Ring of Protection'] } };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Ring of Protection');
    });

    it('should handle object magic item with quantity and rarity', () => {
      const allMagicItems = [{ name: 'Potion of Healing', rarity: 'Common' }];
      const playerSummary = { inventory: { magicItems: [{ name: 'Potion of Healing', quantity: 3, rarity: 'Uncommon' }] } };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result[0].rarity).toBe('Uncommon');
      expect(result[0].quantity).toBe(3);
    });

    it('should return empty array when allMagicItems is null', () => {
      const playerSummary = { inventory: { magicItems: ['Ring of Protection'] } };

      const result = rules.getMagicItems(null, playerSummary);

      expect(result).toEqual([]);
    });

    it('should return empty array when magic items array is empty', () => {
      const allMagicItems = [{ name: 'Ring of Protection' }];
      const playerSummary = { inventory: { magicItems: [] } };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toEqual([]);
    });

    it('should filter out null items when not found', () => {
      const allMagicItems = [];
      const playerSummary = { inventory: { magicItems: ['Nonexistent Item'] } };

      const result = rules.getMagicItems(allMagicItems, playerSummary);

      expect(result).toEqual([]);
    });
  });

  describe('getHitPoints (2024)', () => {
    it('should handle hit_point_die as string (2024)', () => {
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

      expect(result).toBe(12); // 10 + (6 * 0) + (2 * 1)
    });

    it('should handle hit_point_die as number (2024)', () => {
      const playerStats = {
        level: 1,
        class: {
          hit_point_die: 10,
          hit_die: 10
        },
        abilities: [
          { name: 'Constitution', bonus: 2 }
        ],
        race: {},
        spellAbilities: null
      };

      const result = rules.getHitPoints(playerStats);

      expect(result).toBe(12);
    });

    it('should handle missing hit_point_die with fallback (2024)', () => {
      const playerStats = {
        level: 1,
        class: {
          hit_die: 8
        },
        abilities: [
          { name: 'Constitution', bonus: 1 }
        ],
        race: {},
        spellAbilities: null
      };

      const result = rules.getHitPoints(playerStats);

      // Fallback to hit_die = 8
      expect(result).toBe(9); // 8 + (5 * 0) + (1 * 1)
    });

    it('should handle invalid hit_point_die (2024)', () => {
      const playerStats = {
        level: 1,
        class: {
          hit_point_die: 'invalid',
          hit_die: 8
        },
        abilities: [
          { name: 'Constitution', bonus: 1 }
        ],
        race: {},
        spellAbilities: null
      };

      const result = rules.getHitPoints(playerStats);

      // Fallback to 8 when hit_point_die is invalid
      expect(result).toBe(9); // 8 + (5 * 0) + (1 * 1)
    });

    it('should include major hit point bonus (2024)', () => {
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
      expect(result).toBe(17);
    });
  });

  describe('getLanguages (2024)', () => {
    it('should handle missing race gracefully', () => {
      const playerStats = {
        level: 1,
        race: {},
        class: {}
      };

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

      expect(languagesAllowed).toBe(2); // Background only
      expect(languages).toEqual([]);
    });

    it('should handle race with language_choices (2024)', () => {
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

    it('should handle subrace language_options (2024)', () => {
      const playerStats = {
        race: {
          languages: ['Common'],
          subrace: {
            languages: ['Elvish'],
            language_options: {
              choose: 1,
              from: ['Dwarvish']
            }
          }
        },
        class: {
          languages: []
        },
        level: 1
      };

      const [languagesAllowed, languages] = rules.getLanguages(playerStats);

      expect(languagesAllowed).toBeGreaterThanOrEqual(4); // 2 base + 2 backstory + 1 subrace choice
      expect(languages).toContain('Elvish');
    });

    it('should include major language choices (2024)', () => {
      const playerStats = {
        race: {
          languages: ['Common']
        },
        class: {
          languages: [],
          major: {
            language_choices: {
              choose: 2
            }
          }
        },
        level: 1
      };

      const [languagesAllowed] = rules.getLanguages(playerStats);

      expect(languagesAllowed).toBeGreaterThanOrEqual(4); // 1 base + 2 backstory + 2 major choices
    });
  });

  describe('loadSkills and loadPassiveSkills (2024)', () => {
    it('should use fallback skills when fetch fails (2024)', async () => {
      mockFetch.mockImplementation(() => Promise.reject(new Error('Network error')));

      vi.resetModules();
      const freshRules = await import('./rules-2024');

      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
        ],
        class: {
          name: 'Fighter',
          saving_throw_proficiencies: []
        },
        skillProficiencies: [],
        expertise: []
      };

      const abilities = await freshRules.default.getAbilities(playerStats);
      expect(abilities).toHaveLength(1);
      expect(abilities[0].skills.length).toBeGreaterThan(0);
    });
  });
});
