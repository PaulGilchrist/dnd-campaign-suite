// @improved-by-ai
// SpellDetailPopup — Warlock Pact Magic slot lane.
//
// Distinct behaviour asserted here (not re-tested in sibling suites):
//  - The warlock slot search scans from the spell's level upward, so a cast
//    is enabled even when the spell's own base level is exhausted — and the
//    Slots Remaining row reports the count of the higher slot level that will
//    actually be paid (a Bard in the same position is disabled; that negative
//    lives in SpellDetailPopup.nonUpcastableSlots.test.jsx).
//  - The live runtime counter outranks the spellAbilities max at every level;
//    the max is only ever a fallback when the runtime has no value.
//  - A warlock click actually fires onCast as a paid, non-free cast.
// Generic selector mechanics (radio enablement, payload plumbing, cantrip,
// ritual, free-cast, rage, psionic lanes) belong to the rendering /
// castCantrip / ritualCast / freeCast / rageRestriction / psionic suites.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/combat/buffs/buffService.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

const CAMPAIGN = 'test-campaign';
const NO_SLOTS_TEXT = 'No spell slots available for this level.';

// A level 1 spell with a SINGLE damage tier — non-upcastable, so the only
// way a warlock can pay for it is the Pact Magic slot search.
const makeSpell = (overrides = {}) => ({
  name: 'Magic Missile',
  level: 1,
  description: 'Three darts of force strike a creature.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  school: 'Evocation',
  damage: {
    damage_at_slot_level: { '1': '3d4+1' },
    damage_type: 'force',
  },
  ...overrides,
});

// A level 2 spell with a 2/3 damage ladder — upcastable, so the popup offers
// (or withholds) the cast-at-level selector alongside the slot search.
const makeUpcastSpell = () => makeSpell({
  level: 2,
  damage: {
    damage_at_slot_level: { '2': '4d4+1', '3': '5d4+1' },
    damage_type: 'force',
  },
});

// Warlock stats with per-level slot maxes, e.g. { 1: 0, 2: 2 }.
const makeWarlockStats = (slotMaxes = {}) => ({
  name: 'Elara',
  level: 5,
  class: { name: 'Warlock', major: { name: 'Warlock' } },
  abilities: [{ name: 'Charisma', bonus: 3 }],
  proficiency: 3,
  spellAbilities: {
    ...Object.fromEntries(
      Object.entries(slotMaxes).map(([lvl, max]) => [`spell_slots_level_${lvl}`, max])
    ),
    spells: [],
  },
  automation: { passives: [], actions: [] },
});

// Stub the runtime store from a full-key → value map; unlisted keys read null.
const stubRuntime = (values = {}) => {
  vi.mocked(getRuntimeValue).mockImplementation((_playerName, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null);
};

const renderPopup = (spell, playerStats, extraProps = {}) => {
  const onCast = extraProps.onCast || vi.fn();
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      onCast={onCast}
      {...extraProps}
    />
  );
  return onCast;
};

const castButton = () => screen.getByRole('button', { name: /Cast Spell/ });
// The meta span renders "<b>Slots Remaining:</b> N slot(s)" — assert the
// whole row so the count and its pluralisation are pinned exactly.
const slotsRow = () => screen.getByText('Slots Remaining:').closest('span');

describe('SpellDetailPopup — Warlock Pact Magic slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('Slots Remaining display', () => {
    it.each([
      {
        label: 'only higher-level slots remain',
        slotMaxes: { 1: 0, 2: 2 },
        runtime: { spell_slots_level_1: 0, spell_slots_level_2: 2 },
        expected: 'Slots Remaining: 2 slots',
        note: 'the row reports the level-2 slot that Pact Magic will actually pay',
      },
      {
        label: 'exactly one slot remains',
        slotMaxes: { 1: 1 },
        runtime: { spell_slots_level_1: 1 },
        expected: 'Slots Remaining: 1 slot',
        note: 'singular "slot" at one',
      },
      {
        label: 'base-level slots remain',
        slotMaxes: { 1: 4 },
        runtime: { spell_slots_level_1: 4 },
        expected: 'Slots Remaining: 4 slots',
        note: 'base level when it is the level being paid',
      },
      {
        label: 'no slots at any level',
        slotMaxes: { 1: 0, 2: 0 },
        runtime: { spell_slots_level_1: 0, spell_slots_level_2: 0 },
        expected: 'Slots Remaining: 0',
        note: 'zero is reported honestly, not hidden',
      },
      {
        label: 'runtime has no value',
        slotMaxes: { 1: 2 },
        runtime: {},
        expected: 'Slots Remaining: 2 slots',
        note: 'falls back to the spellAbilities max',
      },
    ])('shows $expected when $label ($note)', ({ slotMaxes, runtime, expected }) => {
      stubRuntime(runtime);
      renderPopup(makeSpell(), makeWarlockStats(slotMaxes));

      expect(slotsRow()).toHaveTextContent(expected);
    });
  });

  describe('cast button — Pact Magic slot search', () => {
    it.each([
      {
        label: 'a base-level slot is available',
        slotMaxes: { 1: 3 },
        runtime: { spell_slots_level_1: 3 },
        enabled: true,
      },
      {
        label: 'only higher-level slots remain (base exhausted)',
        slotMaxes: { 1: 0, 2: 1 },
        runtime: { spell_slots_level_1: 0, spell_slots_level_2: 1 },
        enabled: true,
      },
      {
        label: 'runtime is missing but the spellAbilities max has slots',
        slotMaxes: { 1: 2 },
        runtime: {},
        enabled: true,
      },
      {
        label: 'runtime says the base level is spent despite a max of 4',
        slotMaxes: { 1: 4 },
        runtime: { spell_slots_level_1: 0 },
        enabled: false,
      },
      {
        label: 'no slots exist at any level in either source',
        slotMaxes: { 1: 0, 2: 0 },
        runtime: { spell_slots_level_1: 0, spell_slots_level_2: 0 },
        enabled: false,
      },
    ])('$enabled cast button when $label', ({ slotMaxes, runtime, enabled }) => {
      // Non-upcastable level 1 spell: the ONLY route to enabled is the
      // warlock search at/above the spell level, so this pins the class lane.
      stubRuntime(runtime);
      renderPopup(makeSpell(), makeWarlockStats(slotMaxes));

      if (enabled) {
        expect(castButton()).toBeEnabled();
        expect(screen.queryByText(NO_SLOTS_TEXT)).not.toBeInTheDocument();
      } else {
        expect(castButton()).toBeDisabled();
        expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
      }
    });

    it('clicking fires a paid, non-free cast when only a higher-level slot can pay', () => {
      stubRuntime({ spell_slots_level_1: 0, spell_slots_level_2: 1 });
      const spell = makeSpell();
      const onCast = renderPopup(spell, makeWarlockStats({ 1: 0, 2: 1 }));

      fireEvent.click(castButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      const [payload] = onCast.mock.calls[0];
      expect(payload.name).toBe(spell.name);
      expect(payload.level).toBe(1);
      expect(payload.freeCastAuthorized).toBe(false);
    });
  });

  describe('upcast casting', () => {
    const upcastLevelsBaseEmpty = [
      { level: 2, formula: '4d4+1', availableSlots: 0 },
      { level: 3, formula: '5d4+1', availableSlots: 2 },
    ];

    it('pre-selects the first upcast level with a slot and casts at that level', () => {
      stubRuntime({ spell_slots_level_2: 0, spell_slots_level_3: 2 });
      const onCast = renderPopup(makeUpcastSpell(), makeWarlockStats({ 2: 0, 3: 2 }), {
        upcastLevels: upcastLevelsBaseEmpty,
      });

      expect(screen.getByRole('radio', { name: /Level 2/ })).toBeDisabled();
      expect(screen.getByRole('radio', { name: /Level 3/ })).toBeChecked();
      expect(castButton()).toBeEnabled();

      fireEvent.click(castButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      const [payload] = onCast.mock.calls[0];
      expect(payload.isUpcast).toBe(true);
      expect(payload.upcastLevel).toBe(3);
    });

    it('enables the cast and shows the higher slot count even when upcastLevels is empty', () => {
      stubRuntime({ spell_slots_level_2: 0, spell_slots_level_3: 2 });
      renderPopup(makeUpcastSpell(), makeWarlockStats({ 2: 0, 3: 2 }), { upcastLevels: [] });

      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(castButton()).toBeEnabled();
      expect(slotsRow()).toHaveTextContent('Slots Remaining: 2 slots');
    });

    it('disables every upcast option when no slot exists at the spell level or higher', () => {
      stubRuntime({ spell_slots_level_2: 0, spell_slots_level_3: 0 });
      renderPopup(makeUpcastSpell(), makeWarlockStats({ 2: 0, 3: 0 }), {
        upcastLevels: [
          { level: 2, formula: '4d4+1', availableSlots: 0 },
          { level: 3, formula: '5d4+1', availableSlots: 0 },
        ],
      });

      expect(screen.getByRole('radio', { name: /Level 2/ })).toBeDisabled();
      expect(screen.getByRole('radio', { name: /Level 3/ })).toBeDisabled();
      expect(castButton()).toBeDisabled();
      expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
    });
  });
});
