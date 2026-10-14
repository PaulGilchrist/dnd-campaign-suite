// @improved-by-ai
// SpellDetailPopup — Rage casting restriction (canonical Rage suite).
// While the "Rage" buff is active the popup blocks ALL casting
// (computeCanCast's `if (!isRaging)` short-circuit) — even when every
// payment avenue is wide open. This suite covers the channels that the
// sibling suites do NOT re-test here:
//   - slot-paid casts with full slots AND an open upcast ladder
//   - free-cast authorization (Natural Recovery runtime selection)
//   - FT-068 Quick Ritual checkbox channel
//   - CLA-299 Ritual Adept auto-cast channel
//   - buff-name specificity (only a buff named exactly "Rage" blocks)
// Already covered elsewhere and deliberately NOT duplicated:
//   - cantrip blocked while raging ......... SpellDetailPopup.castCantrip.test.jsx
//   - SP payment blocked while raging ....... SpellDetailPopup.psionicCanCast.test.jsx
// Every blocked case has a non-raging control on the identical fixture, so
// neither an over-blocked nor an under-blocked `canCast` can pass vacuously.
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

// Per-test fixture builders — each test owns the exact data it asserts on.
const makeStats = (overrides = {}) => {
  const { spellAbilities: spellAbilitiesOverrides, ...rest } = overrides;
  return {
    name: 'Torgrim',
    level: 5,
    class: { name: 'Bard', major: { name: 'Bard' } },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    proficiency: 3,
    automation: { passives: [], actions: [] },
    ...rest,
    spellAbilities: { spells: [], ...spellAbilitiesOverrides },
  };
};

const makeSpell = (overrides = {}) => ({
  name: 'Thunderwave',
  level: 1,
  description: 'A wave of thunderous force sweeps out from you.',
  casting_time: '1 action',
  range: '15 feet',
  duration: 'Instantaneous',
  school: 'Evocation',
  ...overrides,
});

const castButton = () => screen.getByRole('button', { name: /Cast Spell/ });

// Renders the popup and returns the cast spy. `clicks: true` also clicks the
// (possibly disabled) Cast Spell button so tests can assert it fires nothing.
const renderPopup = ({ spell, playerStats, upcastLevels = [], clicks = false }) => {
  const onCast = vi.fn();
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      onCast={onCast}
      upcastLevels={upcastLevels}
    />
  );
  if (clicks) fireEvent.click(castButton());
  return onCast;
};

const raging = (buffs = [{ name: 'Rage' }]) => vi.mocked(getActiveBuffs).mockReturnValue(buffs);

// Fixture with EVERY non-rage payment avenue open: a full base-slot pool,
// an upcast ladder with live slots, and a multi-tier damage ladder so the
// spell is upcastable. If casting is blocked on this fixture, it is the
// Rage gate and nothing else doing it.
const FULL_SLOTS = { spell_slots_level_1: 4, spell_slots_level_2: 2 };
const UPCAST_LADDER = [
  { level: 1, formula: '2d8', availableSlots: 4 },
  { level: 2, formula: '3d8', availableSlots: 2 },
];
const fullyArmedSpell = makeSpell({
  damage: { damage_at_slot_level: { '1': '2d8', '2': '3d8', '3': '4d8' } },
});

describe('SpellDetailPopup — Rage casting restriction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('slot-paid casts', () => {
    it('disables Cast Spell and casts nothing while raging, even with full slots and an open upcast ladder', () => {
      raging();

      const onCast = renderPopup({
        spell: fullyArmedSpell,
        playerStats: makeStats({ spellAbilities: FULL_SLOTS }),
        upcastLevels: UPCAST_LADDER,
        clicks: true,
      });

      expect(castButton()).toBeDisabled();
      expect(onCast).not.toHaveBeenCalled();
    });

    it('control: casts the identical fully-armed setup when not raging', () => {
      const onCast = renderPopup({
        spell: fullyArmedSpell,
        playerStats: makeStats({ spellAbilities: FULL_SLOTS }),
        upcastLevels: UPCAST_LADDER,
        clicks: true,
      });

      expect(castButton()).toBeEnabled();
      expect(onCast).toHaveBeenCalledTimes(1);
    });
  });

  describe('free-cast authorization', () => {
    // Natural Recovery runtime selection authorizes a slotless free cast.
    const mistyStep = makeSpell({
      name: 'Misty Step',
      casting_time: '1 bonus action',
      range: '30 feet',
      school: 'Conjuration',
      damage: null,
    });
    const zeroSlotsStats = makeStats({ spellAbilities: { spell_slots_level_1: 0 } });

    beforeEach(() => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
        key === 'naturalRecoveryFreeCast' ? ['Misty Step'] : null
      );
    });

    it('control: authorizes the free cast when not raging', () => {
      const onCast = renderPopup({ spell: mistyStep, playerStats: zeroSlotsStats, clicks: true });

      expect(castButton()).toBeEnabled();
      expect(onCast).toHaveBeenCalledTimes(1);
    });

    it('free casts are still denied while raging', () => {
      raging();

      const onCast = renderPopup({ spell: mistyStep, playerStats: zeroSlotsStats, clicks: true });

      expect(castButton()).toBeDisabled();
      expect(onCast).not.toHaveBeenCalled();
    });
  });

  describe('FT-068 Quick Ritual channel', () => {
    // FT-068: a prepared granted ritual castable slot-free once per Long Rest.
    const identifySpell = makeSpell({
      name: 'Identify',
      casting_time: '1 minute',
      range: 'Touch',
      school: 'Divination',
      damage: null,
      ritual: true,
      _ritualMasterRitual: true,
    });
    const zeroSlotsStats = makeStats({ spellAbilities: { spell_slots_level_1: 0 } });

    it('control: an armed Quick Ritual enables casting when not raging', () => {
      renderPopup({ spell: identifySpell, playerStats: zeroSlotsStats });

      fireEvent.click(screen.getByRole('checkbox', { name: /Quick Ritual/ }));

      expect(castButton()).toBeEnabled();
    });

    it('a ticked Quick Ritual stays blocked while raging', () => {
      raging();

      const onCast = renderPopup({ spell: identifySpell, playerStats: zeroSlotsStats });

      fireEvent.click(screen.getByRole('checkbox', { name: /Quick Ritual/ }));
      fireEvent.click(castButton());

      expect(castButton()).toBeDisabled();
      expect(onCast).not.toHaveBeenCalled();
    });
  });

  describe('CLA-299 Ritual Adept auto-cast channel', () => {
    // 2024 Wizard spellbook ritual, unprepared → the popup auto-casts it
    // slotless as a Ritual. Rage must deny this channel too.
    const detectMagic = makeSpell({
      name: 'Detect Magic',
      casting_time: '1 minute',
      range: 'Self',
      duration: 'Concentration, up to 10 minutes',
      school: 'Divination',
      damage: null,
      ritual: true,
    });
    const wizardStats = makeStats({
      class: { name: 'Wizard', major: { name: 'Wizard' } },
      rules: '2024',
      spellAbilities: {
        spells: [{ name: 'Detect Magic', level: 1, ritual: true }],
        spell_slots_level_1: 0,
      },
    });

    it('control: the unprepared book ritual auto-enables casting when not raging', () => {
      renderPopup({ spell: detectMagic, playerStats: wizardStats });

      expect(castButton()).toBeEnabled();
    });

    it('the Ritual Adept slotless channel stays blocked while raging', () => {
      raging();

      const onCast = renderPopup({ spell: detectMagic, playerStats: wizardStats, clicks: true });

      expect(castButton()).toBeDisabled();
      expect(onCast).not.toHaveBeenCalled();
    });
  });

  describe('only a buff named "Rage" restricts casting', () => {
    it.each([
      { buffs: [{ name: 'Bless' }] },
      { buffs: [{ name: 'Enrage' }] },
      { buffs: [{ name: 'Zealous Presence' }, { name: 'Bless' }] },
    ])('leaves casting enabled with $buffs', ({ buffs }) => {
      raging(buffs);

      const onCast = renderPopup({
        spell: fullyArmedSpell,
        playerStats: makeStats({ spellAbilities: FULL_SLOTS }),
        upcastLevels: UPCAST_LADDER,
        clicks: true,
      });

      expect(castButton()).toBeEnabled();
      expect(onCast).toHaveBeenCalledTimes(1);
    });
  });
});
