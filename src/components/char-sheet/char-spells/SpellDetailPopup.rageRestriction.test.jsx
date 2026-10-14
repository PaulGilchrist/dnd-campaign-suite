// @maintained-by-ai
// SpellDetailPopup — Rage casting restriction (canonical Rage suite).
// While the "Rage" buff is active the popup blocks ALL casting
// (computeCanCast's `if (!isRaging)` short-circuits every payment channel).
// This suite covers the channels the sibling suites do NOT re-test here:
//   - slot-paid casts on a fully-armed fixture, with non-raging controls
//     and buff-name specificity on the IDENTICAL fixture so neither an
//     over-blocked nor an under-blocked canCast can pass vacuously
//   - free-cast authorization (Natural Recovery runtime selection)
//   - FT-068 Quick Ritual checkbox channel
//   - CLA-299 Ritual Adept auto-cast channel
// Already covered elsewhere and deliberately NOT duplicated:
//   - cantrip blocked while raging + control .... SpellDetailPopup.castCantrip.test.jsx
//   - SP payment blocked while raging ........... SpellDetailPopup.psionicCanCast.test.jsx
//   - non-raging arming of the free/Quick/Ritual-Adept channels
//     ........................................... SpellDetailPopup.freeCast/.quickRitual/.ritualAdept.test.jsx
//     (each proves its channel enables an enabled-Cast click at zero slots
//     without Rage, so only the rage-block lives here)
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

const raging = (buffs = [{ name: 'Rage' }]) =>
  vi.mocked(getActiveBuffs).mockReturnValue(buffs);

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

  // One fixture, three buff states — the full truth table of the Rage gate
  // on a slot-paid cast: Rage blocks, no-buffs casts, and buffs whose names
  // merely resemble "Rage" (Enrage) or merely coexist with it must not.
  it.each([
    { buffs: [{ name: 'Rage' }], enabled: false, note: 'blocked while raging' },
    { buffs: [], enabled: true, note: 'casts when not raging' },
    {
      buffs: [{ name: 'Enrage' }, { name: 'Bless' }],
      enabled: true,
      note: 'only a buff named exactly "Rage" blocks',
    },
  ])('$note', ({ buffs, enabled }) => {
    raging(buffs);

    const onCast = renderPopup({
      spell: fullyArmedSpell,
      playerStats: makeStats({ spellAbilities: FULL_SLOTS }),
      upcastLevels: UPCAST_LADDER,
      clicks: true,
    });

    if (enabled) {
      expect(castButton()).toBeEnabled();
      expect(onCast).toHaveBeenCalledTimes(1);
    } else {
      expect(castButton()).toBeDisabled();
      expect(onCast).not.toHaveBeenCalled();
    }
  });

  // Free-cast channel: Natural Recovery runtime selection authorizes a
  // slotless free cast. Its non-raging control (armed banner, enabled Cast
  // click at zero slots) lives in SpellDetailPopup.freeCast.test.jsx.
  it('denies an authorized Natural Recovery free cast while raging', () => {
    vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
      key === 'naturalRecoveryFreeCast' ? ['Misty Step'] : null
    );
    raging();

    const onCast = renderPopup({
      spell: makeSpell({
        name: 'Misty Step',
        casting_time: '1 bonus action',
        range: '30 feet',
        school: 'Conjuration',
        damage: null,
      }),
      playerStats: makeStats({ spellAbilities: { spell_slots_level_1: 0 } }),
      clicks: true,
    });

    expect(castButton()).toBeDisabled();
    expect(onCast).not.toHaveBeenCalled();
  });

  // FT-068 Quick Ritual channel: a prepared granted ritual castable slot-free
  // once per Long Rest. Non-raging control: SpellDetailPopup.quickRitual.test.jsx.
  it('denies a ticked FT-068 Quick Ritual cast while raging', () => {
    raging();

    const onCast = renderPopup({
      spell: makeSpell({
        name: 'Identify',
        casting_time: '1 minute',
        range: 'Touch',
        school: 'Divination',
        damage: null,
        ritual: true,
        _ritualMasterRitual: true,
      }),
      playerStats: makeStats({ spellAbilities: { spell_slots_level_1: 0 } }),
    });

    fireEvent.click(screen.getByRole('checkbox', { name: /Quick Ritual/ }));
    fireEvent.click(castButton());

    expect(castButton()).toBeDisabled();
    expect(onCast).not.toHaveBeenCalled();
  });

  // CLA-299 Ritual Adept channel: 2024 Wizard spellbook ritual, unprepared →
  // the popup auto-casts it slotless as a Ritual. Non-raging control:
  // SpellDetailPopup.ritualAdept.test.jsx.
  it('denies the CLA-299 Ritual Adept slotless auto-cast while raging', () => {
    raging();

    const onCast = renderPopup({
      spell: makeSpell({
        name: 'Detect Magic',
        casting_time: '1 minute',
        range: 'Self',
        duration: 'Concentration, up to 10 minutes',
        school: 'Divination',
        damage: null,
        ritual: true,
      }),
      playerStats: makeStats({
        class: { name: 'Wizard', major: { name: 'Wizard' } },
        rules: '2024',
        spellAbilities: {
          spells: [{ name: 'Detect Magic', level: 1, ritual: true }],
          spell_slots_level_1: 0,
        },
      }),
      clicks: true,
    });

    expect(castButton()).toBeDisabled();
    expect(onCast).not.toHaveBeenCalled();
  });
});
