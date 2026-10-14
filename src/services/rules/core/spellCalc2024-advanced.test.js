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

describe('spellCalc2024-advanced', () => {
  let mockGetHighestMajorLevel;

  beforeEach(async () => {
    vi.resetAllMocks();
    await import('../../../hooks/runtime/useRuntimeState.js');
    const classRules2024 = await import('../../character/classRules2024.js');
    mockGetHighestMajorLevel = classRules2024.default.getHighestMajorLevel;
  });

  describe('getSpellAbilities', () => {
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
          spell_slots_level_2: 2,
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
          spell_slots_level_5: 1,
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
            { level: 20, spellcasting: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spell_slots_level_4: 1, spell_slots_level_5: 1, spell_type: 'known' } },
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
  });
});
