// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';
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
  describe('getSpellAbilities — applyRitualSpellPassives lane', () => {
    // FT-068 Ritual Master chosenSpells injection and _ritualMasterRitual stamps are
    // owned by spellCalc2024-ritualMaster.test.js (injection :127, stamps :152,
    // zero-caster container :208) — not re-run here.

    // Both no-injection guards: empty ritualSpells array (early return) and the
    // wizard Ritual Adept class feature (known rituals already live in the spellbook;
    // injecting the full game list here would flood the sheet).
    it.each([
      ['empty ritualSpells array', []],
      ['wizard Ritual Adept class feature', [{ type: 'passive_rule', effect: 'ritual_spells', name: 'Ritual Adept', hasAutomation: true }]],
    ])('injects no unknown ritual spells for %s', (_label, ritualSpells) => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { ritual: false }),
        makeSpell('Alarm', 1, { ritual: true }),
        makeSpell('Detect Magic', 1, { ritual: true }),
        makeSpell('Find Familiar', 1, { ritual: true }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt', 'Alarm'];
      stats.automation = { ritualSpells };

      const result = getSpellAbilities(allSpells, stats);

      // Final rows are sorted by level then name; only the known spells remain,
      // as ordinary prepared wizard rows.
      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt', 'Alarm']);
      expect(result.spells.find(s => s.name === 'Alarm').prepared).toBe('Prepared');
    });

    // Generic full-list injection (e.g. the Ritual Caster feat), including the dedup
    // path: known rituals are never injected twice nor re-stamped as always-prepared.
    it('injects every unlearned ritual spell as an always-prepared row for other ritual_spells features like the Ritual Caster feat', () => {
      const allSpells = [
        makeSpell('Fire Bolt', 0, { ritual: false }),
        makeSpell('Alarm', 1, { ritual: true }),
        makeSpell('Detect Magic', 1, { ritual: true }),
        makeSpell('Find Familiar', 1, { ritual: true }),
      ];
      const stats = makePlayerStats();
      stats.spells = ['Fire Bolt', 'Alarm'];
      stats.automation = {
        ritualSpells: [{ type: 'passive_rule', effect: 'ritual_spells', name: 'Ritual Caster', hasAutomation: true }],
      };

      const result = getSpellAbilities(allSpells, stats);

      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt', 'Alarm', 'Detect Magic', 'Find Familiar']);
      const alarmRows = result.spells.filter(s => s.name === 'Alarm');
      expect(alarmRows).toHaveLength(1);
      expect(alarmRows[0].prepared).toBe('Prepared');
      for (const name of ['Detect Magic', 'Find Familiar']) {
        const row = result.spells.find(s => s.name === name);
        expect(row.prepared).toBe('Always');
        expect(row.level).toBe(1);
        expect(row.ritual).toBe(true);
      }
    });
  });
});
