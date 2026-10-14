// @maintained-by-ai
// SpellDetailPopup — Warlock Pact Magic slot lane.
//
// Distinct behaviour asserted here (not re-tested in sibling suites):
//  - The warlock slot search scans from the spell's level upward, so a cast
//    is enabled even when the spell's own base level is exhausted — and the
//    Slots Remaining row reports the count of the higher slot level that will
//    actually be paid (the non-warlock negative for the same position lives
//    in SpellDetailPopup.nonUpcastableSlots.test.jsx).
//  - Inside that search the live runtime counter outranks the spellAbilities
//    max at every level; the max is only ever a fallback when the runtime
//    has no value.
//  - A warlock click fires onCast as a paid, non-free cast at the spell's
//    base level even when the payment comes from a higher slot.
// Generic selector mechanics (radio rendering, first-available pre-select,
// radio disablement, upcast payload, cantrip, ritual, free-cast, rage,
// psionic lanes) belong to the rendering / sp-sp015-summon-upcast /
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
// whole row so the paid level, count, and pluralisation are pinned exactly.
const slotsRow = () => screen.getByText('Slots Remaining:').closest('span');

describe('SpellDetailPopup — Warlock Pact Magic slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  // Non-upcastable level 1 spell: the ONLY route to an enabled cast is the
  // warlock search at/above the spell level, so every case pins the class
  // lane. Each case asserts button, row text, and the no-slots notice
  // together — they are one resolution of the same search.
  it.each([
    {
      case: 'only higher-level slots remain — search pays level 2 and reports it',
      slotMaxes: { 1: 0, 2: 2 },
      runtime: { spell_slots_level_1: 0, spell_slots_level_2: 2 },
      enabled: true,
      expectedRow: 'Slots Remaining: 2 slots',
    },
    {
      case: 'runtime has no value — falls back to the spellAbilities max (singular wording)',
      slotMaxes: { 1: 1 },
      runtime: {},
      enabled: true,
      expectedRow: 'Slots Remaining: 1 slot',
    },
    {
      case: 'live runtime counters are spent despite maxes of 4 and 2',
      slotMaxes: { 1: 4, 2: 2 },
      runtime: { spell_slots_level_1: 0, spell_slots_level_2: 0 },
      enabled: false,
      expectedRow: 'Slots Remaining: 0',
    },
  ])('$case', ({ slotMaxes, runtime, enabled, expectedRow }) => {
    stubRuntime(runtime);
    renderPopup(makeSpell(), makeWarlockStats(slotMaxes));

    if (enabled) {
      expect(castButton()).toBeEnabled();
      expect(screen.queryByText(NO_SLOTS_TEXT)).not.toBeInTheDocument();
    } else {
      expect(castButton()).toBeDisabled();
      expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
    }
    expect(slotsRow()).toHaveTextContent(expectedRow);
  });

  it('clicking fires a paid cast at the base level when only a higher-level slot can pay', () => {
    stubRuntime({ spell_slots_level_1: 0, spell_slots_level_2: 1 });
    const spell = makeSpell();
    const onCast = renderPopup(spell, makeWarlockStats({ 1: 0, 2: 1 }));

    fireEvent.click(castButton());

    expect(onCast).toHaveBeenCalledTimes(1);
    const [payload] = onCast.mock.calls[0];
    expect(payload.name).toBe(spell.name);
    // The slot PAID is level 2, but the spell is cast (and resolved) at 1.
    expect(payload.level).toBe(1);
    expect(payload.isUpcast).toBe(false);
    expect(payload.upcastLevel).toBeUndefined();
    expect(payload.freeCastAuthorized).toBe(false);
  });

  describe('upcast spell with the Pact Magic search', () => {
    it('enables the cast and reports the level-3 count when upcastLevels is empty', () => {
      // With no upcastLevels prop there is no selector and no availableSlots
      // data: the ONLY route to enabled is the warlock search finding the
      // level-3 slot, and the slots row must echo that paid level's count.
      stubRuntime({ spell_slots_level_2: 0, spell_slots_level_3: 2 });
      renderPopup(makeUpcastSpell(), makeWarlockStats({ 2: 0, 3: 2 }), { upcastLevels: [] });

      expect(screen.queryAllByRole('radio')).toHaveLength(0);
      expect(castButton()).toBeEnabled();
      expect(screen.queryByText(NO_SLOTS_TEXT)).not.toBeInTheDocument();
      expect(slotsRow()).toHaveTextContent('Slots Remaining: 2 slots');
    });

    it('disables every upcast option when no slot exists at the spell level or higher', () => {
      // Negative of the search: scanning level 2 upward finds nothing in
      // either source, so the class lane grants nothing.
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
