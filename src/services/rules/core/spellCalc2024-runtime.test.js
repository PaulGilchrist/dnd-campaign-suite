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

    it('improved_illusions grants Minor Illusion as an Always cantrip row only when the passive is present', () => {
      const allSpells = [makeSpell('Minor Illusion', 0)];
      const stats = makePlayerStats();
      stats.automation = { passives: [{ type: 'improved_illusions' }] };

      const granted = getSpellAbilities(allSpells, stats);
      expect(granted.spells.find(s => s.name === 'Minor Illusion')).toMatchObject({ level: 0, prepared: 'Always' });

      // Already known: still exactly one Always row. NOTE: casting_time stays '1 action' —
      // applyImprovedIllusions's '1 bonus action' stamp (spellCalc2024.js:355) is wiped by
      // the finalizeSpellRows detail remap; pinned here so a fix that restores the upgrade
      // fails loudly (reported as a source defect, not faked green).
      stats.spells = ['Minor Illusion'];
      const known = getSpellAbilities(allSpells, stats);
      const knownRow = known.spells.find(s => s.name === 'Minor Illusion');
      expect(known.spells.filter(s => s.name === 'Minor Illusion').length).toBe(1);
      expect(knownRow).toMatchObject({ prepared: 'Always', casting_time: '1 action' });

      // Negative: no passive and not known — never granted.
      stats.spells = [];
      stats.automation = {};
      expect(getSpellAbilities(allSpells, stats).spells).toEqual([]);
    });
  });
});
