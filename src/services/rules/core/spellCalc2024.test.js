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
      class_levels: [{ level: 1, spellcasting: { cantrips_known: 3, spell_slots: { '1': 2 } } }],
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
  // References to mocked functions (set in beforeEach via dynamic import)
  let mockGetRuntimeValue;
  let mockGetHighestMajorLevel;

  beforeEach(async () => {
    vi.resetAllMocks();
    const runtimeState = await import('../../../hooks/runtime/useRuntimeState.js');
    const classRules2024 = await import('../../character/classRules2024.js');

    mockGetRuntimeValue = runtimeState.getRuntimeValue;
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
      expect(result.spell_slots).toEqual({ '1': 2 });
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

    // ── Path of the Wild Heart ──

    it('returns null for Barbarian without Path of the Wild Heart major', () => {
      mockGetHighestMajorLevel.mockReturnValue(undefined);

      const stats = makePlayerStats({
        level: 3,
        class: {
          name: 'Barbarian',
          class_levels: [{ level: 3 }],
          major: { name: 'Path of the Berserker' },
        },
        abilities: [{ name: 'Strength', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });

      const result = getSpellAbilities([], stats);
      expect(result).toBeNull();
    });

    it('grants spellcasting for Path of the Wild Heart Barbarian at level 3', () => {
      mockGetHighestMajorLevel.mockReturnValue({
        spellcasting: {
          cantrips_known: 0,
          spells_known: 0,
          spell_slots_level_1: 2,
          spell_slots_level_2: 0,
          spell_slots_level_3: 0,
          spell_slots_level_4: 0,
          spell_type: 'known',
        },
      });

      const stats = makePlayerStats({
        level: 3,
        class: {
          name: 'Barbarian',
          class_levels: [{ level: 3 }],
          major: {
            name: 'Path of the Wild Heart',
            spell_casting_ability: 'Wisdom',
            spells: [
              { name: 'Speak with Animals', level: 1 },
              { name: 'Beast Sense', level: 2 },
            ],
          },
        },
        abilities: [{ name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });

      const result = getSpellAbilities([], stats);

      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(0);
      expect(result.spellCastingAbility).toBe('Wisdom');
      expect(result.modifier).toBe(3);
      expect(result.toHit).toBe(5);
      expect(result.saveDc).toBe(13);
      expect(result.spell_slots_level_1).toBe(2);
    });

    it('overrides casting_time to Ritual for Beast Sense and Speak with Animals', () => {
      mockGetHighestMajorLevel.mockReturnValue({
        spellcasting: {
          cantrips_known: 0,
          spells_known: 0,
          spell_slots_level_1: 2,
          spell_type: 'known',
        },
      });

      const allSpells = [
        makeSpell('Speak with Animals', 1, { casting_time: 'Action or Ritual' }),
        makeSpell('Beast Sense', 2, { casting_time: 'Action or Ritual' }),
      ];

      const stats = makePlayerStats({
        level: 3,
        class: {
          name: 'Barbarian',
          class_levels: [{ level: 3 }],
          major: {
            name: 'Path of the Wild Heart',
            spell_casting_ability: 'Wisdom',
            spells: [
              { name: 'Speak with Animals', level: 1 },
              { name: 'Beast Sense', level: 2 },
            ],
          },
        },
        abilities: [{ name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });

      const result = getSpellAbilities(allSpells, stats);

      const speakWithAnimals = result.spells.find(s => s.name === 'Speak with Animals');
      expect(speakWithAnimals.casting_time).toBe('Ritual');
      const beastSense = result.spells.find(s => s.name === 'Beast Sense');
      expect(beastSense.casting_time).toBe('Ritual');
    });

    it('adds Commune with Nature from Nature Speaker at level 10', () => {
      mockGetHighestMajorLevel.mockReturnValue({
        spellcasting: {
          cantrips_known: 0,
          spells_known: 0,
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 2,
          spell_slots_level_4: 0,
          spell_type: 'known',
        },
      });

      const allSpells = [
        makeSpell('Commune with Nature', 5, { casting_time: '1 minute or Ritual' }),
      ];

      const stats = makePlayerStats({
        level: 10,
        class: {
          name: 'Barbarian',
          class_levels: [{ level: 10 }],
          major: {
            name: 'Path of the Wild Heart',
            spell_casting_ability: 'Wisdom',
            spells: [
              { name: 'Speak with Animals', level: 1 },
              { name: 'Beast Sense', level: 2 },
              { name: 'Commune with Nature', level: 10 },
            ],
          },
        },
        abilities: [{ name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Commune with Nature');
      const communeWithNature = result.spells.find(s => s.name === 'Commune with Nature');
      expect(communeWithNature.casting_time).toBe('Ritual');
    });

    it('does not add Commune with Nature when level < 10', () => {
      mockGetHighestMajorLevel.mockReturnValue({
        spellcasting: {
          cantrips_known: 0,
          spells_known: 0,
          spell_slots_level_1: 2,
          spell_type: 'known',
        },
      });

      const allSpells = [
        makeSpell('Commune with Nature', 5),
      ];

      const stats = makePlayerStats({
        level: 6,
        class: {
          name: 'Barbarian',
          class_levels: [{ level: 6 }],
          major: {
            name: 'Path of the Wild Heart',
            spell_casting_ability: 'Wisdom',
            spells: [
              { name: 'Speak with Animals', level: 1 },
              { name: 'Beast Sense', level: 2 },
              { name: 'Commune with Nature', level: 10 },
            ],
          },
        },
        abilities: [{ name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
      });

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).not.toContain('Commune with Nature');
    });

    it('works for level 20 Barbarian with spellcasting on every class level', () => {
      mockGetHighestMajorLevel.mockReturnValue(undefined);

      const allSpells = [
        makeSpell('Speak with Animals', 1, { casting_time: 'Action or Ritual' }),
        makeSpell('Beast Sense', 2, { casting_time: 'Action or Ritual' }),
        makeSpell('Commune with Nature', 5, { casting_time: '1 minute or Ritual' }),
      ];

      const stats = makePlayerStats({
        level: 20,
        class: {
          name: 'Barbarian',
          class_levels: [
            { level: 1, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 2, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 3, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 2, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 4, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 5, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 6, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 4, spell_slots_level_2: 2, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 7, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 8, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 9, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 10, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 2, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 11, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 12, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 13, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 14, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spell_slots_level_4: 1, spell_type: 'known' } },
            { level: 15, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 16, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 17, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 18, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 19, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_type: 'known' } },
            { level: 20, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spell_slots_level_4: 1, spell_type: 'known' } },
          ],
          major: {
            name: 'Path of the Wild Heart',
            spell_casting_ability: 'Wisdom',
            spells: [
              { name: 'Speak with Animals', level: 1 },
              { name: 'Beast Sense', level: 2 },
              { name: 'Commune with Nature', level: 10 },
            ],
          },
        },
        abilities: [{ name: 'Wisdom', baseScore: 20, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 5 }],
        proficiency: 6,
      });

      const result = getSpellAbilities(allSpells, stats);

      expect(result).not.toBeNull();
      expect(result.spellCastingAbility).toBe('Wisdom');
      expect(result.modifier).toBe(5);
      expect(result.saveDc).toBe(19);
      expect(result.spell_slots_level_4).toBe(1);
      const names = result.spells.map(s => s.name);
      expect(names).toContain('Speak with Animals');
      expect(names).toContain('Beast Sense');
      expect(names).toContain('Commune with Nature');
      expect(result.spells.find(s => s.name === 'Speak with Animals').casting_time).toBe('Ritual');
      expect(result.spells.find(s => s.name === 'Beast Sense').casting_time).toBe('Ritual');
      expect(result.spells.find(s => s.name === 'Commune with Nature').casting_time).toBe('Ritual');
    });

    // ── Spell mapping and sorting ──

    it('maps spell names to spell details with prepared=Always for all levels', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { damage_type: 'Fire' }),
        makeSpell('Magic Missile', 1, { damage_type: 'Force' }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt', 'Magic Missile'];

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells).toHaveLength(2);
      const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
      expect(fireBolt.prepared).toBe('Always');
      expect(fireBolt.level).toBe(0);
      const magicMissile = result.spells.find(s => s.name === 'Magic Missile');
      expect(magicMissile.prepared).toBe('Always');
      expect(magicMissile.level).toBe(1);
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

    // ── Automation: passive_rule (always_prepared_spells) ──

    it('adds always_prepared_spells from automation passives when feature name matches a major feature', () => {
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
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Draconic Spells', spells: ['Light'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt', 'Light']);
    });

    it('skips always_prepared_spells when feature name does not match major features', () => {
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
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Psionic Spells', spells: ['Light'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt']);
    });

    it('skips passive_rule when spells array is missing', () => {
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'passive_rule', effect: 'always_prepared_spells' }],
      };

      const result = getSpellAbilities([], stats);

      expect(result.spells).toHaveLength(0);
    });

    // ── Automation: free_spell and fey_reinforcements ──

    it('adds a free_spell from automation passives', () => {
      const allSpells = [makeSpell('Prestidigitation', 0)];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'free_spell', spell: 'Prestidigitation' }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toContain('Prestidigitation');
    });

    it('adds multiple spells from an array free_spell', () => {
      const allSpells = [
        makeSpell('Shield of Faith', 1),
        makeSpell('Spiritual Weapon', 2),
      ];
      const stats = makePlayerStats({
        class: {
          name: 'Cleric',
          class_levels: [{ level: 1, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4 } } }],
          spell_casting_ability: 'Wisdom',
        },
        abilities: [{ name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        proficiency: 3,
      });
      stats.automation = {
        passives: [{ type: 'free_spell', spell: ['Shield of Faith', 'Spiritual Weapon'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Shield of Faith', 'Spiritual Weapon']);
    });

    // ── Automation: spell_breaker ──

    it('adds alwaysPreparedSpells from spell_breaker', () => {
      const allSpells = [makeSpell('Shield', 1)];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'spell_breaker', alwaysPreparedSpells: ['Shield'] }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toContain('Shield');
    });

    // ── Automation: cantrip_spellcasting_ability ──

    it('adds cantrip_spellcasting_ability cantrip even when not in spell list', () => {
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        actions: [{ type: 'cantrip_spellcasting_ability', cantripName: 'Light', spellcastingAbility: 'Charisma' }],
      };

      const result = getSpellAbilities([], stats);

      const light = result.spells.find(s => s.name === 'Light');
      expect(light).toEqual({ name: 'Light', prepared: 'Always', spellCastingAbility: 'Charisma' });
    });

    // ── Automation: elfish_lineage ──

    it('adds elfish lineage cantrip, level 3, and level 5 spells when lineage matches', () => {
      const allSpells = [
        makeSpell('Blade Ward', 0),
        makeSpell('Burning Hands', 1),
        makeSpell('Crown of Madness', 1),
      ];

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{
          type: 'elfish_lineage',
          options: [{ name: 'Shadow Magic', spellcastingAbility: 'Charisma', cantrip: 'Blade Ward', level3Spell: 'Burning Hands', level5Spell: 'Crown of Madness' }],
        }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Elf', subrace: { name: 'Shadow Magic' } } });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Blade Ward');
      expect(names).toContain('Burning Hands');
      expect(names).toContain('Crown of Madness');
    });

    it('does not add elfish lineage spells when lineage does not match', () => {
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{
          type: 'elfish_lineage',
          options: [{ name: 'Shadow Magic', spellcastingAbility: 'Charisma', cantrip: 'Blade Ward' }],
        }],
      };

      const result = getSpellAbilities([], stats, { campaignName: 'TestCampaign', race: { name: 'Elf', subrace: { name: 'Wood Elf' } } });

      expect(result.spells).toHaveLength(0);
    });

    // ── Automation: gnomish_lineage ──

    it('adds gnomish lineage spells when lineage matches', () => {
      const allSpells = [
        makeSpell('Friends', 0),
        makeSpell('Web', 1),
        makeSpell('Hold Monster', 1),
      ];

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{
          type: 'gnomish_lineage',
          options: [{ name: 'Deep Gnome', spellcastingAbility: 'Intelligence', cantrip: 'Friends', level3Spell: 'Web', level5Spell: 'Hold Monster' }],
        }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Gnome', subrace: { name: 'Deep Gnome' } } });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Friends');
      expect(names).toContain('Web');
      expect(names).toContain('Hold Monster');
    });

    // ── Automation: fiendish_legacy ──

    it('adds fiendish legacy spells when legacy matches', () => {
      const allSpells = [
        makeSpell('Infestation', 0),
        makeSpell('Scorching Ray', 1),
        makeSpell('Dominate Person', 1),
      ];

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{
          type: 'fiendish_legacy',
          options: [{ name: 'Fiend', spellcastingAbility: 'Charisma', cantrip: 'Infestation', level3Spell: 'Scorching Ray', level5Spell: 'Dominate Person' }],
        }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Tiefling', subrace: { name: 'Fiend Tiefling' } } });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Infestation');
      expect(names).toContain('Scorching Ray');
      expect(names).toContain('Dominate Person');
    });

    it('creates spellAbilities for non-spellcasting character with fiendish legacy', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0),
        makeSpell('Hellish Rebuke', 1),
        makeSpell('Darkness', 2),
      ];

      const stats = makePlayerStats({
        class: {
          name: 'Fighter',
          class_levels: [{ level: 3 }],
        },
        abilities: [
          { name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
        ],
        automation: {
          specialActions: [{
            type: 'fiendish_legacy',
            options: [{ name: 'Infernal', spellcastingAbility: 'Charisma', cantrip: 'Fire Bolt', level3Spell: 'Hellish Rebuke', level5Spell: 'Darkness' }],
          }],
        },
      });

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign', race: { name: 'Tiefling', subrace: { name: 'Infernal Tiefling' } } });

      expect(result).not.toBeNull();
      const names = result.spells.map(s => s.name);
      expect(names).toContain('Fire Bolt');
      expect(names).toContain('Hellish Rebuke');
      expect(names).toContain('Darkness');
      expect(result.spellCastingAbility).toBe('Charisma');
      expect(result.cantrips_known).toBe(1);
      expect(result.spells_known).toBe(2);
      expect(result.modifier).toBe(3);
      expect(result.toHit).toBe(5);
      expect(result.saveDc).toBe(13);
    });

    // ── Automation: runtime-state features (Spell Mastery, Savants, Signature Spells) ──

    it('adds Spell Mastery level 1 and level 2 spells from runtime state', () => {
      const allSpells = [
        makeSpell('Shield', 1),
        makeSpell('Web', 1),
      ];
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'SpellMastery_level1') return 'Shield';
        if (prop === 'SpellMastery_level2') return 'Web';
        return null;
      });

      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'spell_mastery' }],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Shield');
      expect(names).toContain('Web');
    });

    it('deduplicates Spell Mastery spells already known', () => {
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'SpellMastery_level1') return 'Fire Bolt';
        return null;
      });

      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        passives: [{ type: 'spell_mastery' }],
      };

      const result = getSpellAbilities([], stats, { campaignName: 'TestCampaign' });

      expect(result.spells.filter(s => s.name === 'Fire Bolt').length).toBe(1);
    });

    it('adds Savant and Signature spells from runtime state', () => {
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === '_Abjuration_Savant_selection') return ['Shield'];
        if (prop === '_Divination_Savant_selection') return ['Detect Magic'];
        if (prop === '_Illusion_Savant_selection') return ['Minor Illusion'];
        if (prop === 'SignatureSpells_selection') return ['Shield'];
        return null;
      });

      const allSpells = [
        makeSpell('Shield', 1),
        makeSpell('Detect Magic', 1),
        makeSpell('Minor Illusion', 0),
      ];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [
          { type: 'abjuration_savant' },
          { type: 'divination_savant' },
          { type: 'illusion_savant' },
          { type: 'signature_spells' },
        ],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Shield');
      expect(names).toContain('Detect Magic');
      expect(names).toContain('Minor Illusion');
      // Shield is already deduplicated (from abjuration_savant + signature_spells)
      expect(result.spells.filter(s => s.name === 'Shield').length).toBe(1);
    });

    // ── Automation: Phantasmal Creatures ──

    it('adds phantasmal creatures always prepared spells', () => {
      const allSpells = [
        makeSpell('Summon Beast', 1),
        makeSpell('Summon Fey', 1),
      ];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [
          { type: 'phantasmal_creatures', alwaysPreparedSpells: ['Summon Beast', 'Summon Fey'] },
        ],
      };

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Summon Beast');
      expect(names).toContain('Summon Fey');
    });

    // ── Automation: Improved Illusions ──

    it('adds Minor Illusion from Improved Illusions when not already known', () => {
      const allSpells = [makeSpell('Minor Illusion', 0, { casting_time: '1 action' })];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [{ type: 'improved_illusions' }],
      };

      const result = getSpellAbilities(allSpells, stats);

      const minorIllusion = result.spells.find(s => s.name === 'Minor Illusion');
      expect(minorIllusion).toBeDefined();
      expect(minorIllusion.casting_time).toBe('1 action');
    });

    // ── Automation: Ritual Adept ──

    it('adds ritual-tagged spells from spellbook when Ritual Adept is present', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { ritual: false }),
        makeSpell('Alarm', 1, { ritual: true }),
        makeSpell('Find Familiar', 1, { ritual: true }),
        makeSpell('Detect Magic', 1, { ritual: true, classes: ['Bard', 'Cleric'] }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        ritualSpells: [{ type: 'passive_rule', effect: 'ritual_spells', name: 'Ritual Adept', hasAutomation: true }],
      };

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Fire Bolt');
      expect(names).toContain('Alarm');
      expect(names).toContain('Find Familiar');
      expect(names).toContain('Detect Magic');
    });

    it('deduplicates ritual spells already in known list', () => {
      const allSpells = [makeSpell('Alarm', 1, { ritual: true })];
      const stats = makePlayerStats();
      stats.spells = ['Alarm'];
      stats.automation = {
        ritualSpells: [{ type: 'passive_rule', effect: 'ritual_spells', name: 'Ritual Adept', hasAutomation: true }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.filter(s => s.name === 'Alarm').length).toBe(1);
    });

    it('does not add ritual spells when ritualSpells array is empty', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { ritual: false }),
        makeSpell('Alarm', 1, { ritual: true }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = { ritualSpells: [] };

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).not.toContain('Alarm');
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

    // ── Mixed automation ──

    it('handles mixed automation features across all three arrays', () => {
      const allSpells = [
        makeSpell('Shield', 1),
        makeSpell('Minor Illusion', 1),
        makeSpell('Light', 0),
      ];
      const stats = makePlayerStats();
      stats.class.major = {
        name: 'Order',
        features: [
          { name: 'Minor Illusion Feature' },
          { name: 'Light Feature' },
        ],
      };
      stats.automation = {
        actions: [{ type: 'free_spell', spell: 'Shield' }],
        bonusActions: [{ type: 'passive_rule', effect: 'always_prepared_spells', name: 'Minor Illusion Feature', spells: ['Minor Illusion'] }],
        passives: [
          { type: 'passive_rule', effect: 'always_prepared_spells', name: 'Light Feature', spells: ['Light'] },
          { type: 'other_feature_type' },
        ],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result).not.toBeNull();
      expect(result.spells.map(s => s.name)).toEqual(['Light', 'Minor Illusion', 'Shield']);
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

    // ── Final sort after automation adds spells ──

    it('sorts spells correctly after automation adds spells at various levels', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0),
        makeSpell('Light', 0),
        makeSpell('Shield', 1),
        makeSpell('Magic Missile', 1),
      ];
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
      stats.spells = ['Magic Missile', 'Fire Bolt'];
      stats.automation = {
        passives: [
          { type: 'passive_rule', effect: 'always_prepared_spells', name: 'Draconic Spells', spells: ['Light'] },
          { type: 'free_spell', spell: 'Shield' },
        ],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt', 'Light', 'Magic Missile', 'Shield']);
    });

    // ── Automation: psionic_spells_list ──

    it('adds psionic_spells_list when feature name matches a major feature', () => {
      const allSpells = [
        makeSpell('Mind Sliver', 0),
        makeSpell('Detect Thoughts', 1),
      ];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 3 } } }],
          spell_casting_ability: 'Charisma',
          major: {
            name: 'Aberrant Sorcery',
            features: [
              { name: 'Psionic Spells' },
              { name: 'Telepathic Speech' },
            ],
          },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        automation: {
          passives: [
            { type: 'psionic_spells_list', name: 'Psionic Spells', psionicSpells: ['Mind Sliver', 'Detect Thoughts'] },
          ],
        },
      });

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Mind Sliver');
      expect(names).toContain('Detect Thoughts');
    });

    it('skips psionic_spells_list when feature name does not match major features', () => {
      const allSpells = [
        makeSpell('Mind Sliver', 0),
        makeSpell('Detect Thoughts', 1),
      ];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 3 } } }],
          spell_casting_ability: 'Charisma',
          major: {
            name: 'Draconic Sorcery',
            features: [
              { name: 'Draconic Resilience' },
              { name: 'Draconic Spells' },
            ],
          },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        automation: {
          passives: [
            { type: 'psionic_spells_list', name: 'Psionic Spells', psionicSpells: ['Mind Sliver', 'Detect Thoughts'] },
          ],
        },
      });

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).not.toContain('Mind Sliver');
      expect(names).not.toContain('Detect Thoughts');
    });

    it('skips psionic_spells_list when major has no features array', () => {
      const allSpells = [makeSpell('Mind Sliver', 0)];
      const stats = makePlayerStats({
        class: {
          name: 'Sorcerer',
          class_levels: [{ level: 3, spellcasting: { cantrips_known: 4, spell_slots: { '1': 4, '2': 3 } } }],
          spell_casting_ability: 'Charisma',
          major: {
            name: 'Draconic Sorcery',
          },
        },
        abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 }],
        automation: {
          passives: [
            { type: 'psionic_spells_list', name: 'Psionic Spells', psionicSpells: ['Mind Sliver'] },
          ],
        },
      });

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).not.toContain('Mind Sliver');
    });
  });
});
