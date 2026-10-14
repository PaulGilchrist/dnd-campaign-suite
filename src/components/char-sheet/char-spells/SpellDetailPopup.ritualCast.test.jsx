// @improved-by-ai
// CLA-234 regression: SpellDetailPopup for a Nature Speaker ritual-only spell
// (Path of the Wild Heart Barbarian, lv5 slots EMPTY at every test).
// The popup delegates authorization to the REAL isFreeCastAuthorized service
// (spellPreparationService FREE_CAST_CHECKS, keyed on the _ritualOnly stamp of
// the SPELLBOOK ENTRY) with the runtime store mocked — service internals have
// their own suites. This file proves the component contract for this lane:
//   - the "Ritual Cast" banner shows with zero spell slots (never the classic
//     "Free Cast" line — the banners are mutually exclusive by _ritualOnly)
//   - Cast Spell is enabled while the meta honestly reports 0 slots
//   - the per-spell Wisdom casting-ability override renders (and is absent
//     when a spell carries no override)
//   - the cast payload carries freeCastAuthorized:true without the popup
//     fabricating any payment (no runtime writes)
//   - an unstamped spellbook entry is denied honestly at zero slots
// Bewitching Magic's classic free-cast lane for non-ritual spells lives in
// SpellDetailPopup.freeCast.test.jsx — only the banner-exclusivity delta of
// that lane is re-checked here.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

const CAMPAIGN = 'test-campaign';
const RITUAL_TEXT = 'Ritual Cast — cast as a Ritual, no spell slot consumed';
const FREE_CAST_TEXT = 'Free Cast — no spell slot consumed';
const NO_SLOTS_TEXT = 'No spell slots available for this level.';

// lv5 spellbook entry granted by Nature Speaker; stamped _ritualOnly + Wisdom
// override by spellCalc2024 (CLA-234 pattern).
const makeCommuneEntry = (overrides = {}) => ({
  name: 'Commune with Nature',
  level: 5,
  description: '<p>You commune with nature spirits.</p>',
  casting_time: 'Ritual',
  range: 'Self',
  duration: 'Instantaneous',
  school: 'Divination',
  damage: null,
  ritual: true,
  _ritualOnly: true,
  _ritualFeature: 'Nature Speaker',
  spellCastingAbility: 'Wisdom',
  ...overrides,
});

// lv13 Path of the Wild Heart Barbarian — class ability is Intelligence, the
// Wisdom override is per-spell only. lv5 slot deliberately EMPTY: any cast
// that happens must be the slotless ritual, never an incidental payment.
const makeStats = (spellEntry = makeCommuneEntry()) => ({
  name: 'DraconicDragon',
  level: 13,
  class: { name: 'Barbarian', spell_casting_ability: 'Intelligence', major: { name: 'Path of the Wild Heart', spell_casting_ability: 'Wisdom' } },
  spellAbilities: {
    spellCastingAbility: 'Intelligence',
    spell_slots_level_5: 0,
    spells: [spellEntry],
  },
  automation: { passives: [], actions: [], bonusActions: [], specialActions: [] },
});

const renderPopup = (spell, playerStats = makeStats(), extraProps = {}) => {
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

describe('SpellDetailPopup — Nature Speaker ritual-only cast (CLA-234)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
  });

  it('shows the ritual-only cast banner at zero spell slots and keeps Cast Spell enabled', () => {
    renderPopup(makeCommuneEntry());

    expect(screen.getByText(RITUAL_TEXT)).toBeInTheDocument();
    // Banners are mutually exclusive: a ritual-only grant never shows the
    // classic free-cast line, and the zero-slot state is reported honestly.
    expect(screen.queryByText(FREE_CAST_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(NO_SLOTS_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    // Label lives in the <b>; assert the value sits in the same meta row.
    expect(screen.getByText('Slots Remaining:').closest('span')).toHaveTextContent(/^Slots Remaining:\s*0$/);
  });

  it('displays the spell\'s Wisdom casting-ability override, not the class default', () => {
    renderPopup(makeCommuneEntry());

    expect(screen.getByText('Casting Ability:').closest('span')).toHaveTextContent(/^Casting Ability:\s*Wisdom$/);
  });

  it('omits the Casting Ability row for a spell with no per-spell override', () => {
    renderPopup(makeCommuneEntry({ spellCastingAbility: undefined }));

    expect(screen.queryByText(/Casting Ability:/)).not.toBeInTheDocument();
  });

  it('carries freeCastAuthorized:true in the cast payload and never writes runtime state from the popup', () => {
    const onCast = renderPopup(makeCommuneEntry());

    fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

    expect(onCast).toHaveBeenCalledTimes(1);
    const payload = onCast.mock.calls[0][0];
    expect(payload.name).toBe('Commune with Nature');
    expect(payload.freeCastAuthorized).toBe(true);
    // This lane authorizes via the _ritualOnly stamp alone — the other
    // slotless channels (popup checkboxes / quick ritual) must not bleed in.
    expect(payload.ritualCast).toBe(false);
    expect(payload.quickRitual).toBe(false);
    expect(payload.isUpcast).toBe(false);
    // The popup only authorizes and reports — payment/consumption happens
    // downstream in prepareSpellCast, never fabricated here.
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('denies the cast honestly when the spellbook entry lacks the _ritualOnly stamp', () => {
    // Cosmetic ritual props stay on the popup spell: authorization comes from
    // the SPELLBOOK ENTRY stamp, not from casting_time or the popup display.
    const unStampedEntryStats = makeStats(makeCommuneEntry({ _ritualOnly: undefined }));

    renderPopup(makeCommuneEntry(), unStampedEntryStats);

    expect(screen.queryByText(RITUAL_TEXT)).not.toBeInTheDocument();
    expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
  });

  it('shows the classic Free Cast line — never the ritual line — for an authorized non-ritual spell', () => {
    // Banner exclusivity delta (full lane coverage: SpellDetailPopup.freeCast.test.jsx).
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      (key === '_Bewitching_Magic_freeCast' ? true : null));
    const spell = {
      name: 'Misty Step',
      level: 2,
      description: 'Teleport a short distance.',
      casting_time: '1 bonus action',
      range: 'Self',
      duration: 'Instantaneous',
      school: 'Conjuration',
      damage: null,
    };

    renderPopup(spell, makeStats(spell));

    expect(screen.getByText(FREE_CAST_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(RITUAL_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
  });
});
