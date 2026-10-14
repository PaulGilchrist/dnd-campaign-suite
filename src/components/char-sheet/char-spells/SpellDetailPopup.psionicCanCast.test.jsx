// @improved-by-ai
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
const flatSpell = (level, formula = '4d4+1') => ({
  ...baseMockSpell,
  level,
  damage: { damage_at_slot_level: { [String(level)]: formula } },
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
    it('enables Cast Spell for a psionic spell with SP when no slots remain, showing the SP in Slots Remaining', () => {
      withRuntime({ sorceryPoints: 2, spell_slots_level_1: 0 });

      renderPopup({}, createPsionicStats());

      expect(castButton()).toBeEnabled();
      expect(screen.getByText(/2 SP/)).toBeInTheDocument();
    });

    it.each([
      { label: 'no SP', sorceryPoints: 0 },
      { label: 'uninitialized SP (treated as zero)', sorceryPoints: null },
      { label: 'SP below the spell level cost', sorceryPoints: 1 },
    ])(
      'disables Cast Spell for a level 2 psionic spell with $label and no slots',
      ({ sorceryPoints }) => {
        withRuntime({ sorceryPoints, spell_slots_level_2: 0 });

        renderPopup({ spell: flatSpell(2) }, createPsionicStats());

        expect(castButton()).toBeDisabled();
        expect(screen.getByText(NO_SLOTS_TEXT)).toBeInTheDocument();
      },
    );

    it('enables Cast Spell at the exact SP boundary (SP equals spell level)', () => {
      withRuntime({ sorceryPoints: 2, spell_slots_level_2: 0 });

      renderPopup({ spell: flatSpell(2) }, createPsionicStats());

      expect(castButton()).toBeEnabled();
    });

    it('blocks casting while raging even when SP covers the cost', () => {
      withRuntime({ sorceryPoints: 5, spell_slots_level_1: 0 });
      vi.mocked(getActiveBuffs).mockReturnValue([{ name: 'Rage' }]);

      renderPopup({}, createPsionicStats());

      expect(castButton()).toBeDisabled();
    });

    it('does not let SP enable a spell that is not in the Psionic Sorcery list', () => {
      withRuntime({ sorceryPoints: 5, spell_slots_level_1: 0 });

      renderPopup({ spell: flatSpell(1, '5d4') }, createPsionicStats(['Shield']));

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

    it('enables Cast Spell and every upcast radio whose SP cost is covered', () => {
      withRuntime({ sorceryPoints: 4, spell_slots_level_2: 0, spell_slots_level_3: 0 });

      renderPopup(
        { spell: upcastSpellLevel2, upcastLevels: upcastLevelsNoSlots },
        createPsionicStats(),
      );

      expect(castButton()).toBeEnabled();
      expect(screen.getByRole('radio', { name: /Level 2/ })).toBeEnabled();
      expect(screen.getByRole('radio', { name: /Level 3/ })).toBeEnabled();
    });

    it('disables only the upcast radio whose SP cost is not covered', () => {
      withRuntime({ sorceryPoints: 2, spell_slots_level_2: 0, spell_slots_level_3: 0 });

      renderPopup(
        { spell: upcastSpellLevel2, upcastLevels: upcastLevelsNoSlots },
        createPsionicStats(),
      );

      expect(screen.getByRole('radio', { name: /Level 2/ })).toBeEnabled();
      expect(screen.getByRole('radio', { name: /Level 3/ })).toBeDisabled();
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
