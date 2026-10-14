// @maintained-by-ai
// SpellDetailPopup Psionic Sorcery payment checkbox lane (component level).
// Proves the contract of the "Use Sorcery Points (N SP) instead of spell slot"
// checkbox:
//   - visibility gating (Sorcerer + psionic_sorcery passive + spell in the list,
//     non-cantrip, SP > 0 AND slots remaining, revoked by a free cast);
//   - the cost label shows the spell level, tracking the selected upcast level;
//   - the checkbox is a controlled toggle whose state reaches onCast as
//     usePsionicPayment (false whenever no channel is offered).
// The metamagic predicates (isPsionicSpell / hasPsionicSorcery) and free-cast
// authorization run REAL — only the runtime store and unrelated services are
// mocked. Slot-availability/canCast lives in SpellDetailPopup.psionicCanCast.test.jsx,
// free-cast channels in SpellDetailPopup.freeCast.test.jsx, the raw predicates in
// metamagicRules.test.js, and downstream SP consumption in spellPreparationService/
// metamagic-handler suites.
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

const paymentLabel = (level) => `Use Sorcery Points (${level} SP) instead of spell slot`;
const PSIONIC_LABEL_REGEX = /Use Sorcery Points/;

// Per-test fixtures via factories — no shared mutable objects.
// Damage ladders are flat (single slot level) by default so the upcast
// selector never renders and the effective level is always spell.level.
const makeSpell = (overrides = {}) => ({
  name: 'Magic Missile',
  level: 1,
  description: 'Three darts of force strike a creature.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  school: 'Evocation',
  damage: { damage_at_slot_level: { '1': '3d4+1' } },
  ...overrides,
});

const makeStats = (overrides = {}) => {
  const { automation: automationOverrides, ...rest } = overrides;
  return {
    name: 'Elara',
    level: 5,
    class: { name: 'Sorcerer', major: { name: 'Sorcerer' } },
    abilities: [{ name: 'Charisma', bonus: 3 }],
    proficiency: 3,
    spellAbilities: {
      spell_slots_level_1: 4,
      spell_slots_level_2: 3,
      spell_slots_level_3: 2,
      spells: [],
    },
    automation: { passives: [], actions: [] },
    ...rest,
    ...(automationOverrides ? { automation: automationOverrides } : {}),
  };
};

const PSIONIC_PASSIVES = [{ type: 'psionic_sorcery', psionicSpells: ['Magic Missile'] }];
const psionicStats = () => makeStats({ automation: { passives: PSIONIC_PASSIVES, actions: [] } });

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
    />,
  );
  return onCast;
};

const castButton = () => screen.getByRole('button', { name: /Cast Spell/ });

describe('SpellDetailPopup — Psionic Sorcery payment checkbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('visibility gating', () => {
    // Each negative row kills exactly one branch of the section's gate
    // (class, spell list, cantrip, SP>0, slots>0). Free-cast revocation is
    // exercised with its cast payload below; the level-tracks-upcast label
    // lives in the upcast test.
    it.each([
      {
        name: 'all conditions met — psionic spell, Sorcerer, non-cantrip, SP and slots available',
        spell: makeSpell(),
        stats: psionicStats(),
        runtime: { sorceryPoints: 3, spell_slots_level_1: 4 },
        expectedLevel: 1,
      },
      {
        name: 'no SP available (SP=0)',
        spell: makeSpell(),
        stats: psionicStats(),
        runtime: { sorceryPoints: 0, spell_slots_level_1: 4 },
        expectedLevel: null,
      },
      {
        name: 'no spell slots at the spell level (SP-only cast belongs to the canCast lane)',
        spell: makeSpell(),
        stats: psionicStats(),
        runtime: { sorceryPoints: 3, spell_slots_level_1: 0 },
        expectedLevel: null,
      },
      {
        name: 'cantrip excluded',
        spell: makeSpell({ level: 0, name: 'Fire Bolt', damage: null }),
        stats: makeStats({ automation: { passives: [{ type: 'psionic_sorcery', psionicSpells: ['Fire Bolt'] }], actions: [] } }),
        runtime: { sorceryPoints: 3, spell_slots_level_1: 4 },
        expectedLevel: null,
      },
      {
        name: 'spell not in the Psionic Sorcery list',
        spell: makeSpell({ name: 'Fireball', level: 3, damage: { damage_at_slot_level: { '3': '8d6' } } }),
        stats: psionicStats(),
        runtime: { sorceryPoints: 3, spell_slots_level_3: 2 },
        expectedLevel: null,
      },
      {
        name: 'player is not a Sorcerer',
        spell: makeSpell(),
        stats: makeStats({
          class: { name: 'Wizard', major: { name: 'Wizard' } },
          automation: { passives: PSIONIC_PASSIVES, actions: [] },
        }),
        runtime: { sorceryPoints: 3, spell_slots_level_1: 4 },
        expectedLevel: null,
      },
    ])('$name', ({ spell, stats, runtime, expectedLevel }) => {
      stubRuntime(runtime);
      renderPopup(spell, stats);

      if (expectedLevel === null) {
        expect(
          screen.queryByRole('checkbox', { name: PSIONIC_LABEL_REGEX }),
        ).not.toBeInTheDocument();
      } else {
        // Accessible-name query also proves the checkbox is programmatically
        // labelled, and the exact label pins the SP cost to the spell level.
        expect(
          screen.getByRole('checkbox', { name: paymentLabel(expectedLevel) }),
        ).toBeInTheDocument();
      }
    });
  });

  describe('toggle and onCast payload', () => {
    it.each([
      { label: 'opt in', checked: true },
      { label: 'opt out via a second click', checked: false },
    ])('reports usePsionicPayment:$checked to onCast after $label', ({ checked }) => {
      stubRuntime({ sorceryPoints: 3, spell_slots_level_1: 4 });
      const onCast = renderPopup(makeSpell(), psionicStats());

      const checkbox = screen.getByRole('checkbox', { name: paymentLabel(1) });
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);
      if (checked) {
        expect(checkbox).toBeChecked();
      } else {
        // Click again — proves the toggle clears and the cast stays slot-paid.
        fireEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
      }

      fireEvent.click(castButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0].usePsionicPayment).toBe(checked);
    });

    it('revokes the payment channel and reports usePsionicPayment:false on an authorized free cast', () => {
      // SP AND slots are both present — only the free-cast grant should hide
      // the checkbox and keep the payload unpaid.
      stubRuntime({ sorceryPoints: 3, spell_slots_level_1: 4, naturalRecoveryFreeCast: ['Magic Missile'] });
      const onCast = renderPopup(makeSpell(), psionicStats());

      expect(screen.queryByRole('checkbox', { name: PSIONIC_LABEL_REGEX })).not.toBeInTheDocument();

      fireEvent.click(castButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      const payload = onCast.mock.calls[0][0];
      expect(payload.freeCastAuthorized).toBe(true);
      expect(payload.usePsionicPayment).toBe(false);
    });

    it('lets the player opt in with SP below the cost — the popup offers, payment is enforced downstream', () => {
      stubRuntime({ sorceryPoints: 1, spell_slots_level_2: 3 });
      const spell = makeSpell({ level: 2, damage: { damage_at_slot_level: { '2': '4d4+1' } } });
      const onCast = renderPopup(spell, psionicStats());

      const checkbox = screen.getByRole('checkbox', { name: paymentLabel(2) });
      expect(castButton()).toBeEnabled();

      fireEvent.click(checkbox);
      fireEvent.click(castButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0].usePsionicPayment).toBe(true);
    });

    it('tracks the selected upcast level in the SP cost label and carries the opt-in through an upcast cast', () => {
      stubRuntime({ sorceryPoints: 4, spell_slots_level_2: 1, spell_slots_level_3: 1 });
      const spell = makeSpell({
        level: 2,
        damage: { damage_at_slot_level: { '2': '4d4+1', '3': '5d4+1' } },
      });
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: 1 },
        { level: 3, formula: '5d4+1', availableSlots: 1 },
      ];
      const onCast = renderPopup(spell, psionicStats(), { upcastLevels });

      // Default selection is the spell's base level (2).
      expect(screen.getByRole('checkbox', { name: paymentLabel(2) })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('radio', { name: /Level 3/ }));
      expect(screen.queryByRole('checkbox', { name: paymentLabel(2) })).not.toBeInTheDocument();
      const checkbox = screen.getByRole('checkbox', { name: paymentLabel(3) });
      expect(checkbox).toBeInTheDocument();

      fireEvent.click(checkbox);
      fireEvent.click(castButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      const payload = onCast.mock.calls[0][0];
      expect(payload.isUpcast).toBe(true);
      expect(payload.upcastLevel).toBe(3);
      expect(payload.usePsionicPayment).toBe(true);
    });
  });
});
