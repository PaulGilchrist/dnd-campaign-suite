import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

// ── Module-level mocks for all ESM dependencies ──
vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, _prop) => null),
}));

// ── Helpers ──

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCharacter',
    level: 1,
    proficiency: 2,
    class: {
      name: 'Wizard',
      class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots_level_1: 2, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_slots_level_5: 0, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spell_type: 'prepared' } }],
      spell_casting_ability: 'Intelligence',
      ...overrides.class,
    },
    abilities: [
      { name: 'Intelligence', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
    ],
    spells: [],
    automation: {},
    ...overrides,
  };
}

function makeSpell(name, level = 0, extra = {}) {
  return { name, level, damage: {}, casting_time: '1 action', range: 'Self', ...extra };
}

describe('spellCalc2024', () => {
  let mockGetHighestMajorLevel;

  beforeEach(async () => {
    vi.resetAllMocks();
    await import('../../../hooks/runtime/useRuntimeState.js');
    const classRules2024 = await import('../../character/classRules2024.js');
    mockGetHighestMajorLevel = classRules2024.default.getHighestMajorLevel;
  });

  describe('getSpellAbilities', () => {
    // ── Null / no spellcasting paths ──

    it('returns null when player has no class_levels', () => {
      const stats = makePlayerStats({ class: { class_levels: [] } });
      const result = getSpellAbilities([], stats);
      expect(result).toBeNull();
    });

    it('returns null when class level has no spellcasting and getHighestMajorLevel returns nothing', () => {
      mockGetHighestMajorLevel.mockReturnValue(undefined);

      const stats = makePlayerStats({
        class: { class_levels: [{ level: 1 }] },
      });
      const result = getSpellAbilities([], stats);
      expect(result).toBeNull();
    });

    it('returns null when required_major does not match major name or subclass name', () => {
      const stats = makePlayerStats({
        class: {
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 }, required_major: 'Evoker' },
          }],
          major: { name: 'Necromancer' },
        },
      });
      const result = getSpellAbilities([], stats);
      expect(result).toBeNull();
    });

    // ── Successful spellcasting resolution ──

    it('returns spell abilities from class level spellcasting', () => {
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];

      const result = getSpellAbilities([makeSpell('Fire Bolt')], stats);

      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(3);
      expect(result.spell_slots_level_1).toBe(2);
      expect(result.spellCastingAbility).toBe('Intelligence');
      expect(result.modifier).toBe(3);
      expect(result.toHit).toBe(5);
      expect(result.saveDc).toBe(13);
      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Fire Bolt');
    });

    it('returns spell abilities when required_major matches major name', () => {
      const stats = makePlayerStats({
        class: {
          class_levels: [{
            level: 1,
            spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 }, required_major: 'Evoker' },
          }],
          major: { name: 'Evoker' },
          spell_casting_ability: 'Intelligence',
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result).not.toBeNull();
      expect(result.spellCastingAbility).toBe('Intelligence');
    });

    it('falls back to getHighestMajorLevel when class_levels lack spellcasting', () => {
      mockGetHighestMajorLevel.mockReturnValue({
        spellcasting: { cantrips_known: 2, spell_slots: { '1': 1 } },
      });

      const stats = makePlayerStats({
        class: {
          class_levels: [{ level: 1 }],
          major: { name: 'Evoker', spellcasting: { cantrips_known: 2, spell_slots: { '1': 1 } } },
        },
      });
      const result = getSpellAbilities([], stats);

      expect(mockGetHighestMajorLevel).toHaveBeenCalledWith(stats);
      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(2);
    });

    it('falls back to class.major.spellcasting when class_levels and getHighestMajorLevel have none', () => {
      const stats = makePlayerStats({
        class: {
          class_levels: [{ level: 1 }],
          major: { spell_casting_ability: 'Intelligence', spellcasting: { cantrips_known: 1, spell_slots: {} } },
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(1);
    });

    // ── Class order bonuses ──

    it('grants +1 cantrip for Divine Order Thaumaturge Cleric', () => {
      const stats = makePlayerStats({
        class: {
          name: 'Cleric',
          divineOrder: 'Thaumaturge',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: {} } }],
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result.cantrips_known).toBe(4);
    });

    it('does not grant Thaumaturge bonus to non-Cleric', () => {
      const stats = makePlayerStats({
        class: {
          name: 'Wizard',
          divineOrder: 'Thaumaturge',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: {} } }],
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result.cantrips_known).toBe(3);
    });

    it('grants +1 cantrip for Primal Order Magician Druid', () => {
      const stats = makePlayerStats({
        class: {
          name: 'Druid',
          primalOrder: 'Magician',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 2, spell_slots: {} } }],
        },
      });
      const result = getSpellAbilities([], stats);

      expect(result.cantrips_known).toBe(3);
    });

    // ── Arcane Trickster ──

    it('adds Mage Hand and +3 cantrips for Arcane Trickster', () => {
      const stats = makePlayerStats({
        class: {
          name: 'Rogue',
          major: { name: 'Arcane Trickster' },
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: {}, spells: [] } }],
          spell_casting_ability: 'Intelligence',
        },
        abilities: [{ name: 'Intelligence', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        spells: ['Mage Hand'],
      });
      const result = getSpellAbilities([], stats);

      expect(result.cantrips_known).toBe(6);
      const mageHand = result.spells.find(s => s.name === 'Mage Hand');
      expect(mageHand).toBeDefined();
    });

    // ── Spell mapping and sorting ──

    it('maps spell names to spell details: wizard cantrips Always, level 1+ Prepared, and sets maxPreparedSpells', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { damage_type: 'Fire' }),
        makeSpell('Magic Missile', 1, { damage_type: 'Force' }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt', 'Magic Missile'];
      stats.class.class_levels = [{ level: 1, spellcasting: { cantrips_known: 3, prepared_spells: 4, spell_slots_level_1: 2, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_slots_level_5: 0, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spell_type: 'prepared' } }];

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells).toHaveLength(2);
      const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
      expect(fireBolt.prepared).toBe('Always');
      expect(fireBolt.level).toBe(0);
      const magicMissile = result.spells.find(s => s.name === 'Magic Missile');
      expect(magicMissile.prepared).toBe('Prepared');
      expect(magicMissile.level).toBe(1);
      expect(result.maxPreparedSpells).toBe(4);
    });

    it('marks all spells Always prepared for non-wizard 2024 classes', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { damage_type: 'Fire' }),
        makeSpell('Magic Missile', 1, { damage_type: 'Force' }),
      ];
      const stats = makePlayerStats();
      stats.class.name = 'Cleric';
      stats.spells = ['Fire Bolt', 'Magic Missile'];

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.find(s => s.name === 'Fire Bolt').prepared).toBe('Always');
      expect(result.spells.find(s => s.name === 'Magic Missile').prepared).toBe('Always');
      expect(result.maxPreparedSpells).toBeUndefined();
    });

    it('sorts spells by level ascending then name alphabetically', () => {
      const allSpells = [
        makeSpell('Acid Splash', 0),
        makeSpell('Fire Bolt', 0),
        makeSpell('Shield', 1),
        makeSpell('Magic Missile', 1),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Shield', 'Fire Bolt', 'Magic Missile', 'Acid Splash'];

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Acid Splash', 'Fire Bolt', 'Magic Missile', 'Shield']);
    });

    it('uses missing ability fallback values (modifier=0, toHit=proficiency, saveDc=8+proficiency)', () => {
      const stats = makePlayerStats({
        abilities: [{ name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 0 }],
      });

      const result = getSpellAbilities([], stats);

      expect(result.modifier).toBe(0);
      expect(result.toHit).toBe(2);
      expect(result.saveDc).toBe(10);
    });

    // ── Subclass (major) spells ──

    it('adds subclass spells when level > 2 and level >= spell level', () => {
      const stats = makePlayerStats({
        level: 3,
        class: {
          class_levels: [
            { level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 2, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 2 } } },
          ],
          spell_casting_ability: 'Intelligence',
          major: {
            name: 'School of Evocation',
            spells: [
              { name: 'Lightning Bolt', level: 3 },
              { name: 'Mage Hand', level: 1 },
            ],
          },
        },
      });
      stats.spells = [];

      const result = getSpellAbilities([], stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Mage Hand');
      expect(names).toContain('Lightning Bolt');
    });

    it('does not add subclass spells when level <= 2', () => {
      const stats = makePlayerStats({
        level: 2,
        class: {
          class_levels: [
            { level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
            { level: 2, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } },
          ],
          spell_casting_ability: 'Intelligence',
          major: {
            name: 'School of Evocation',
            spells: [{ name: 'Mage Hand', level: 1 }],
          },
        },
      });
      stats.spells = [];

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
    });

    // ── Casting ability from major ──

    it('uses major.spell_casting_ability when class does not have one', () => {
      const stats = makePlayerStats({
        class: {
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } }],
          spell_casting_ability: undefined,
          major: { spell_casting_ability: 'Charisma' },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });

      const result = getSpellAbilities([], stats);

      expect(result.spellCastingAbility).toBe('Charisma');
      expect(result.modifier).toBe(3);
    });

    // ── Null safety ──

    it('handles automation with missing actions/bonusActions arrays', () => {
      const allSpells = [makeSpell('Light', 0)];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 2 } } }],
          spell_casting_ability: 'Charisma',
          major: {
            name: 'Draconic Sorcery',
            features: [{ name: 'Draconic Spells' }],
          },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Draconic Spells', spells: ['Light'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toContain('Light');
    });

    it('handles automation with empty sub-arrays or no matching feature types', () => {
      const stats = makePlayerStats();
      stats.automation = {
        actions: [],
        bonusActions: [],
        passives: [{ type: 'some_other_type', effect: 'something' }],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
    });

    it('handles automation that is undefined or null', () => {
      expect(() => getSpellAbilities([], makePlayerStats({ automation: undefined }))).not.toThrow();
      expect(() => getSpellAbilities([], makePlayerStats({ automation: null }))).not.toThrow();
    });

    // ── Unknown spell handling ──

    it('handles spell not found in allSpells gracefully (no detail to merge)', () => {
      const allSpells = [makeSpell('Fire Bolt', 0)];
      const stats = makePlayerStats();
      stats.spells = ['Unknown Spell'];

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Unknown Spell');
    });
  });
});
