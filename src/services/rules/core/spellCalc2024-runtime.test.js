// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

// Runtime lane: owns getSpellAbilities behavior driven by the RUNTIME STORE
// (getRuntimeValue reads at build time) — Spell Mastery picks, Savant/Signature
// selections — plus the automation-passive spell-list grants (Phantasmal Creatures,
// Improved Illusions) that no sibling lane covers. Static-data lanes own the rest:
// slots/base (spellCalc2024.test.js, :251 owns the level-then-name sort),
// automation payload (#1266), arcanum (#1265), rituals (#1271), ritualMaster (#1270).

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
    // resetAllMocks restores the factory's () => null store impl, so every test
    // starts with an empty runtime store and installs its own mockImplementation.
    vi.resetAllMocks();
    const runtimeState = await import('../../../hooks/runtime/useRuntimeState.js');
    mockGetRuntimeValue = runtimeState.getRuntimeValue;
  });

  describe('getSpellAbilities', () => {
    it('grants Spell Mastery runtime picks as Always rows, dedupes known spells, and reverts when the store is cleared', () => {
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'SpellMastery_level1') return 'Shield';
        if (prop === 'SpellMastery_level2') return 'Web';
        return null;
      });

      const allSpells = [makeSpell('Shield', 1), makeSpell('Web', 1)];
      const stats = makePlayerStats();
      stats.spells = ['Shield']; // already in the spellbook — the mastery pick must not duplicate it
      stats.automation = { passives: [{ type: 'spell_mastery' }] };

      const result = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });

      // the store is read under this character/campaign's exact runtime keys
      expect(mockGetRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'SpellMastery_level1', 'TestCampaign');
      expect(mockGetRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'SpellMastery_level2', 'TestCampaign');

      const shieldRows = result.spells.filter(s => s.name === 'Shield');
      expect(shieldRows.length).toBe(1);
      expect(shieldRows[0].prepared).toBe('Prepared'); // the known wizard row is left untouched
      const webRow = result.spells.find(s => s.name === 'Web');
      expect(webRow).toBeDefined();
      expect(webRow.prepared).toBe('Always'); // the runtime grant is always-prepared

      // Falsifying pair: clear the store — the granted row reverts away, the known row stays.
      mockGetRuntimeValue.mockImplementation(() => null);
      const cleared = getSpellAbilities(allSpells, stats, { campaignName: 'TestCampaign' });
      expect(cleared.spells.map(s => s.name)).toEqual(['Shield']);
    });

    it('adds Savant and Signature school selections from runtime state, deduped across keys', () => {
      mockGetRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === '_Abjuration_Savant_selection') return ['Shield'];
        if (prop === '_Divination_Savant_selection') return ['Detect Magic'];
        if (prop === '_Illusion_Savant_selection') return ['Minor Illusion'];
        if (prop === '_Evocation_Savant_selection') return ['Fire Bolt'];
        if (prop === 'SignatureSpells_selection') return ['Shield']; // overlaps Abjuration Savant
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

      // every selection becomes an Always row; nothing else is smuggled in
      expect(result.spells.map(s => s.name)).toEqual(['Fire Bolt', 'Minor Illusion', 'Detect Magic', 'Shield']);
      expect(mockGetRuntimeValue).toHaveBeenCalledWith('TestCharacter', '_Abjuration_Savant_selection', 'TestCampaign');
      expect(result.spells.find(s => s.name === 'Shield').prepared).toBe('Always');
    });

    it('phantasmal_creatures passive always-prepares its declared summon spells', () => {
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

      expect(result.spells.map(s => s.name)).toEqual(['Summon Beast', 'Summon Fey']);
      expect(result.spells.every(s => s.prepared === 'Always')).toBe(true);

      // Negative: without the passive the declared list grants nothing.
      stats.automation = { passives: [] };
      expect(getSpellAbilities(allSpells, stats).spells).toEqual([]);
    });

    it('improved_illusions stamps Minor Illusion as an Always \'1 bonus action\' row only when the passive is present (#1272)', () => {
      const allSpells = [makeSpell('Minor Illusion', 0), makeSpell('Fire Bolt', 0)];
      const stats = makePlayerStats();
      stats.automation = { passives: [{ type: 'improved_illusions' }] };

      // Grant-when-absent arm: disk law classes.json:13537 — Improved Illusions holder
      // can "cast [Minor Illusion] as Bonus Action". The upgrade must reach the FINAL
      // sheet row bytes, both when the row has to be granted (fixed 2026-10-22: the
      // pre-remap stamp was wiped by remapSpellRow's DB clone — #1272).
      const granted = getSpellAbilities(allSpells, stats);
      expect(granted.spells.find(s => s.name === 'Minor Illusion')).toMatchObject({
        level: 0, prepared: 'Always', casting_time: '1 bonus action',
      });

      // Already-known arm: exactly one Always row, upgraded post-remap; a sibling
      // cantrip row is byte-intact at the DB casting_time (other stamps unaffected).
      stats.spells = ['Minor Illusion', 'Fire Bolt'];
      const known = getSpellAbilities(allSpells, stats);
      expect(known.spells.filter(s => s.name === 'Minor Illusion').length).toBe(1);
      expect(known.spells.find(s => s.name === 'Minor Illusion')).toMatchObject({
        prepared: 'Always', casting_time: '1 bonus action',
      });
      expect(known.spells.find(s => s.name === 'Fire Bolt')).toMatchObject({
        prepared: 'Always', casting_time: '1 action',
      });

      // Negative: no passive and not known — never granted.
      stats.spells = [];
      stats.automation = {};
      expect(getSpellAbilities(allSpells, stats).spells).toEqual([]);

      // Negative: non-holder byte-intact — known rows keep DB casting_time bytes.
      stats.spells = ['Minor Illusion', 'Fire Bolt'];
      const plain = getSpellAbilities(allSpells, stats);
      expect(plain.spells.find(s => s.name === 'Minor Illusion').casting_time).toBe('1 action');
      expect(plain.spells.find(s => s.name === 'Fire Bolt').casting_time).toBe('1 action');
    });
  });
});
