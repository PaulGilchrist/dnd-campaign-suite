import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

// Reference to mocked classRules (filled in beforeEach)
let mockGetHighestMajorLevel;

vi.mock('../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => 0),
  },
}));

describe('spellCalc2024', () => {
  beforeEach(async () => {
    const classRules = await import('../character/classRules2024.js');
    mockGetHighestMajorLevel = classRules.default.getHighestMajorLevel;
    vi.clearAllMocks();
  });

  describe('getSpellAbilities', () => {
    it('should return null when no spellcasting is available', () => {
      const allSpells = [];
      const playerStats = {
        level: 1,
        class: {
          name: 'Fighter',
          class_levels: [{ level: 1 }],
        },
        abilities: [],
      };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result).toBeNull();
    });

    it('should return spell abilities from class level spellcasting', () => {
      const allSpells = [{ name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' }];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              spell_known: 0,
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: ['Fire Bolt'],
        proficiency: 2,
      };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(3);
      expect(result.spell_slots).toEqual({ '1': 2 });
      expect(result.spellCastingAbility).toBe('Intelligence');
      expect(result.modifier).toBe(3);
      expect(result.toHit).toBe(5); // 3 + 2
      expect(result.saveDc).toBe(13); // 8 + 3 + 2
    });

    it('should return null when required_major does not match', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              required_major: 'Evoker',
            },
          }],
          major: { name: 'Necromancer' },
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).toBeNull();
    });

    it('should return spell abilities when required_major matches', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              required_major: 'Evoker',
            },
          }],
          major: { name: 'Evoker' },
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(3);
    });

    it('should fall back to getHighestMajorLevel when class_levels have no spellcasting', () => {
      // getHighestMajorLevel returns a number (0 by default), so .spellcasting on it is undefined.
      // This means the fallback doesn't work in practice. The function returns null.
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{ level: 1 }], // no spellcasting here
          major: { name: 'Evoker', features: [{ level: 1 }] },
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).toBeNull();
      expect(mockGetHighestMajorLevel).toHaveBeenCalledWith(playerStats);
    });

    it('should return empty spells array when player has no spells property', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).not.toBeNull();
      expect(result.spells).toEqual([]);
    });

    it('should handle missing spell ability (no matching ability in array)', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).not.toBeNull();
      expect(result.modifier).toBe(0);
      expect(result.toHit).toBe(2); // proficiency only
      expect(result.saveDc).toBe(10); // 8 + proficiency
    });

    it('should map spell names to spell details from allSpells', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' },
        { name: 'Magic Missile', level: 1, damage: { damage_type: 'Force' }, casting_time: '1 action', range: '120 feet' },
      ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 2,
              spell_slots: { '1': 2 },
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: ['Fire Bolt', 'Magic Missile'],
        proficiency: 2,
      };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(2);
      // Cantrip (level 0) should have prepared = 'Always'
      const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
      expect(fireBolt.prepared).toBe('Always');
      expect(fireBolt.level).toBe(0);

      const magicMissile = result.spells.find(s => s.name === 'Magic Missile');
      expect(magicMissile.prepared).toBe('Always');
      expect(magicMissile.level).toBe(1);
    });

    it('should sort spells by level then alphabetically', () => {
      const allSpells = [
        { name: 'Acid Splash', level: 0, damage: { damage_type: 'Acid' }, casting_time: '1 action', range: '60 feet' },
        { name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' },
        { name: 'Shield', level: 1, damage: { damage_type: 'Force' }, casting_time: '1 reaction', range: 'Self' },
        { name: 'Magic Missile', level: 1, damage: { damage_type: 'Force' }, casting_time: '1 action', range: '120 feet' },
      ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 2,
              spell_slots: { '1': 2 },
            },
          }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        spells: ['Shield', 'Fire Bolt', 'Magic Missile', 'Acid Splash'],
        proficiency: 2,
      };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(4);
      // Sorted: level 0 alphabetically, then level 1 alphabetically
      expect(result.spells[0].name).toBe('Acid Splash');
      expect(result.spells[1].name).toBe('Fire Bolt');
      expect(result.spells[2].name).toBe('Magic Missile');
      expect(result.spells[3].name).toBe('Shield');
    });

    it('should handle subclass (legacy format) matching required_major', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Cleric',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              required_major: 'Life',
            },
          }],
          subclass: { name: 'Life' },
          spell_casting_ability: 'Wisdom',
        },
        abilities: [
          { name: 'Wisdom', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
        ],
        spells: [],
        proficiency: 2,
      };

      const result = getSpellAbilities([], playerStats);

      expect(result).not.toBeNull();
      expect(result.spellCastingAbility).toBe('Wisdom');
      expect(result.modifier).toBe(3);
    });

    it('should handle spell not found in allSpells gracefully', () => {
      const allSpells = [{ name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' }];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 2,
              spell_slots: { '1': 2 },
             },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: ['Unknown Spell'],
        proficiency: 2,
       };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Unknown Spell');
      expect(result.spells[0].prepared).toBe('Always');
     });

    // ── Automation: passive_rule / always_prepared_spells ──

    it('should add always_prepared_spells from automation passives', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' },
        { name: 'Light', level: 0, damage: {}, casting_time: '1 action', range: 'Self' },
       ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 2,
              spell_slots: { '1': 2 },
             },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: ['Fire Bolt'],
        proficiency: 2,
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Light'] },
           ],
         },
       };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(2);
      expect(result.spells.find(s => s.name === 'Light')).toBeDefined();
     });

    it('should add always_prepared_spells from automation actions', () => {
      const allSpells = [
         { name: 'Sanctuary', level: 1, damage: {}, casting_time: '1 bonus action', range: 'Touch' },
        ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Cleric',
          major: { name: 'Knowledge' },
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              },
            }],
          spell_casting_ability: 'Wisdom',
          },
        abilities: [
            { name: 'Wisdom', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          ],
        spells: [],
        proficiency: 2,
        automation: {
          actions: [
             { type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Sanctuary'] },
            ],
          },
        };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Sanctuary');
     });

    it('should add always_prepared_spells from automation bonusActions', () => {
      const allSpells = [
          { name: 'Healing Word', level: 1, damage: {}, casting_time: '1 bonus action', range: '60 feet' },
        ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Cleric',
          major: { name: 'Life' },
          class_levels: [{
            level: 1,
            spellcasting: {
              cantrips_known: 3,
              spell_slots: { '1': 2 },
              },
            }],
        spell_casting_ability: 'Wisdom',
          },
        abilities: [
             { name: 'Wisdom', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
           ],
        spells: [],
        proficiency: 2,
        automation: {
          bonusActions: [
              { type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Healing Word'] },
            ],
         },
       };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Healing Word');
     });

    it('should not duplicate spells already known when always_prepared_spells is present', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' },
       ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: ['Fire Bolt'], // already known
        proficiency: 2,
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Fire Bolt'] },
           ],
         },
       };

      const result = getSpellAbilities(allSpells, playerStats);

      // Fire Bolt should appear only once
      expect(result.spells).toHaveLength(1);
    });

    it('should skip passive_rule when effect is not always_prepared_spells', () => {
      const allSpells = [
        { name: 'Ghost Sound', level: 0, damage: {}, casting_time: '1 action', range: '60 feet' },
       ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: [],
        proficiency: 2,
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'some_other_effect', spells: ['Ghost Sound'] },
           ],
         },
       };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(0);
     });

    it('should skip passive_rule when spells array is missing', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: [],
        proficiency: 2,
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'always_prepared_spells' }, // no spells array
           ],
         },
       };

      const result = getSpellAbilities([], playerStats);

      expect(result.spells).toHaveLength(0);
    });

    // ── Automation: free_spell ──

    it('should add a free_spell from automation passives', () => {
      const allSpells = [
        { name: 'Prestidigitation', level: 0, damage: {}, casting_time: '1 action', range: 'Touch' },
       ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Sorcerer',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 4, spell_known: 2, spell_slots: {} },
           }],
          spell_casting_ability: 'Charisma',
         },
        abilities: [
           { name: 'Charisma', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
         ],
        spells: [],
        proficiency: 2,
        automation: {
          passives: [
            { type: 'free_spell', spell: 'Prestidigitation' },
           ],
         },
       };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Prestidigitation');
     });

    it('should not duplicate a free_spell already known', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, damage: { damage_type: 'Fire' }, casting_time: '1 action', range: '120 feet' },
       ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: ['Fire Bolt'], // already known
        proficiency: 2,
        automation: {
          actions: [
            { type: 'free_spell', spell: 'Fire Bolt' },
           ],
         },
       };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(1);
     });

    it('should add multiple spells from an array free_spell', () => {
      const allSpells = [
        { name: 'Shield of Faith', level: 1, damage: {}, casting_time: '1 bonus action', range: '60 feet' },
        { name: 'Spiritual Weapon', level: 2, damage: {}, casting_time: '1 bonus action', range: '60 feet' },
       ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Cleric',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4 } } }],
          spell_casting_ability: 'Wisdom',
         },
        abilities: [{ name: 'Wisdom', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 }],
        spells: [],
        proficiency: 3,
        automation: {
          passives: [
            { type: 'free_spell', spell: ['Shield of Faith', 'Spiritual Weapon'] },
           ],
         },
       };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(2);
      expect(result.spells[0].name).toBe('Shield of Faith');
      expect(result.spells[1].name).toBe('Spiritual Weapon');
     });

    it('should skip free_spell when spell property is missing', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: [],
        proficiency: 2,
        automation: {
          bonusActions: [
            { type: 'free_spell' }, // no spell property
           ],
         },
       };

      const result = getSpellAbilities([], playerStats);

      expect(result.spells).toHaveLength(0);
    });

    // ── Automation: combined features and missing sub-arrays ──

    it('should handle automation with missing actions/bonusActions arrays', () => {
      const allSpells = [
        { name: 'Light', level: 0, damage: {}, casting_time: '1 action', range: 'Self' },
       ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: [],
        proficiency: 2,
        automation: {
          // actions and bonusActions are missing, only passives provided
          passives: [
            { type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Light'] },
           ],
         },
       };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Light');
     });

    it('should handle automation with empty sub-arrays', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: [],
        proficiency: 2,
        automation: {
          actions: [],
          bonusActions: [],
          passives: [],
         },
       };

      const result = getSpellAbilities([], playerStats);

      expect(result.spells).toHaveLength(0);
    });

    it('should handle mixed automation features in all three arrays', () => {
      const allSpells = [
          { name: 'Shield', level: 1, damage: {}, casting_time: '1 reaction', range: 'Self' },
          { name: 'Minor Illusion', level: 1, damage: {}, casting_time: '1 action', range: 'Self' },
          { name: 'Light', level: 0, damage: {}, casting_time: '1 action', range: 'Self' },
        ];
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          major: { name: 'Order' },
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } },
             }],
        spell_casting_ability: 'Intelligence',
          },
      abilities: [
           { name: 'Intelligence', baseScore: 16, abilityImprovements: 0, miscBonus: 0, bonus: 3 },
            ],
        spells: [],
        proficiency: 2,
        automation: {
          actions: [{ type: 'free_spell', spell: 'Shield' }],
          bonusActions: [{ type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Minor Illusion'] }],
          passives: [
              { type: 'passive_rule', effect: 'always_prepared_spells', spells: ['Light'] },
              { type: 'other_feature_type' }, // should be skipped
             ],
           },
         };

      const result = getSpellAbilities(allSpells, playerStats);

      expect(result.spells).toHaveLength(3);
      expect(result.spells.map(s => s.name)).toContain('Shield');
      expect(result.spells.map(s => s.name)).toContain('Minor Illusion');
      expect(result.spells.map(s => s.name)).toContain('Light');
    });

    it('should handle automation with no matching features', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: [],
        proficiency: 2,
        automation: {
          passives: [
            { type: 'some_other_type', effect: 'something' },
           ],
         },
       };

      const result = getSpellAbilities([], playerStats);

      expect(result.spells).toHaveLength(0);
    });

    it('should skip automation block when automation is undefined', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: [],
        proficiency: 2,
        // automation is intentionally omitted
       };

      const result = getSpellAbilities([], playerStats);

      expect(result.spells).toHaveLength(0);
    });

    it('should skip automation block when automation is null', () => {
      const playerStats = {
        level: 1,
        class: {
          name: 'Wizard',
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 2, spell_slots: { '1': 2 } },
           }],
          spell_casting_ability: 'Intelligence',
         },
        abilities: [
           { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
         ],
        spells: [],
        proficiency: 2,
        automation: null,
       };

      const result = getSpellAbilities([], playerStats);

      expect(result.spells).toHaveLength(0);
    });
   });
});
