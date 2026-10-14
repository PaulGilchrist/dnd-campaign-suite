// @maintained-by-ai
/**
 * Contract tests for the shared CharSpells test fixtures.
 *
 * The suites in this folder (CharSpells.Rendering/Table/Interactions/
 * Popups.*) spread these fixtures and assert exact rendered values —
 * summary counts, ruleset branches, and the 'Light' cell the cast-flow
 * suite clicks. These tests pin those consumed values here so fixture
 * drift fails with a clear "which field" message instead of a confusing
 * failure inside some consumer suite.
 *
 * Only fixtures with live consumers are pinned:
 * - mockPlayerStats     → Rendering, Table, Interactions, Popups.*, getTargetInfo
 * - mockPlayerStats2024 → Rendering (2024 prepared-column suppression)
 * mockPlayerStats2024Wizard and the vi.fn() gate mocks have no consumers
 * (suites mock their own gates and wizard overrides), so they are not
 * contracted here. CharSpellSlots is stubbed in every consumer suite, so
 * spell_slots_level_* keys are not pinned either.
 */
import { describe, it, expect } from 'vitest';
import { mockPlayerStats, mockPlayerStats2024 } from './CharSpells.test-utils.js';

// Values CharSpells.jsx:87/116 recognizes; anything else renders as a raw
// text cell and silently skips the prepared/grayed-out logic.
const VALID_PREPARED_VALUES = ['Prepared', 'Always', ''];

const fixtures = [
  // is2024 mirrors CharSpells.jsx:179 — the branch each fixture drives.
  { label: 'mockPlayerStats', stats: mockPlayerStats, is2024: false },
  { label: 'mockPlayerStats2024', stats: mockPlayerStats2024, is2024: true },
];

describe.each(fixtures)('$label contract', ({ stats, is2024 }) => {
  it('provides the player-level values consumer suites assert against', () => {
    // name is the runtime-store key used across the popups/getTargetInfo suites.
    expect(stats.name.trim(), 'name').not.toBe('');
    expect(stats.rules === '2024', 'ruleset branch (CharSpells.jsx:179)').toBe(is2024);

    expect(stats.spellAbilities).toBeTypeOf('object');
    // Header row renders these numerics (toHit/saveDc are read dynamically).
    for (const key of ['toHit', 'modifier', 'saveDc']) {
      expect(stats.spellAbilities[key], `spellAbilities.${key}`).toEqual(expect.any(Number));
    }
    // Exact counts Rendering.test.jsx asserts as rendered summary text.
    expect(stats.spellAbilities.cantrips_known, 'cantrips_known').toBe(3);
    expect(stats.spellAbilities.prepared_spells, 'prepared_spells').toBe(5);
    expect(stats.spellAbilities.maxPreparedSpells, 'maxPreparedSpells').toBe(5);
  });

  it('provides spell rows with the cell fields CharSpells renders', () => {
    const spells = stats.spellAbilities.spells;
    expect(spells.length, 'spell rows').toBeGreaterThan(0);

    const names = spells.map((s) => s.name.trim());
    // Rows are keyed and queried by name (getByRole('cell', {name})).
    expect(new Set(names).size, 'spell row names must be unique').toBe(names.length);

    for (const spell of spells) {
      expect(spell.name.trim(), 'spell.name').not.toBe('');
      expect(spell.level, `${spell.name}.level`).toEqual(expect.any(Number));
      expect(spell.casting_time, `${spell.name}.casting_time`).toEqual(expect.any(String));
      expect(spell.range, `${spell.name}.range`).toEqual(expect.any(String));
      expect(spell.duration, `${spell.name}.duration`).toEqual(expect.any(String));
      expect(Array.isArray(spell.components), `${spell.name}.components`).toBe(true);
      for (const component of spell.components) {
        expect(component, `${spell.name} component`).toMatch(/^[VSM]$/);
      }
      expect(VALID_PREPARED_VALUES, `${spell.name}.prepared`).toContain(spell.prepared);
      if (spell.damage) {
        // Drift here degrades the effect cell to 'Utility' silently
        // (computeSpellEffectLabel): pin type + self-consistent level key.
        expect(spell.damage.damage_type, `${spell.name}.damage.damage_type`).toEqual(
          expect.any(String),
        );
        expect(
          spell.damage.damage_at_slot_level[String(spell.level)],
          `${spell.name} damage_at_slot_level at its own level`,
        ).toEqual(expect.any(String));
      }
    }

    // Popups.spellCast.test.jsx clicks the 'Light' cell and casts it as a
    // level-0 cantrip through the metamagic gate.
    const light = spells.find((s) => s.name === 'Light');
    expect(light, "'Light' row required by the cast-flow suite").toBeTruthy();
    expect(light.level, 'Light must stay a cantrip').toBe(0);
  });
});
