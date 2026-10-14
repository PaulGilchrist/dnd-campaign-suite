// @maintained-by-ai
// SpellDetailPopup — Psionic Sorcery canCast lane (component level).
// Proves that a Sorcerer whose spell is in the Psionic Sorcery list can cast
// with NO spell slots when the runtime SP balance covers the spell-level cost:
//   - the SP ≥ spell-level truth table (below / exact boundary / surplus),
//   - the SP total echoed in "Slots Remaining",
//   - Rage still blocks an SP-covered cast (canonical home per the rage suite),
//   - the channel is denied for spells outside the list and for non-Sorcerers,
//   - upcast radios unlock per-level with SP, and an SP-selected upcast
//     reaches onCast with the level carried (payment enforced downstream).
// The metamagic predicates run REAL; only the runtime store, buffs, and
// sanitize are mocked. The payment checkbox lane lives in
// SpellDetailPopup.psionicPayment.test.jsx; slot-based Rage blocking in
// SpellDetailPopup.rageRestriction.test.jsx.
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

const baseMockPlayerStats = {
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
};

const mockCampaignName = 'test-campaign';

const baseMockSpell = {
  name: 'Magic Missile',
  level: 1,
  description: 'Three darts of force strike a creature.',
  casting_time: '1 action',
  range: '120 feet',
  duration: 'Instantaneous',
  damage: {
    damage_at_slot_level: {
      '1': '3d4+1',
      '2': '4d4+1',
      '3': '5d4+1',
    },
  },
  school: 'Evocation',
};

const NO_SLOTS_TEXT = 'No spell slots available for this level.';

const renderPopup = (extraProps = {}, playerStats = baseMockPlayerStats) =>
  render(
    <SpellDetailPopup
      spell={baseMockSpell}
      playerStats={playerStats}
      campaignName={mockCampaignName}
      onClose={vi.fn()}
      {...extraProps}
    />,
  );

// Sorcerer with the Psionic Sorcery passive over the given spell list.
const createPsionicStats = (psionicSpellNames = ['Magic Missile']) => ({
  ...baseMockPlayerStats,
  automation: {
    passives: [{ type: 'psionic_sorcery', psionicSpells: psionicSpellNames }],
    actions: [],
  },
});

// A spell with a single-slot-level damage ladder — never shows the upcast
// selector, so canCast falls through to the base-slot / Psionic-Sorcery check.
const flatSpell = (level) => ({
  ...baseMockSpell,
  level,
  damage: { damage_at_slot_level: { [String(level)]: '4d4+1' } },
});

const castButton = () => screen.getByRole('button', { name: /Cast Spell/ });

const withRuntime = (values) =>
  vi.mocked(getRuntimeValue).mockImplementation((_name, key) =>
    key in values ? values[key] : null
  );

describe('SpellDetailPopup - Psionic Sorcery canCast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('SP enabling casting', () => {
    // Truth table for the SP ≥ spell-level gate at zero spell slots.
    // Each level is exercised so the comparison uses the spell's own level.
    it.each([
      { level: 1, sp: 0, enabled: false, note: 'no points to pay with' },
      { level: 2, sp: 1, enabled: false, note: 'short of the level-2 cost' },
      { level: 2, sp: 2, enabled: true, note: 'exactly covers the cost' },
      { level: 1, sp: 3, enabled: true, note: 'surplus covers the cost' },
    ])(
      'level $level spell with SP:$sp — $note',
      ({ level, sp, enabled }) => {
        withRuntime({ sorceryPoints: sp, [`spell_slots_level_${level}`]: 0 });

        renderPopup({ spell: flatSpell(level) }, createPsionicStats());

        if (enabled) {
          expect(castButton()).toBeEnabled();
          expect(screen.queryByText(NO_SLOTS_TEXT)).not.toBeInTheDocument();
          expect(screen.getByText(new RegExp(`${sp} SP`))).toBeInTheDocument();
        } else {
          expect(castButton()).toBeDisabled();
          expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
        }
      },
    );

    it('blocks casting while raging even when SP covers the cost', () => {
      withRuntime({ sorceryPoints: 5, spell_slots_level_1: 0 });
      vi.mocked(getActiveBuffs).mockReturnValue([{ name: 'Rage' }]);

      renderPopup({}, createPsionicStats());

      expect(castButton()).toBeDisabled();
    });

    it('does not let SP enable a spell that is not in the Psionic Sorcery list', () => {
      withRuntime({ sorceryPoints: 5, spell_slots_level_1: 0 });

      renderPopup({ spell: flatSpell(1) }, createPsionicStats(['Shield']));

      expect(castButton()).toBeDisabled();
      expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
    });

    it('does not apply Psionic Sorcery casting for non-Sorcerers', () => {
      withRuntime({ sorceryPoints: 5, spell_slots_level_1: 0 });
      const wizardStats = {
        ...createPsionicStats(),
        class: { name: 'Wizard', major: { name: 'Wizard' } },
      };

      renderPopup({}, wizardStats);

      expect(castButton()).toBeDisabled();
      expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
    });
  });

  describe('upcast casting with SP', () => {
    const upcastSpellLevel2 = {
      ...baseMockSpell,
      level: 2,
      damage: {
        damage_at_slot_level: {
          '2': '4d4+1',
          '3': '5d4+1',
        },
      },
    };
    const upcastLevelsNoSlots = [
      { level: 2, formula: '4d4+1', availableSlots: 0 },
      { level: 3, formula: '5d4+1', availableSlots: 0 },
    ];

    it('unlocks each upcast radio only when the SP balance covers that level', () => {
      // SP=2 covers the level-2 step exactly but not the level-3 step —
      // one fixture discriminates both branches of the per-level check.
      withRuntime({ sorceryPoints: 2, spell_slots_level_2: 0, spell_slots_level_3: 0 });

      renderPopup(
        { spell: upcastSpellLevel2, upcastLevels: upcastLevelsNoSlots },
        createPsionicStats(),
      );

      expect(screen.getByRole('radio', { name: /Level 2/ })).toBeEnabled();
      expect(screen.getByRole('radio', { name: /Level 3/ })).toBeDisabled();
      expect(castButton()).toBeEnabled();
    });

    it('passes the selected upcast level to onCast when switching to a higher SP-covered level', () => {
      const onCast = vi.fn();
      withRuntime({ sorceryPoints: 4, spell_slots_level_2: 0, spell_slots_level_3: 0 });

      renderPopup(
        { spell: upcastSpellLevel2, upcastLevels: upcastLevelsNoSlots, onCast },
        createPsionicStats(),
      );

      fireEvent.click(screen.getByRole('radio', { name: /Level 3/ }));
      fireEvent.click(castButton());

      expect(onCast).toHaveBeenCalledTimes(1);
      const passedSpell = onCast.mock.calls[0][0];
      expect(passedSpell.isUpcast).toBe(true);
      expect(passedSpell.upcastLevel).toBe(3);
      expect(passedSpell.usePsionicPayment).toBe(false);
    });
  });
});
