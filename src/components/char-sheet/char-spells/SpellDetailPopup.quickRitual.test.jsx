// @improved-by-ai
// FT-068 regression: SpellDetailPopup Quick Ritual affordance for Ritual Master
// feat-granted prepared ritual spells — the checkbox offers a regular-casting-time
// slot-free cast, is disabled + warned once the once-per-long-rest counter
// (_Ritual_Master_quickRitualUsed, reset by restRules-longRest) is spent, and the
// cast payload carries quickRitual only while the box is ticked.
// Already covered elsewhere and deliberately NOT duplicated here:
//   - zero-slot cast enabled by a ticked Quick Ritual (non-rage control)
//     ......... SpellDetailPopup.rageRestriction.test.jsx
//   - Quick Ritual blocked while raging .... SpellDetailPopup.rageRestriction.test.jsx
//   - CLA-299 Cast-as-Ritual channel ........ SpellDetailPopup.ritualAdept.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/ui/sanitize.js', () => ({
  sanitizeHtml: (html) => html,
}));

const CAMPAIGN = 'test-campaign';
const QUICK_RITUAL_USED_KEY = '_Ritual_Master_quickRitualUsed';

// Per-test fixture builders — each test owns the exact data it asserts on.
const makeStats = (overrides = {}) => ({
  name: 'HexWarlock',
  level: 14,
  class: { name: 'Warlock', spell_casting_ability: 'Charisma' },
  abilities: [{ name: 'Charisma', bonus: 4 }],
  proficiency: 5,
  spellAbilities: {
    spellCastingAbility: 'Charisma',
    saveDc: 17,
    modifier: 4,
    spell_slots_level_1: 0,
    spell_slots_level_5: 2,
  },
  automation: { passives: [], actions: [], bonusActions: [], specialActions: [] },
  ...overrides,
});

const makeGrantedRitual = (overrides = {}) => ({
  name: 'Identify',
  level: 1,
  description: '<p>You choose one object that you must touch.</p>',
  casting_time: '1 minute',
  range: 'Touch',
  duration: 'Instantaneous',
  school: 'Divination',
  damage: null,
  ritual: true,
  _ritualMasterRitual: true,
  spellCastingAbility: 'Charisma',
  ...overrides,
});

const quickRitualCheckbox = () => screen.getByRole('checkbox', { name: /Quick Ritual/ });
const castButton = () => screen.getByRole('button', { name: /Cast Spell/ });

// Renders the popup with sane defaults and returns the cast spy.
const renderPopup = ({ spell, playerStats = makeStats(), onCast = vi.fn() } = {}) => {
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      onCast={onCast}
    />
  );
  return onCast;
};

// Marks the once-per-long-rest counter as spent on a long-rest timestamp.
const markQuickRitualSpent = () =>
  vi.mocked(useRuntimeValue).mockImplementation((_name, key) =>
    key === QUICK_RITUAL_USED_KEY ? 17_000_000_000_000 : null
  );

describe('SpellDetailPopup — FT-068 Quick Ritual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(useRuntimeValue).mockReturnValue(null);
  });

  it('offers an unticked Quick Ritual checkbox, flagged once per Long Rest, while the counter is fresh', () => {
    renderPopup({ spell: makeGrantedRitual() });

    const checkbox = quickRitualCheckbox();
    expect(checkbox).not.toBeDisabled();
    expect(checkbox).not.toBeChecked();
    expect(checkbox.closest('label')).toHaveTextContent(/once per long rest/i);
    expect(screen.queryByText(/Quick Ritual already used/)).not.toBeInTheDocument();
  });

  it('sends quickRitual:true in the cast payload while the box is ticked', () => {
    const onCast = renderPopup({ spell: makeGrantedRitual() });

    fireEvent.click(quickRitualCheckbox());
    expect(quickRitualCheckbox()).toBeChecked();

    fireEvent.click(castButton());
    expect(onCast).toHaveBeenCalledTimes(1);
    expect(onCast.mock.calls[0][0].quickRitual).toBe(true);
  });

  it('reverts the payload to quickRitual:false when the ticked box is unticked again', () => {
    const onCast = renderPopup({ spell: makeGrantedRitual() });

    fireEvent.click(quickRitualCheckbox());
    fireEvent.click(quickRitualCheckbox());
    expect(quickRitualCheckbox()).not.toBeChecked();

    fireEvent.click(castButton());
    expect(onCast).toHaveBeenCalledTimes(1);
    expect(onCast.mock.calls[0][0].quickRitual).toBe(false);
  });

  it('never sends quickRitual:true when the box is left untouched', () => {
    const onCast = renderPopup({ spell: makeGrantedRitual() });

    fireEvent.click(castButton());
    expect(onCast).toHaveBeenCalledTimes(1);
    expect(onCast.mock.calls[0][0].quickRitual).toBe(false);
  });

  it('disables the checkbox and warns once Quick Ritual is spent for the Long Rest', () => {
    markQuickRitualSpent();
    renderPopup({ spell: makeGrantedRitual() });

    expect(quickRitualCheckbox()).toBeDisabled();
    expect(screen.getByText(/Quick Ritual already used/)).toBeInTheDocument();
    // Server-first contract: the spent state is subscribed from the canonical
    // runtime key that restRules-longRest resets.
    expect(vi.mocked(useRuntimeValue)).toHaveBeenCalledWith(
      'HexWarlock',
      QUICK_RITUAL_USED_KEY,
      CAMPAIGN
    );
  });

  it('cannot arm a spent Quick Ritual — casts fall back to quickRitual:false with a paid slot', () => {
    markQuickRitualSpent();
    const onCast = renderPopup({ spell: makeGrantedRitual() });

    fireEvent.click(quickRitualCheckbox());
    expect(quickRitualCheckbox()).not.toBeChecked();

    fireEvent.click(castButton());
    expect(onCast).toHaveBeenCalledTimes(1);
    expect(onCast.mock.calls[0][0].quickRitual).toBe(false);
  });

  describe('affordance eligibility', () => {
    it.each([
      { label: 'an ungranted ritual spell', spell: makeGrantedRitual({ _ritualMasterRitual: undefined }) },
      { label: 'a granted marker on a non-ritual spell', spell: makeGrantedRitual({ ritual: false }) },
    ])('does not offer Quick Ritual for $label', ({ spell }) => {
      renderPopup({ spell });

      expect(screen.queryByRole('checkbox', { name: /Quick Ritual/ })).not.toBeInTheDocument();
    });
  });
});
