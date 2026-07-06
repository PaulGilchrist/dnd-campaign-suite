// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSpellLimits,
  validateSpellSelection,
  getAllSpellLimits,
  resetClassDataCache
} from './spellLimits.js';

// Shared factory helpers to reduce duplicate mock data
const makeSpellcasting = (overrides = {}) => ({
  cantrips_known: 3,
  spell_slots_level_1: 2,
  ...overrides
});

const makeClassData = (overrides = {}) => ({
  name: 'Wizard',
  index: 'wizard',
  class_levels: [
    { level: 1, spellcasting: makeSpellcasting() }
  ],
  ...overrides
});

// Sets up fetch mock for a given class/data and clears the internal cache
// data can be an array (raw class data) or a single class object (from makeClassData)
const setupFetch = (data) => {
  resetClassDataCache();
  const classes = Array.isArray(data) ? data : [data];
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(classes)
  });
};

// Silences console output during tests to keep output clean
const silenceConsole = () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
};

describe('spellLimits', () => {
  beforeEach(() => {
    resetClassDataCache();
  });

  describe('getSpellLimits', () => {
    it('should return default limits for non-spellcasting class', async () => {
      silenceConsole();
      setupFetch(makeClassData({
        name: 'Barbarian',
        index: 'barbarian',
        class_levels: [{ level: 1, spellcasting: null }]
      }));

      const limits = await getSpellLimits('Barbarian', 1, '5e');

      expect(limits).toEqual({
        spellType: 'prepared',
        isNonSpellcaster: true,
        cantrip: 0,
        preparedSpells: 0,
        level1: 0,
        level2: 0,
        level3: 0,
        level4: 0,
        level5: 0,
        level6: 0,
        level7: 0,
        level8: 0,
        level9: 0
      });
    });

    it('should return default limits when class not found or missing class_levels', async () => {
      silenceConsole();
      setupFetch([]);

      const limits = await getSpellLimits('UnknownClass', 1, '5e');

      expect(limits.isNonSpellcaster).toBe(true);
      expect(limits.cantrip).toBe(0);
    });

    it('should return default limits when class data has no class_levels property', async () => {
      silenceConsole();
      setupFetch([{ name: 'Wizard', index: 'wizard' }]);

      const limits = await getSpellLimits('Wizard', 1, '5e');

      expect(limits.isNonSpellcaster).toBe(true);
      expect(limits.cantrip).toBe(0);
    });

    it('should return spell limits for a spellcasting class', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 3, spell_slots_level_1: 2 })
        }]
      }));

      const limits = await getSpellLimits('Wizard', 1, '5e');

      expect(limits.cantrip).toBe(3);
      expect(limits.level1).toBe(2);
      expect(limits.level2).toBe(0);
      expect(limits.spellType).toBe('known');
    });

    it('should find class by index (lowercase)', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 3, spell_slots_level_1: 2 })
        }]
      }));

      const limits = await getSpellLimits('wizard', 1, '5e');

      expect(limits.cantrip).toBe(3);
      expect(limits.level1).toBe(2);
    });

    it('should return default limits when level has no spellcasting', async () => {
      silenceConsole();
      setupFetch(makeClassData({
        name: 'Rogue',
        index: 'rogue',
        class_levels: [
          { level: 1, spellcasting: null },
          { level: 3, spellcasting: null }
        ]
      }));

      const limits = await getSpellLimits('Rogue', 3, '5e');

      expect(limits.isNonSpellcaster).toBe(true);
      expect(limits.cantrip).toBe(0);
    });

    it('should reject 2024 class when required_major mismatch', async () => {
      silenceConsole();
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({
            required_major: 'Abjuration',
            cantrips_known: 3,
            spell_slots_level_1: 2
          })
        }]
      }));

      const limits = await getSpellLimits('Wizard', 1, '2024', 'Conjuration');

      expect(limits.isNonSpellcaster).toBe(true);
      expect(limits.cantrip).toBe(0);
    });

    it('should accept 2024 class when required_major matches', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({
            required_major: 'Abjuration',
            cantrips_known: 3,
            spell_slots_level_1: 2
          })
        }]
      }));

      const limits = await getSpellLimits('Wizard', 1, '2024', 'Abjuration');

      expect(limits.cantrip).toBe(3);
      expect(limits.level1).toBe(2);
    });

    it('should handle fetch errors and non-OK responses gracefully', async () => {
      silenceConsole();
      resetClassDataCache();

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      let limits = await getSpellLimits('Wizard', 1, '5e');
      expect(limits.isNonSpellcaster).toBe(true);
      expect(limits.cantrip).toBe(0);

      global.fetch = vi.fn().mockResolvedValue({ ok: false });
      limits = await getSpellLimits('Wizard', 1, '5e');
      expect(limits.isNonSpellcaster).toBe(true);
      expect(limits.cantrip).toBe(0);
    });

    it('should find spellcasting in subclass features for 2024 when current level lacks it', async () => {
      setupFetch({
        name: 'Rogue',
        index: 'rogue',
        class_levels: [
          { level: 1, spellcasting: null },
          { level: 3, spellcasting: null }
        ],
        subclass: {
          name: 'Arcane Trickster',
          features: [{
            spellcasting: makeSpellcasting({
              cantrips_known: 3,
              spell_slots_level_1: 2
            })
          }]
        }
      });

      const limits = await getSpellLimits('Rogue', 3, '2024', 'Arcane Trickster');

      expect(limits.cantrip).toBe(3);
      expect(limits.level1).toBe(2);
    });

    it('should convert all spell slot levels correctly', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 9,
          spellcasting: makeSpellcasting({
            cantrips_known: 4,
            spell_slots_level_1: 4,
            spell_slots_level_2: 3,
            spell_slots_level_3: 3,
            spell_slots_level_4: 0,
            spell_slots_level_5: 0,
            spell_slots_level_6: 0,
            spell_slots_level_7: 0,
            spell_slots_level_8: 0,
            spell_slots_level_9: 0
          })
        }]
      }));

      const limits = await getSpellLimits('Wizard', 9, '5e');

      expect(limits.cantrip).toBe(4);
      expect(limits.level1).toBe(4);
      expect(limits.level2).toBe(3);
      expect(limits.level3).toBe(3);
      expect(limits.level4).toBe(0);
      expect(limits.level9).toBe(0);
    });

    it('should handle spellcasting with missing optional fields', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: { cantrips_known: 2 }
        }]
      }));

      const limits = await getSpellLimits('Wizard', 1, '5e');

      expect(limits.cantrip).toBe(2);
      expect(limits.level1).toBe(0);
      expect(limits.spellType).toBe('known');
    });

    it('should skip levels with required_major mismatch in findSpellcastingInClass and use fallback', async () => {
      silenceConsole();
      setupFetch({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [
          { level: 1, spellcasting: makeSpellcasting({ cantrips_known: 3, spell_slots_level_1: 2 }) },
          { level: 2, spellcasting: makeSpellcasting({ required_major: 'Evocation', cantrips_known: 4, spell_slots_level_1: 3 }) },
          { level: 3, spellcasting: null }
        ]
      });

      const limits = await getSpellLimits('Wizard', 3, '2024', 'Abjuration');

      expect(limits.cantrip).toBe(3);
      expect(limits.isNonSpellcaster).toBeUndefined();
    });

    it('should skip subclass feature with required_major mismatch', async () => {
      silenceConsole();
      setupFetch({
        name: 'Rogue',
        index: 'rogue',
        class_levels: [
          { level: 1, spellcasting: null },
          { level: 3, spellcasting: null }
        ],
        subclass: {
          name: 'Arcane Trickster',
          features: [
            {
              spellcasting: makeSpellcasting({
                required_major: 'Transmutation',
                cantrips_known: 3,
                spell_slots_level_1: 2
              })
            }
          ]
        }
      });

      const limits = await getSpellLimits('Rogue', 3, '2024', 'Abjuration');

      expect(limits.isNonSpellcaster).toBe(true);
      expect(limits.cantrip).toBe(0);
    });
  });

  describe('validateSpellSelection', () => {
    const mockSpells = [
      { name: 'Fire Bolt', level: 0 },
      { name: 'Magic Missile', level: 1 },
      { name: 'Fireball', level: 3 },
      { name: 'Light', level: 0 },
      { name: 'Shield', level: 1 }
    ];

    it('should return valid when within limits', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 3, spell_slots_level_1: 2 })
        }]
      }));

      const result = await validateSpellSelection(
        ['Fire Bolt', 'Magic Missile'],
        mockSpells,
        'Wizard',
        1,
        '5e'
      );

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.counts.cantrip).toBe(1);
      expect(result.counts.level1).toBe(1);
    });

    it('should allow exactly at cantrip limit and reject when exceeded', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 2, spell_slots_level_1: 2 })
        }]
      }));

      const atLimit = await validateSpellSelection(
        ['Fire Bolt', 'Light'],
        mockSpells,
        'Wizard',
        1,
        '5e'
      );
      expect(atLimit.valid).toBe(true);
      expect(atLimit.violations).toHaveLength(0);

      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 1, spell_slots_level_1: 2 })
        }]
      }));

      const exceeded = await validateSpellSelection(
        ['Fire Bolt', 'Light'],
        mockSpells,
        'Wizard',
        1,
        '5e'
      );
      expect(exceeded.valid).toBe(false);
      expect(exceeded.violations).toContain('Cantrips: 2/1');
    });

    it('should reject when level 1 spell limit is exceeded', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 3, spell_slots_level_1: 1 })
        }]
      }));

      const result = await validateSpellSelection(
        ['Magic Missile', 'Shield'],
        mockSpells,
        'Wizard',
        1,
        '5e'
      );

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('1st level: 2/1');
    });

    it('should report multiple violations across levels', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 1, spell_slots_level_1: 1 })
        }]
      }));

      const result = await validateSpellSelection(
        ['Fire Bolt', 'Light', 'Magic Missile', 'Shield', 'Fireball'],
        mockSpells,
        'Wizard',
        1,
        '5e'
      );

      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(1);
      expect(result.violations).toContain('Cantrips: 2/1');
      expect(result.violations).toContain('1st level: 2/1');
    });

    it('should allow empty, null, and undefined spell selections', async () => {
      setupFetch(makeClassData());

      let result = await validateSpellSelection([], mockSpells, 'Wizard', 1, '5e');
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.counts.cantrip).toBe(0);

      result = await validateSpellSelection(null, mockSpells, 'Wizard', 1, '5e');
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);

      result = await validateSpellSelection(undefined, mockSpells, 'Wizard', 1, '5e');
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should count spells by index when name not found', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 3, spell_slots_level_1: 2 })
        }]
      }));

      const result = await validateSpellSelection(
        ['fire-bolt'],
        [{ index: 'fire-bolt', level: 0 }],
        'Wizard',
        1,
        '5e'
      );

      expect(result.valid).toBe(true);
      expect(result.counts.cantrip).toBe(1);
    });

    it('should ignore spells not in the allSpells lookup', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 3, spell_slots_level_1: 2 })
        }]
      }));

      const result = await validateSpellSelection(
        ['Unknown Spell'],
        mockSpells,
        'Wizard',
        1,
        '5e'
      );

      expect(result.valid).toBe(true);
      expect(result.counts.cantrip).toBe(0);
    });

    it('should detect violations across multiple high spell levels', async () => {
      const highLevelSpells = [
        { name: 'Fire Bolt', level: 0 },
        { name: 'Magic Missile', level: 1 },
        { name: 'Fireball', level: 3 },
        { name: 'Wall of Force', level: 5 },
        { name: 'True Seeing', level: 6 },
        { name: 'Teleport', level: 7 },
        { name: 'Clone', level: 8 },
        { name: 'Wish', level: 9 }
      ];

      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [
          { level: 17, spellcasting: makeSpellcasting({
            cantrips_known: 3,
            spell_slots_level_1: 4,
            spell_slots_level_2: 3,
            spell_slots_level_3: 3,
            spell_slots_level_4: 3,
            spell_slots_level_5: 2,
            spell_slots_level_6: 1,
            spell_slots_level_7: 1,
            spell_slots_level_8: 0,
            spell_slots_level_9: 0
          })}
        ]
      }));

      const result = await validateSpellSelection(
        ['True Seeing', 'Teleport', 'Clone', 'Wish'],
        highLevelSpells,
        'Wizard',
        17,
        '5e'
      );

      expect(result.valid).toBe(false);
      expect(result.violations.some(v =>
        v.includes('6th') || v.includes('7th') || v.includes('8th') || v.includes('9th')
      )).toBe(true);
    });

    it('should allow non-spellcasting classes any selection', async () => {
      silenceConsole();
      setupFetch(makeClassData({
        name: 'Barbarian',
        index: 'barbarian',
        class_levels: [{ level: 1, spellcasting: null }]
      }));

      const result = await validateSpellSelection(
        ['Fire Bolt', 'Light', 'Magic Missile', 'Fireball'],
        mockSpells,
        'Barbarian',
        1,
        '5e'
      );

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should handle spell objects with missing level property', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 3, spell_slots_level_1: 2 })
        }]
      }));

      const result = await validateSpellSelection(
        ['Mystery Spell'],
        [{ name: 'Mystery Spell' }],
        'Wizard',
        1,
        '5e'
      );

      expect(result.valid).toBe(true);
      expect(result.counts.cantrip).toBe(1);
    });

    it('should handle duplicate spell names in selection', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({ cantrips_known: 3, spell_slots_level_1: 2 })
        }]
      }));

      const result = await validateSpellSelection(
        ['Fire Bolt', 'Fire Bolt'],
        mockSpells,
        'Wizard',
        1,
        '5e'
      );

      // Duplicate spell names count twice
      expect(result.counts.cantrip).toBe(2);
    });

    it('should validate prepared spell type (total non-cantrip limit)', async () => {
      setupFetch(makeClassData({
        name: 'Cleric',
        index: 'cleric',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({
            spell_type: 'prepared',
            prepared_spells: 1,
            spell_slots_level_1: 2
          })
        }]
      }));

      const result = await validateSpellSelection(
        ['Magic Missile', 'Fireball', 'Light'],
        mockSpells,
        'Cleric',
        1,
        '5e'
      );

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('Prepared spells: 2/1');
      expect(result.counts.cantrip).toBe(1);
    });

    it('should allow prepared spell class when within prepared spell limit', async () => {
      setupFetch(makeClassData({
        name: 'Cleric',
        index: 'cleric',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({
            spell_type: 'prepared',
            prepared_spells: 3,
            spell_slots_level_1: 2
          })
        }]
      }));

      const result = await validateSpellSelection(
        ['Magic Missile', 'Fireball', 'Light'],
        mockSpells,
        'Cleric',
        1,
        '5e'
      );

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should handle prepared spell class exceeding both cantrip and prepared limits', async () => {
      setupFetch(makeClassData({
        name: 'Cleric',
        index: 'cleric',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({
            spell_type: 'prepared',
            cantrips_known: 1,
            prepared_spells: 1,
            spell_slots_level_1: 2
          })
        }]
      }));

      const result = await validateSpellSelection(
        ['Fire Bolt', 'Light', 'Magic Missile', 'Fireball'],
        mockSpells,
        'Cleric',
        1,
        '5e'
      );

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('Cantrips: 2/1');
      expect(result.violations).toContain('Prepared spells: 2/1');
    });

    it('should skip prepared spell check when not a prepared type class', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: [{
          level: 1,
          spellcasting: makeSpellcasting({
            spell_type: 'known',
            cantrips_known: 3,
            prepared_spells: 5,
            spell_slots_level_1: 2
          })
        }]
      }));

      const level1Spells = [
        { name: 'Magic Missile', level: 1 },
        { name: 'Shield', level: 1 }
      ];

      const result = await validateSpellSelection(
        ['Magic Missile', 'Shield'],
        level1Spells,
        'Wizard',
        1,
        '5e'
      );

      expect(result.valid).toBe(true);
      expect(result.violations).not.toContain('Prepared spells: 2/5');
    });
  });

  describe('getAllSpellLimits', () => {
    it('should return limits for all 20 levels', async () => {
      setupFetch(makeClassData({
        name: 'Wizard',
        index: 'wizard',
        class_levels: Array.from({ length: 20 }, (_, i) => ({
          level: i + 1,
          spellcasting: makeSpellcasting({
            cantrips_known: 3,
            spell_slots_level_1: 2
          })
        }))
      }));

      const limits = await getAllSpellLimits('Wizard', '5e');

      expect(Object.keys(limits)).toHaveLength(20);
      expect(limits[1]).toBeDefined();
      expect(limits[20]).toBeDefined();
      expect(limits[1].cantrip).toBe(3);
      expect(limits[10].cantrip).toBe(3);
      expect(limits[20].cantrip).toBe(3);
    });

    it('should return default limits for each level when fetch fails', async () => {
      silenceConsole();
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const limits = await getAllSpellLimits('Wizard', '5e');

      expect(Object.keys(limits)).toHaveLength(20);
      expect(limits[1].cantrip).toBe(0);
      expect(limits[20].cantrip).toBe(0);
      expect(limits[1].isNonSpellcaster).toBe(true);
    });
  });
});
