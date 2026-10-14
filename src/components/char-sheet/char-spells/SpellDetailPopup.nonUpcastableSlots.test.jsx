// @improved-by-ai
// SpellDetailPopup paid-cast slot lane for NON-upcastable spells (single
// damage tier at base level). The popup pays a slot at the spell's FIXED
// base level: the runtime counter takes precedence over the spellAbilities
// max (falling back to max only when the runtime has no value), higher-level
// slots can never cover a non-upcastable spell, and the cast payload must
// report the cast as a paid, non-upcast cast. Rage, cantrips, warlock
// slots, free casts, and upcast-selector visibility have their own suites
// (castCantrip / warlockSlots / freeCast / rendering) and are not re-tested
// here.
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
const noSlotsText = 'No spell slots available for this level.';

// A level 1 spell with a SINGLE damage tier — this is what makes a spell
// non-upcastable in the popup (no level ladder to select from).
const makeSpell = (overrides = {}) => ({
  name: 'Thunderwave',
  level: 1,
  description: 'A wave of thunderous force sweeps out from you.',
  casting_time: '1 action',
  range: '15 feet',
  duration: 'Instantaneous',
  school: 'Evocation',
  damage: {
    damage_at_slot_level: { '1': '2d8' },
    damage_type: 'thunder',
  },
  ...overrides,
});

// Full-caster (Bard) stats; per-test overrides, no shared mutable fixtures.
const makeStats = (overrides = {}) => {
  const { spellAbilities: spellAbilitiesOverrides, ...rest } = overrides;
  return {
    name: 'Elara',
    level: 5,
    class: { name: 'Bard', major: { name: 'Bard' } },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    proficiency: 3,
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 2,
      spells: [],
      ...spellAbilitiesOverrides,
    },
    automation: { passives: [], actions: [] },
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

describe('SpellDetailPopup — paid casting of non-upcastable spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  it('enables the paid cast while current slots remain at the base level', () => {
    stubRuntime({ spell_slots_level_1: 2 });
    renderPopup(makeSpell());

    expect(castButton()).toBeEnabled();
    expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
    expect(screen.getByText(/2 slots/)).toBeInTheDocument();
    expect(screen.queryByText(noSlotsText)).not.toBeInTheDocument();
  });

  it('prefers the runtime counter over the spellAbilities max — exhausted slots disable the cast', () => {
    // spellAbilities max is 4, but the runtime says every slot is spent:
    // the live counter must win and the popup must say so.
    stubRuntime({ spell_slots_level_1: 0 });
    renderPopup(makeSpell());

    expect(castButton()).toBeDisabled();
    expect(screen.getByText(noSlotsText)).toBeInTheDocument();
  });

  it('falls back to the spellAbilities max when the runtime has no value', () => {
    stubRuntime({});
    renderPopup(makeSpell());

    expect(castButton()).toBeEnabled();
    expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
    expect(screen.getByText(/4 slots/)).toBeInTheDocument();
  });

  it('disables the cast when no slots exist at the spell level in either source', () => {
    stubRuntime({ spell_slots_level_1: null });
    renderPopup(makeSpell(), makeStats({ spellAbilities: { spell_slots_level_1: 0, spells: [] } }));

    expect(castButton()).toBeDisabled();
    expect(screen.getByText(noSlotsText)).toBeInTheDocument();
  });

  it('never pays with a higher-level slot — zero base slots disables the cast even when upcastLevels report availability', () => {
    // Non-upcastable spells are locked to their base level: slots at other
    // levels (and any upcastLevels offered upstream) cannot cover the cost.
    stubRuntime({ spell_slots_level_1: 0, spell_slots_level_2: 2 });
    renderPopup(
      makeSpell(),
      makeStats(),
      { upcastLevels: [{ level: 2, formula: '3d8', availableSlots: 2 }] }
    );

    expect(castButton()).toBeDisabled();
    expect(screen.getByText(noSlotsText)).toBeInTheDocument();
    expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
  });

  it('reports a paid, non-upcast cast on the onCast payload', () => {
    stubRuntime({ spell_slots_level_1: 1 });
    const spell = makeSpell();
    const onCast = renderPopup(spell);

    fireEvent.click(castButton());

    expect(onCast).toHaveBeenCalledTimes(1);
    const [payload, metaCtx] = onCast.mock.calls[0];
    expect(payload.name).toBe(spell.name);
    expect(payload.level).toBe(1);
    expect(payload.isUpcast).toBe(false);
    expect(payload.upcastLevel).toBeUndefined();
    expect(payload.freeCastAuthorized).toBe(false);
    expect(metaCtx).toMatchObject({ overchannel: false });
  });
});
