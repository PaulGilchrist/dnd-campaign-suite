// @maintained-by-ai
// SpellDetailPopup free-cast authorization lane (component-level).
// The popup delegates channel logic to the REAL isFreeCastAuthorized service
// (spellPreparationService) — every channel (Natural Recovery, Bewitching
// Magic, Spell Mastery, Signature Spells, Savants, automation free_spell
// entries, buffs) has its own service suite (spellPreparationService.*.test.js).
// This file proves only the component contract:
//   • granted → classic "Free Cast" banner, Cast works at ZERO spell slots,
//     payload carries freeCastAuthorized:true, popup never pays (no runtime writes);
//   • denied → no banner, honest "No spell slots available" warning, Cast
//     disabled and a click does nothing;
//   • playerStats (automation entries) actually reach the service;
//   • CLA-312: the component-owned upcast selector gates authorization on the
//     EFFECTIVE level — upcasting revokes the free cast and pays the slot.
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
const freeCastText = 'Free Cast — no spell slot consumed';
const noSlotsText = 'No spell slots available for this level.';

const makeSpell = (overrides = {}) => ({
  name: 'Magic Missile',
  level: 1,
  description: 'Three darts of force strike a creature.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  school: 'Evocation',
  damage: null,
  ...overrides,
});

// Slots are deliberately EMPTY at every level in every test: any cast that
// happens must be free. If authorization broke, the popup would show
// "No spell slots available" and disable Cast — the assertions catch it.
const makeStats = (overrides = {}) => {
  const { automation: automationOverrides, spellAbilities: spellAbilitiesOverrides, ...rest } = overrides;
  return {
    name: 'Elara',
    level: 5,
    class: { name: 'Wizard', major: { name: 'Wizard' } },
    abilities: [{ name: 'Intelligence', bonus: 3 }],
    proficiency: 3,
    spellAbilities: {
      spell_slots_level_1: 0,
      spell_slots_level_2: 0,
      spell_slots_level_3: 0,
      spells: [],
      ...spellAbilitiesOverrides,
    },
    automation: { passives: [], actions: [], bonusActions: [], specialActions: [], ...automationOverrides },
    ...rest,
  };
};

// Stub the runtime store from a key → value map; unlisted keys read null.
const stubRuntime = (values = {}) => {
  vi.mocked(getRuntimeValue).mockImplementation((_playerName, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null);
};

const renderPopup = (spell, playerStats = makeStats(), extraProps = {}) => {
  const onCast = extraProps.onCast || vi.fn();
  const utils = render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={CAMPAIGN}
      onClose={vi.fn()}
      onCast={onCast}
      {...extraProps}
    />
  );
  return { onCast, ...utils };
};

describe('SpellDetailPopup — Free Cast authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
  });

  it('grants a free cast at zero slots (banner, enabled Cast) and reports it in the payload without paying', () => {
    // Natural Recovery runtime lane (channel selection itself: service suites).
    stubRuntime({ naturalRecoveryFreeCast: ['Healing Word'] });
    const { onCast } = renderPopup(makeSpell({ name: 'Healing Word' }));

    expect(screen.getByText(freeCastText)).toBeInTheDocument();
    expect(screen.queryByText(noSlotsText)).not.toBeInTheDocument();
    const castButton = screen.getByRole('button', { name: /Cast Spell/ });
    expect(castButton).toBeEnabled();

    fireEvent.click(castButton);
    expect(onCast).toHaveBeenCalledTimes(1);
    const payload = onCast.mock.calls[0][0];
    expect(payload.name).toBe('Healing Word');
    expect(payload.freeCastAuthorized).toBe(true);
    expect(payload.isUpcast).toBe(false);
    // The popup only authorizes and reports — payment/consumption happens
    // downstream in prepareSpellCast, never fabricated here.
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('denies a spell with no grant at zero slots: warning, disabled Cast, click does nothing', () => {
    const { onCast } = renderPopup(makeSpell());

    expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    expect(screen.getByText(noSlotsText)).toBeInTheDocument();
    const castButton = screen.getByRole('button', { name: /Cast Spell/ });
    expect(castButton).toBeDisabled();

    fireEvent.click(castButton);
    expect(onCast).not.toHaveBeenCalled();
  });

  it('authorizes the automation free_spell entry its counter names — and only that spell', () => {
    // Proves playerStats.automation reaches the service and the grant is
    // per-entry/per-spell, not blanket-free at zero slots.
    const smiteStats = () => makeStats({
      automation: {
        actions: [{
          name: "Paladin's Smite",
          type: 'free_spell',
          spell: 'Divine Smite',
          uses_expression: '1/rest',
          usesMax: 1,
        }],
      },
    });

    stubRuntime({ "_Paladin's_Smite_freeCastCount": 1 });
    const { unmount } = renderPopup(makeSpell({ name: 'Divine Smite' }), smiteStats());
    expect(screen.getByText(freeCastText)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    unmount();

    // Same counter up, different spell — must NOT be free.
    renderPopup(makeSpell({ name: 'Fireball', level: 3 }), smiteStats());
    expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();
    expect(screen.getByText(noSlotsText)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
  });

  // CLA-312: authorization is gated on the EFFECTIVE level the component owns —
  // upcasting past the fixed level revokes the free cast, and the paid cast says so.
  it('revokes the free cast and pays the slot when upcast above the fixed level', () => {
    stubRuntime({ SignatureSpells_selection: ['Fireball'], SignatureSpells_Fireball_used: false });
    const upcastLevels = [
      { level: 3, formula: '8d6', availableSlots: 1 },
      { level: 4, formula: '9d6', availableSlots: 1 },
    ];
    const { onCast } = renderPopup(
      makeSpell({ name: 'Fireball', level: 3, damage: { damage_at_slot_level: { '3': '8d6', '4': '9d6' } } }),
      makeStats(),
      { upcastLevels }
    );

    // Default selection is the first available level (3) — free cast armed.
    expect(screen.getByText(freeCastText)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Level 3/ })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: /Level 4/ }));
    expect(screen.queryByText(freeCastText)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
    expect(onCast).toHaveBeenCalledTimes(1);
    const payload = onCast.mock.calls[0][0];
    expect(payload.freeCastAuthorized).toBe(false);
    expect(payload.isUpcast).toBe(true);
    expect(payload.upcastLevel).toBe(4);
  });
});
