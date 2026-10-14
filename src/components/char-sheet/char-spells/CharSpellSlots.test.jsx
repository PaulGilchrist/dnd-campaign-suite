// @maintained-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlots from './CharSpellSlots.jsx';

// CharSpellSlots is pure wiring: it asks the rules engine for the character's
// max spell-slot level, then renders one CharSpellSlotLevel per level 1..max,
// forwarding that level's totalSlots, the character, and the campaign.
//
// The rules engine (rules.getSpellMaxLevel) is a pure function of the slot
// data, so it runs for real here — tests drive behavior through realistic
// spellAbilities fixtures instead of mock return values, and the exact child
// rows pin the max-level computation. Only the child is stubbed, so assertions
// target this parent's data flow; the child's own rendering, interactions, and
// value resolution are covered by
// CharSpellSlotLevel.{rendering,interactions,fallback}.test.jsx.
vi.mock('./CharSpellSlotLevel.jsx', () => {
  const stub = vi.fn(() => null);
  return { default: stub };
});
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx';

const CAMPAIGN = 'test-campaign';

// Per-test fixture: slots declared as { [level]: totalSlots }.
function createPlayerStats(levels = {}) {
  return {
    name: 'Test Character',
    spellAbilities: {
      ...Object.fromEntries(
        Object.entries(levels).map(([level, slots]) => [`spell_slots_level_${level}`, slots])
      ),
      spells: [],
    },
  };
}

// One entry per child the parent rendered, in order: what the parent's
// contract is. A single deep-equal pins count, order, level, and totals.
function renderedChildren() {
  return CharSpellSlotLevel.mock.calls.map(([props]) => ({
    level: props.level,
    totalSlots: props.totalSlots,
  }));
}

function renderSlots(playerStats) {
  render(<CharSpellSlots playerStats={playerStats} campaignName={CAMPAIGN} />);
}

describe('CharSpellSlots', () => {
  beforeEach(() => {
    CharSpellSlotLevel.mockClear();
  });

  it.each([
    { label: 'absent', spellAbilities: undefined },
    { label: 'null', spellAbilities: null },
  ])('renders nothing when spellAbilities is $label', ({ spellAbilities }) => {
    renderSlots({ name: 'Test Character', spellAbilities });

    expect(screen.queryByText('Spell Slots')).not.toBeInTheDocument();
    expect(CharSpellSlotLevel).not.toHaveBeenCalled();
  });

  // The real engine derives max level from the fixture, so each row set also
  // proves getSpellMaxLevel was consulted with the character's spellAbilities.
  it.each([
    {
      description: 'a caster with levels 1-3',
      levels: { 1: 4, 2: 3, 3: 3 },
      expected: [
        { level: 1, totalSlots: 4 },
        { level: 2, totalSlots: 3 },
        { level: 3, totalSlots: 3 },
      ],
    },
    {
      // Real rule: max level is the highest level with more than zero slots,
      // so the 0-slot level 3 and unconfigured level 4 never appear.
      description: 'a caster whose highest level has zero slots',
      levels: { 1: 4, 2: 3, 3: 0 },
      expected: [
        { level: 1, totalSlots: 4 },
        { level: 2, totalSlots: 3 },
      ],
    },
    {
      description: 'a full caster with all nine levels',
      levels: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
      expected: [
        { level: 1, totalSlots: 4 },
        { level: 2, totalSlots: 3 },
        { level: 3, totalSlots: 3 },
        { level: 4, totalSlots: 3 },
        { level: 5, totalSlots: 2 },
        { level: 6, totalSlots: 1 },
        { level: 7, totalSlots: 1 },
        { level: 8, totalSlots: 1 },
        { level: 9, totalSlots: 1 },
      ],
    },
    {
      // E.g. a martial character with an empty spellbook: header, no rows.
      description: 'a character with no slots configured',
      levels: {},
      expected: [],
    },
  ])(
    'shows the header and one row per level 1..max for $description',
    ({ levels, expected }) => {
      const playerStats = createPlayerStats(levels);

      renderSlots(playerStats);

      expect(screen.getByText('Spell Slots')).toBeInTheDocument();
      expect(renderedChildren()).toEqual(expected);
      // Every row also receives the character and campaign, by identity.
      for (const [props] of CharSpellSlotLevel.mock.calls) {
        expect(props.playerStats).toBe(playerStats);
        expect(props.campaignName).toBe(CAMPAIGN);
      }
    }
  );
});
