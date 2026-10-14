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

describe('spellCalc2024-rituals', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await import('../../../hooks/runtime/useRuntimeState.js');
    await import('../../character/classRules2024.js');
  });

  describe('getSpellAbilities', () => {
    // ── Automation: Ritual Adept (wizard class feature) ──

    it('does not inject every ritual spell for the wizard Ritual Adept class feature — only known spells appear', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { ritual: false }),
        makeSpell('Alarm', 1, { ritual: true }),
        makeSpell('Find Familiar', 1, { ritual: true }),
        makeSpell('Detect Magic', 1, { ritual: true, classes: ['Bard', 'Cleric'] }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt', 'Alarm'];
      stats.automation = {
        ritualSpells: [{ type: 'passive_rule', effect: 'ritual_spells', name: 'Ritual Adept', hasAutomation: true }],
      };

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Fire Bolt');
      expect(names).toContain('Alarm');
      expect(names).not.toContain('Find Familiar');
      expect(names).not.toContain('Detect Magic');
    });

    it('still injects all ritual spells for other ritual_spells features like the Ritual Caster feat', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { ritual: false }),
        makeSpell('Alarm', 1, { ritual: true }),
        makeSpell('Find Familiar', 1, { ritual: true }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt'];
      stats.automation = {
        ritualSpells: [{ type: 'passive_rule', effect: 'ritual_spells', name: 'Ritual Caster', hasAutomation: true }],
      };

      const result = getSpellAbilities(allSpells, stats);

      const names = result.spells.map(s => s.name);
      expect(names).toContain('Fire Bolt');
      expect(names).toContain('Alarm');
      expect(names).toContain('Find Familiar');
    });

    it('deduplicates ritual spells already in known list', () => {
      const allSpells = [makeSpell('Alarm', 1, { ritual: true })];
      const stats = makePlayerStats();
      stats.spells = ['Alarm'];
      stats.automation = {
        ritualSpells: [{ type: 'passive_rule', effect: 'ritual_spells', name: 'Ritual Caster', hasAutomation: true }],
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
  });
});
