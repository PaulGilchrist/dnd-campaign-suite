// @improved-by-ai
/**
 * Contract tests for the shared CharSpells test fixtures.
 *
 * These fixtures feed render/interaction tests across this folder
 * (CharSpells.Rendering.test.jsx, CharSpells.Table.test.jsx,
 * CharSpells.Popups.*.test.jsx, ...). Rather than restate every fixture
 * literal — which passes even when production breaks — these tests pin the
 * shapes and scenario properties that production code actually reads, so a
 * renamed, removed, or reshaped field fails here with a clear message
 * instead of producing a confusing failure in some consumer test.
 *
 * Production readers:
 * - CharSpells.jsx:179  is2024 = playerStats.rules === '2024'
 * - CharSpells.jsx:151  isWizard = playerStats.class?.name === 'Wizard'
 * - CharSpells.jsx:120  grayed rows = is2024 && isWizard && !isPrepared && !spell.ritual
 * - CharSpells.jsx:87   prepared column renders a checkbox only for '' | 'Prepared'
 * - CharSpells.jsx:77-80 summary reads cantrips_known / prepared_spells / maxPreparedSpells
 * - CharSpells.jsx:96-108 header reads spellAbilities toHit / modifier / saveDc
 * - CharSpells.jsx:39   effect cell looks up damage.damage_at_slot_level[String(spell.level)]
 * - CharSpellSlots.jsx:16 slots read spellAbilities[`spell_slots_level_${level}`]
 * - CharSpellSlotLevel.jsx:13 playerStats.name is the runtime-store key
 */
import { describe, it, expect } from 'vitest';
import * as helpers from './CharSpells.test-utils.js';

const NUMERIC_SUMMARY_KEYS = [
  'toHit',
  'modifier',
  'saveDc',
  'cantrips_known',
  'prepared_spells',
  'maxPreparedSpells',
];

// Values CharSpells.jsx:87/116 recognizes; anything else renders as a raw
// text cell and silently skips the prepared/grayed-out logic.
const VALID_PREPARED_VALUES = ['Prepared', 'Always', ''];

const fixtures = [
  ['mockPlayerStats', helpers.mockPlayerStats],
  ['mockPlayerStats2024', helpers.mockPlayerStats2024],
  ['mockPlayerStats2024Wizard', helpers.mockPlayerStats2024Wizard],
];

describe.each(fixtures)('%s contract', (_label, stats) => {
  it('provides player-level fields production reads', () => {
    // name is the runtime-store key used by slot tracking — must be non-empty.
    expect(stats.name.trim()).not.toBe('');
    expect(typeof stats.rules).toBe('string');
    expect(stats.spellAbilities).toBeTypeOf('object');
  });

  it('provides numeric spellAbilities summary and header values', () => {
    for (const key of NUMERIC_SUMMARY_KEYS) {
      expect(stats.spellAbilities[key], `spellAbilities.${key}`).toEqual(
        expect.any(Number),
      );
    }
  });

  it('provides spell rows with the cell fields CharSpells renders', () => {
    expect(stats.spellAbilities.spells.length).toBeGreaterThan(0);
    for (const spell of stats.spellAbilities.spells) {
      expect(spell.name).toEqual(expect.any(String));
      expect(spell.level).toEqual(expect.any(Number));
      expect(spell.casting_time).toEqual(expect.any(String));
      expect(spell.range).toEqual(expect.any(String));
      expect(spell.duration).toEqual(expect.any(String));
      expect(Array.isArray(spell.components)).toBe(true);
      for (const component of spell.components) {
        expect(component).toMatch(/^[VSM]$/);
      }
      expect(VALID_PREPARED_VALUES).toContain(spell.prepared);
    }
  });

  it('keys damage by the spell level the effect cell looks up', () => {
    const damageable = stats.spellAbilities.spells.filter((s) => s.damage);
    for (const spell of damageable) {
      expect(spell.damage.damage_type).toEqual(expect.any(String));
      expect(spell.damage.damage_at_slot_level).toEqual(
        expect.objectContaining({ [String(spell.level)]: expect.any(String) }),
      );
    }
  });
});

describe('fixture scenario separation', () => {
  it('drives both sides of the is2024 ruleset branch', () => {
    // Mirrors CharSpells.jsx: const is2024 = playerStats.rules === '2024'.
    expect(helpers.mockPlayerStats.rules === '2024').toBe(false);
    expect(helpers.mockPlayerStats2024.rules === '2024').toBe(true);
    expect(helpers.mockPlayerStats2024Wizard.rules === '2024').toBe(true);
  });

  it('is the wizard fixture the only one entering wizard-only branches', () => {
    // Mirrors CharSpells.jsx: const isWizard = playerStats.class?.name === 'Wizard'.
    const isWizard = (stats) => stats.class?.name === 'Wizard';
    expect(isWizard(helpers.mockPlayerStats2024Wizard)).toBe(true);
    expect(isWizard(helpers.mockPlayerStats)).toBe(false);
    expect(isWizard(helpers.mockPlayerStats2024)).toBe(false);
  });

  it('wizard fixture exercises both unprepared row branches', () => {
    // CharSpells.jsx:116-120: unprepared non-ritual spells render grayed
    // and non-castable; unprepared rituals stay castable via Ritual Adept.
    const unprepared = helpers.mockPlayerStats2024Wizard.spellAbilities.spells.filter(
      (s) => s.prepared !== 'Always' && s.prepared !== 'Prepared',
    );
    const grayed = unprepared.filter((s) => !s.ritual).map((s) => s.name);
    const ritualCastable = unprepared.filter((s) => s.ritual).map((s) => s.name);
    expect(grayed).toContain('Shield');
    expect(ritualCastable).toContain('Detect Magic');
  });

  it('generic 5e and 2024 fixtures share an identical spell table', () => {
    // CharSpells.Rendering.test.jsx renders mockPlayerStats2024 and expects
    // the same table as the 5e mock; drift here breaks that parity check.
    expect(helpers.mockPlayerStats2024.spellAbilities.spells).toEqual(
      helpers.mockPlayerStats.spellAbilities.spells,
    );
  });
});

describe('mock gate defaults', () => {
  it('gates default to permissive no-op values until a consumer overrides them', () => {
    // Consumers wire these into vi.mock factories; these defaults are the
    // contract for callers that do not stub a return value.
    expect(helpers.mockGateUpcast()).toBe(false);
    expect(helpers.mockGetCantripAutoLevel()).toBe(null);
    expect(helpers.mockGateMetamagic()).toBeUndefined();
    expect(helpers.mockHandleTogglePreparedSpells()).toBeUndefined();
  });

  it('mockReset restores the documented default implementations on shared mocks', () => {
    // The mocks are module-level singletons shared across every consumer in
    // a file — overrides must be restorable without re-importing.
    const { mockGateUpcast, mockGetCantripAutoLevel } = helpers;
    try {
      mockGateUpcast.mockReturnValue(true);
      mockGetCantripAutoLevel.mockReturnValue(3);
      expect(mockGateUpcast()).toBe(true);
      expect(mockGetCantripAutoLevel()).toBe(3);
    } finally {
      mockGateUpcast.mockReset();
      mockGetCantripAutoLevel.mockReset();
    }
    expect(mockGateUpcast()).toBe(false);
    expect(mockGetCantripAutoLevel()).toBe(null);
  });
});
