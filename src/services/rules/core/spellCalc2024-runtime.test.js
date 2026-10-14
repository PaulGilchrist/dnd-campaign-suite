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

describe('spellCalc2024-runtime', () => {
  let mockGetRuntimeValue;

  beforeEach(async () => {
    vi.resetAllMocks();
    const runtimeState = await import('../../../hooks/runtime/useRuntimeState.js');
    mockGetRuntimeValue = runtimeState.getRuntimeValue;
  });

  describe('getSpellAbilities', () => {
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
        if (prop === '_Evocation_Savant_selection') return ['Fire Bolt'];
        if (prop === 'SignatureSpells_selection') return ['Shield'];
        return null;
      });

      const allSpells = [
        makeSpell('Shield', 1),
        makeSpell('Detect Magic', 1),
        makeSpell('Minor Illusion', 0),
        makeSpell('Fire Bolt', 0),
      ];
      const stats = makePlayerStats();
      stats.automation = {
        passives: [
          { type: 'abjuration_savant' },
          { type: 'divination_savant' },
          { type: 'illusion_savant' },
          { type: 'evocation_savant' },
          { type: 'signature_spells' },
        ],
      };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Shield');
      expect(names).toContain('Detect Magic');
      expect(names).toContain('Minor Illusion');
      expect(names).toContain('Fire Bolt');
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
  });
});
