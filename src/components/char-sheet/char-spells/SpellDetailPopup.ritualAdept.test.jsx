// @improved-by-ai
// CLA-299 regression: SpellDetailPopup Ritual Adept channel (2024 Wizard lv1).
// Eligibility runs through the REAL isWizardRitualAdeptSpell service — only the
// runtime store and the sanitizer are mocked, so class/ruleset/spellbook/ritual-tag
// gating stays honest in these assertions:
//   - unprepared spellbook ritual  → auto ritual-only cast: banner pair, slotless at
//     zero slots, NO payment checkbox (RAW: unprepared = ritual-only), ritualCast:true
//   - prepared spellbook ritual    → explicit "Cast as Ritual" opt-in; ticked pays no
//     slot and confirms in the banner; unticked keeps the slot payment byte-identical
//   - upcast selected              → channel revoked (rituals cast at their base level)
//   - non-Wizard / 5e / non-ritual / spell not in the spellbook → neither affordance,
//     and zero slots still shows the honest "No spell slots available" denial
// Covered elsewhere and deliberately NOT duplicated here:
//   - Rage blocking this channel ......... SpellDetailPopup.rageRestriction.test.jsx
//   - FT-068 Quick Ritual checkbox ....... SpellDetailPopup.quickRitual.test.jsx
//   - CLA-234 Nature Speaker _ritualOnly . SpellDetailPopup.ritualCast.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

const CAMPAIGN = 'test-campaign';
const AUTO_BANNER = 'Ritual Cast — no spell slot consumed';
const BOOK_NOTE = 'Ritual Adept: read from your spellbook — casting time +10 minutes.';
const TICK_BANNER = 'Ritual Cast — no spell slot consumed (+10 minutes, read from your spellbook)';
const FREE_CAST_TEXT = 'Free Cast — no spell slot consumed';
const NO_SLOTS_TEXT = 'No spell slots available for this level.';

// Per-test fixture factories — each test owns the exact data it asserts on.
const makeSpell = (overrides = {}) => ({
  name: 'Identify',
  level: 1,
  description: '<p>You choose one object that you must touch.</p>',
  casting_time: '1 minute or Ritual',
  range: 'Touch',
  duration: 'Instantaneous',
  school: 'Divination',
  damage: null,
  ritual: true,
  prepared: '',
  ...overrides,
});

// 2024 Wizard with Ritual Adept. Slot maxima live in spellAbilities; with the
// runtime store mocked to null the popup falls back to these — no extra stubbing.
const makeWizardStats = ({ lv1 = 0, spells = [makeSpell()] } = {}) => ({
  name: 'DivinationWizard',
  level: 20,
  rules: '2024',
  class: { name: 'Wizard', spell_casting_ability: 'Intelligence' },
  abilities: [{ name: 'Intelligence', bonus: 7 }],
  proficiency: 6,
  spellAbilities: {
    spellCastingAbility: 'Intelligence',
    saveDc: 21,
    modifier: 7,
    spell_slots_level_1: lv1,
    spells,
  },
  automation: { passives: [], actions: [], bonusActions: [], specialActions: [] },
});

const castButton = () => screen.getByRole('button', { name: /Cast Spell/ });
const ritualCheckbox = () => screen.getByRole('checkbox', { name: /Cast as Ritual/ });

// Renders the popup; by default the wizard's spellbook carries the exact spell
// object (the canonical entry — service eligibility and popup display must agree).
const renderPopup = ({ spell, playerStats, extraProps = {} } = {}) => {
  const onCast = extraProps.onCast || vi.fn();
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats || makeWizardStats({ spells: [spell] })}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      onCast={onCast}
      {...extraProps}
    />
  );
  return onCast;
};

// Neither the auto banner pair nor the opt-in checkbox — the channel is absent.
const expectNoRitualAdeptAffordance = () => {
  expect(screen.queryByText(AUTO_BANNER)).not.toBeInTheDocument();
  expect(screen.queryByText(BOOK_NOTE)).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: /Cast as Ritual/ })).not.toBeInTheDocument();
};

describe('SpellDetailPopup — CLA-299 Ritual Adept channel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(useRuntimeValue).mockReturnValue(null);
  });

  describe('unprepared spellbook ritual (auto ritual-only)', () => {
    it('auto-casts slotless at zero slots: banner pair, no slot warning, no payment checkbox', () => {
      renderPopup({ spell: makeSpell() });

      expect(screen.getByText(AUTO_BANNER)).toBeInTheDocument();
      expect(screen.getByText(BOOK_NOTE)).toBeInTheDocument();
      // Ritual-only channel — the popup must not offer a slot-payment alternative,
      // and the classic Free Cast / no-slots lines must not leak in.
      expect(screen.queryByRole('checkbox', { name: /Cast as Ritual/ })).not.toBeInTheDocument();
      expect(screen.queryByText(FREE_CAST_TEXT)).not.toBeInTheDocument();
      expect(screen.queryByText(NO_SLOTS_TEXT)).not.toBeInTheDocument();
      expect(castButton()).toBeEnabled();
    });

    it('carries ritualCast:true and freeCastAuthorized:true, and pays nothing from the popup', () => {
      const onCast = renderPopup({ spell: makeSpell() });

      fireEvent.click(castButton());
      expect(onCast).toHaveBeenCalledTimes(1);
      const payload = onCast.mock.calls[0][0];
      expect(payload.name).toBe('Identify');
      expect(payload.isUpcast).toBe(false);
      expect(payload.ritualCast).toBe(true);
      expect(payload.freeCastAuthorized).toBe(true);
      // Server-first: the popup only arms and reports — slot consumption happens
      // downstream in prepareSpellCast, never from this component.
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('prepared spellbook ritual (opt-in checkbox)', () => {
    it('offers an unticked Cast as Ritual checkbox; ticking arms the slotless banner', () => {
      const spell = makeSpell({ prepared: 'Prepared' });
      const onCast = renderPopup({ spell, playerStats: makeWizardStats({ lv1: 3, spells: [spell] }) });

      const checkbox = ritualCheckbox();
      expect(checkbox).not.toBeChecked();
      expect(screen.queryByText(TICK_BANNER)).not.toBeInTheDocument();

      fireEvent.click(checkbox);
      expect(ritualCheckbox()).toBeChecked();
      expect(screen.getByText(TICK_BANNER)).toBeInTheDocument();

      fireEvent.click(castButton());
      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0].ritualCast).toBe(true);
    });

    it('unticked cast pays the slot: ritualCast:false, freeCastAuthorized:false, Slots Remaining shown', () => {
      const spell = makeSpell({ prepared: 'Prepared' });
      const onCast = renderPopup({ spell, playerStats: makeWizardStats({ lv1: 3, spells: [spell] }) });

      fireEvent.click(castButton());
      expect(onCast).toHaveBeenCalledTimes(1);
      const payload = onCast.mock.calls[0][0];
      expect(payload.ritualCast).toBe(false);
      expect(payload.freeCastAuthorized).toBe(false);
      expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
      expect(screen.queryByText(AUTO_BANNER)).not.toBeInTheDocument();
      expect(screen.queryByText(TICK_BANNER)).not.toBeInTheDocument();
    });

    it('denies the unticked cast at zero slots with the honest no-slots warning', () => {
      renderPopup({ spell: makeSpell({ prepared: 'Prepared' }) });

      expect(ritualCheckbox()).not.toBeChecked();
      expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
      expect(castButton()).toBeDisabled();
    });

    it('ticking the checkbox at zero slots enables the cast and arms the slotless banner', () => {
      const onCast = renderPopup({ spell: makeSpell({ prepared: 'Prepared' }) });

      fireEvent.click(ritualCheckbox());
      expect(ritualCheckbox()).toBeChecked();
      expect(castButton()).toBeEnabled();
      expect(screen.queryByText(NO_SLOTS_TEXT)).not.toBeInTheDocument();
      expect(screen.getByText(TICK_BANNER)).toBeInTheDocument();

      fireEvent.click(castButton());
      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0].ritualCast).toBe(true);
    });

    it('"Always" prepared counts as prepared — opt-in checkbox, no auto banner', () => {
      renderPopup({ spell: makeSpell({ prepared: 'Always' }), playerStats: makeWizardStats({ lv1: 1 }) });

      expect(ritualCheckbox()).not.toBeChecked();
      expect(screen.queryByText(AUTO_BANNER)).not.toBeInTheDocument();
      expect(screen.queryByText(BOOK_NOTE)).not.toBeInTheDocument();
    });
  });

  describe('upcast revokes the channel (rituals cast at base level)', () => {
    it('selecting a higher level drops the auto banner and pays the slot', () => {
      const spell = makeSpell({ damage: { damage_at_slot_level: { '1': '2d6', '2': '3d6' } } });
      const onCast = renderPopup({
        spell,
        playerStats: makeWizardStats({ lv1: 1, spells: [spell] }),
        extraProps: {
          upcastLevels: [
            { level: 1, formula: '2d6', availableSlots: 1 },
            { level: 2, formula: '3d6', availableSlots: 1 },
          ],
        },
      });

      // Base level is the default selection — ritual channel armed.
      expect(screen.getByText(AUTO_BANNER)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('radio', { name: /Level 2/ }));
      expect(screen.queryByText(AUTO_BANNER)).not.toBeInTheDocument();
      expect(screen.queryByText(BOOK_NOTE)).not.toBeInTheDocument();

      fireEvent.click(castButton());
      expect(onCast).toHaveBeenCalledTimes(1);
      const payload = onCast.mock.calls[0][0];
      expect(payload.isUpcast).toBe(true);
      expect(payload.upcastLevel).toBe(2);
      expect(payload.ritualCast).toBe(false);
      expect(payload.freeCastAuthorized).toBe(false);
    });
  });

  describe('eligibility negatives — neither affordance', () => {
    it('offers nothing to a non-Wizard class (2024 Warlock)', () => {
      renderPopup({
        spell: makeSpell(),
        playerStats: {
          ...makeWizardStats(),
          class: { name: 'Warlock', spell_casting_ability: 'Charisma' },
        },
      });

      expectNoRitualAdeptAffordance();
    });

    it('offers nothing to a 5e wizard and still demands honest slot payment at zero slots', () => {
      const spell = makeSpell({ prepared: 'Prepared' });
      renderPopup({ spell, playerStats: { ...makeWizardStats({ spells: [spell] }), rules: '5e' } });

      expectNoRitualAdeptAffordance();
      // Prepared-only RAW for 5e: no free-cast channel leaks into the legacy ruleset.
      expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
      expect(castButton()).toBeDisabled();
    });

    it('offers nothing for a spellbook spell without the ritual tag', () => {
      const spell = makeSpell({ name: 'Burning Hands', ritual: false, casting_time: '1 action', school: 'Evocation' });
      renderPopup({ spell, playerStats: makeWizardStats({ spells: [spell] }) });

      expectNoRitualAdeptAffordance();
      expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
      expect(castButton()).toBeDisabled();
    });

    it('offers nothing for a ritual spell that is NOT in the wizard spellbook', () => {
      // Popup opened for a ritual spell the book does not carry — no grant, no free cast.
      const bookOnly = makeSpell({ name: 'Identify' });
      renderPopup({
        spell: makeSpell({ name: 'Gentle Repose' }),
        playerStats: makeWizardStats({ spells: [bookOnly] }),
      });

      expectNoRitualAdeptAffordance();
      expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
      expect(castButton()).toBeDisabled();
    });
  });
});
