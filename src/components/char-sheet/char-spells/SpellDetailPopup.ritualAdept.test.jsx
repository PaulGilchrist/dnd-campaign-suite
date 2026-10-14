// @maintained-by-ai
// CLA-299 regression: SpellDetailPopup Ritual Adept channel (2024 Wizard lv1).
// Eligibility runs through the REAL isWizardRitualAdeptSpell service — only the
// runtime store and the sanitizer are mocked, so class/ruleset/spellbook/ritual-tag
// gating stays honest here. The service's own guard branches are covered by
// spellPreparationService.ritualAdept.test.js; this file proves the popup's wiring:
//   - unprepared spellbook ritual → auto ritual-only cast: banner pair, slotless at
//     zero slots, NO payment checkbox, ritualCast:true payload (RAW: unprepared =
//     ritual-only), and the popup pays nothing (server-first)
//   - prepared spellbook ritual   → explicit "Cast as Ritual" opt-in: unticked pays
//     the slot byte-identically; ticking arms the banner and pays nothing
//   - ticking at zero slots       → unlocks the otherwise-denied cast
//   - prepared:'Always'           → counts as prepared (opt-in checkbox, never auto)
//   - upcast selected             → channel revoked (rituals cast at their base level)
//   - service denies (5e wizard)  → neither affordance, honest slot denial at zero
// Covered elsewhere and deliberately NOT duplicated here:
//   - Rage blocking this channel ......... SpellDetailPopup.rageRestriction.test.jsx
//   - FT-068 Quick Ritual checkbox ....... SpellDetailPopup.quickRitual.test.jsx
//   - CLA-234 Nature Speaker _ritualOnly . SpellDetailPopup.ritualCast.test.jsx
//   - Service guard branches (non-Wizard, missing ritual tag, spell absent from the
//     spellbook, missing spellAbilities) ... spellPreparationService.ritualAdept.test.js
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

describe('SpellDetailPopup — CLA-299 Ritual Adept channel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(useRuntimeValue).mockReturnValue(null);
  });

  it('unprepared spellbook ritual auto-casts slotless: banner pair, no checkbox, pays nothing', () => {
    const onCast = renderPopup({ spell: makeSpell() });

    // Auto ritual-only channel: banner pair confirms, and the popup must not offer a
    // slot-payment alternative — the classic Free Cast / no-slots lines must not leak in.
    expect(screen.getByText(AUTO_BANNER)).toBeInTheDocument();
    expect(screen.getByText(BOOK_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Cast as Ritual/ })).not.toBeInTheDocument();
    expect(screen.queryByText(FREE_CAST_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(NO_SLOTS_TEXT)).not.toBeInTheDocument();
    expect(castButton()).toBeEnabled();

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

  it('prepared spellbook ritual pays its slot until the Cast as Ritual checkbox is ticked', () => {
    const spell = makeSpell({ prepared: 'Prepared' });
    const onCast = renderPopup({ spell, playerStats: makeWizardStats({ lv1: 3, spells: [spell] }) });

    // Opt-in state: unticked checkbox, slot payment intact, no slotless banners.
    expect(ritualCheckbox()).not.toBeChecked();
    expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
    expect(screen.queryByText(AUTO_BANNER)).not.toBeInTheDocument();
    expect(screen.queryByText(TICK_BANNER)).not.toBeInTheDocument();

    fireEvent.click(castButton());
    const paid = onCast.mock.calls[0][0];
    expect(paid.ritualCast).toBe(false);
    expect(paid.freeCastAuthorized).toBe(false);

    // Ticked: the channel arms and the same button now casts slotless.
    fireEvent.click(ritualCheckbox());
    expect(ritualCheckbox()).toBeChecked();
    expect(screen.getByText(TICK_BANNER)).toBeInTheDocument();

    fireEvent.click(castButton());
    expect(onCast).toHaveBeenCalledTimes(2);
    expect(onCast.mock.calls[1][0].ritualCast).toBe(true);
  });

  it('ticking the checkbox at zero slots replaces the honest denial with a slotless cast', () => {
    const spell = makeSpell({ prepared: 'Prepared' });
    const onCast = renderPopup({ spell });

    expect(ritualCheckbox()).not.toBeChecked();
    expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
    expect(castButton()).toBeDisabled();

    fireEvent.click(ritualCheckbox());
    expect(ritualCheckbox()).toBeChecked();
    expect(castButton()).toBeEnabled();
    expect(screen.queryByText(NO_SLOTS_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText(TICK_BANNER)).toBeInTheDocument();

    fireEvent.click(castButton());
    expect(onCast).toHaveBeenCalledTimes(1);
    expect(onCast.mock.calls[0][0].ritualCast).toBe(true);
  });

  it('"Always" prepared counts as prepared — opt-in checkbox, never the auto banner', () => {
    renderPopup({ spell: makeSpell({ prepared: 'Always' }), playerStats: makeWizardStats({ lv1: 1 }) });

    expect(ritualCheckbox()).not.toBeChecked();
    expect(screen.queryByText(AUTO_BANNER)).not.toBeInTheDocument();
    expect(screen.queryByText(BOOK_NOTE)).not.toBeInTheDocument();
  });

  it('selecting a higher slot level revokes the channel and pays the upcast slot', () => {
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

  it('denies honestly when the service says no — 5e wizard sees neither affordance', () => {
    // One representative ineligible path through the popup wiring; every service guard
    // branch (class, ruleset, ritual tag, spellbook membership) has its own coverage
    // in spellPreparationService.ritualAdept.test.js.
    const spell = makeSpell({ prepared: 'Prepared' });
    renderPopup({ spell, playerStats: { ...makeWizardStats({ spells: [spell] }), rules: '5e' } });

    expect(screen.queryByRole('checkbox', { name: /Cast as Ritual/ })).not.toBeInTheDocument();
    expect(screen.queryByText(AUTO_BANNER)).not.toBeInTheDocument();
    expect(screen.queryByText(BOOK_NOTE)).not.toBeInTheDocument();
    // Prepared-only RAW for 5e: no free-cast channel leaks into the legacy ruleset.
    expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
    expect(castButton()).toBeDisabled();
  });
});
