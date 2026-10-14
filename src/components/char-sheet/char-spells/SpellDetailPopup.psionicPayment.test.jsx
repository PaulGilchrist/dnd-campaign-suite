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

const renderPopup = (
  spell = baseMockSpell,
  playerStats = baseMockPlayerStats,
  campaignName = mockCampaignName,
  extraProps = {}
) =>
  render(
    <SpellDetailPopup
      spell={spell}
      playerStats={playerStats}
      campaignName={campaignName}
      onClose={vi.fn()}
      {...extraProps}
    />,
  );

describe('SpellDetailPopup - Psionic Sorcery Payment UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('checkbox visibility', () => {
    it.each([
      {
        name: 'all conditions met: psionic spell, sorcerer, non-cantrip, both resources available',
        spellName: 'Magic Missile',
        spellLevel: 1,
        psionicSpells: ['Magic Missile'],
        hasPsionicSorcery: true,
        isSorcerer: true,
        sorceryPoints: 3,
        spellSlots: 4,
        freeCast: false,
        shouldShow: true,
      },
      {
        name: 'SP exactly equals spell level cost',
        spellName: 'Magic Missile',
        spellLevel: 1,
        psionicSpells: ['Magic Missile'],
        hasPsionicSorcery: true,
        isSorcerer: true,
        sorceryPoints: 1,
        spellSlots: 4,
        freeCast: false,
        shouldShow: true,
      },
      {
        name: 'SP insufficient for spell level but still > 0 (checkbox shows, cast will be disabled)',
        spellName: 'Magic Missile',
        spellLevel: 2,
        psionicSpells: ['Magic Missile'],
        hasPsionicSorcery: true,
        isSorcerer: true,
        sorceryPoints: 1,
        spellSlots: 4,
        freeCast: false,
        shouldShow: true,
      },
      {
        name: 'free cast authorized overrides psionic payment',
        spellName: 'Magic Missile',
        spellLevel: 1,
        psionicSpells: ['Magic Missile'],
        hasPsionicSorcery: true,
        isSorcerer: true,
        sorceryPoints: 3,
        spellSlots: 4,
        freeCast: true,
        shouldShow: false,
      },
      {
        name: 'no SP available (SP=0)',
        spellName: 'Magic Missile',
        spellLevel: 1,
        psionicSpells: ['Magic Missile'],
        hasPsionicSorcery: true,
        isSorcerer: true,
        sorceryPoints: 0,
        spellSlots: 4,
        freeCast: false,
        shouldShow: false,
      },
      {
        name: 'no spell slots available',
        spellName: 'Magic Missile',
        spellLevel: 1,
        psionicSpells: ['Magic Missile'],
        hasPsionicSorcery: true,
        isSorcerer: true,
        sorceryPoints: 3,
        spellSlots: 0,
        freeCast: false,
        shouldShow: false,
      },
      {
        name: 'cantrip is excluded',
        spellName: 'Fire Bolt',
        spellLevel: 0,
        psionicSpells: ['Fire Bolt'],
        hasPsionicSorcery: true,
        isSorcerer: true,
        sorceryPoints: 3,
        spellSlots: 4,
        freeCast: false,
        shouldShow: false,
      },
      {
        name: 'spell not in psionic spells list',
        spellName: 'Fireball',
        spellLevel: 3,
        psionicSpells: ['Magic Missile'],
        hasPsionicSorcery: true,
        isSorcerer: true,
        sorceryPoints: 3,
        spellSlots: 4,
        freeCast: false,
        shouldShow: false,
      },
      {
        name: 'player is not a Sorcerer',
        spellName: 'Magic Missile',
        spellLevel: 1,
        psionicSpells: ['Magic Missile'],
        hasPsionicSorcery: true,
        isSorcerer: false,
        sorceryPoints: 3,
        spellSlots: 4,
        freeCast: false,
        shouldShow: false,
      },
    ])('$name', ({
      spellName,
      spellLevel,
      psionicSpells,
      hasPsionicSorcery,
      isSorcerer,
      sorceryPoints,
      spellSlots,
      freeCast,
      shouldShow,
    }) => {
      const playerStats = {
        ...baseMockPlayerStats,
        class: { name: isSorcerer ? 'Sorcerer' : 'Wizard', major: { name: isSorcerer ? 'Sorcerer' : 'Wizard' } },
        automation: {
          passives: hasPsionicSorcery
            ? [{ type: 'psionic_sorcery', psionicSpells }]
            : [],
          actions: [],
        },
      };

      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return sorceryPoints;
        if (key === `spell_slots_level_${spellLevel}`) return spellSlots;
        if (key === 'naturalRecoveryFreeCast' && freeCast) return [spellName];
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: spellName,
        level: spellLevel,
      };

      renderPopup(spell, playerStats, mockCampaignName);

      const labelText = `Use Sorcery Points (${spellLevel} SP) instead of spell slot`;
      if (shouldShow) {
        expect(screen.getByText(labelText)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(labelText)).not.toBeInTheDocument();
      }
    });

  });

  describe('checkbox SP cost label', () => {
    it.each([
      { spellLevel: 1, expectedSP: 1 },
      { spellLevel: 2, expectedSP: 2 },
      { spellLevel: 3, expectedSP: 3 },
    ])('displays correct SP cost for level $spellLevel spell', ({ spellLevel, expectedSP }) => {
      const playerStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'psionic_sorcery', psionicSpells: ['Magic Missile'] }],
          actions: [],
        },
      };

      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 5;
        if (key === `spell_slots_level_${spellLevel}`) return 3;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        level: spellLevel,
        damage: {
          damage_at_slot_level: {
            [String(spellLevel)]: '3d6',
            [String(spellLevel + 1)]: '4d6',
          },
        },
      };

      renderPopup(spell, playerStats, mockCampaignName);

      const labelText = `Use Sorcery Points (${expectedSP} SP) instead of spell slot`;
      expect(screen.getByText(labelText)).toBeInTheDocument();
    });
  });

  describe('checkbox interaction', () => {
    const setupPsionicPopup = (extraProps = {}) => {
      const playerStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'psionic_sorcery', psionicSpells: ['Magic Missile'] }],
          actions: [],
        },
      };

      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 3;
        if (key === 'spell_slots_level_1') return 4;
        return null;
      });

      const spell = { ...baseMockSpell, name: 'Magic Missile', level: 1 };
      return renderPopup(spell, playerStats, mockCampaignName, extraProps);
    };

    it('starts unchecked and toggles on click', () => {
      setupPsionicPopup();
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe('onCast integration', () => {
    it.each([
      { toggled: false, expectedPayment: false, label: 'unchecked' },
      { toggled: true, expectedPayment: true, label: 'checked' },
    ])(
      'passes usePsionicPayment:$expectedPayment to onCast when checkbox is $label',
      ({ toggled, expectedPayment }) => {
        const onCast = vi.fn();
        const playerStats = {
          ...baseMockPlayerStats,
          automation: {
            passives: [{ type: 'psionic_sorcery', psionicSpells: ['Magic Missile'] }],
            actions: [],
          },
        };

        vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
          if (key === 'sorceryPoints') return 3;
          if (key === 'spell_slots_level_1') return 4;
          return null;
        });

        const spell = { ...baseMockSpell, name: 'Magic Missile', level: 1 };
        renderPopup(spell, playerStats, mockCampaignName, { onCast });

        if (toggled) {
          fireEvent.click(screen.getByRole('checkbox'));
        }
        fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

        expect(onCast).toHaveBeenCalledTimes(1);
        expect(onCast.mock.calls[0][0].usePsionicPayment).toBe(expectedPayment);
      },
    );

    it.each([
      { scenario: 'non-psionic spell', spellName: 'Fireball', spellLevel: 3, extraRuntime: {}, shouldShowCheckbox: false },
      { scenario: 'free cast', spellName: 'Magic Missile', spellLevel: 1, extraRuntime: { naturalRecoveryFreeCast: ['Magic Missile'] }, shouldShowCheckbox: false },
    ])('passes usePsionicPayment:false when checkbox not visible ($scenario)', ({ spellName, spellLevel, extraRuntime }) => {
      const onCast = vi.fn();
      const playerStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'psionic_sorcery', psionicSpells: ['Magic Missile'] }],
          actions: [],
        },
      };

      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key in extraRuntime) return extraRuntime[key];
        if (key === 'sorceryPoints') return 3;
        if (key === `spell_slots_level_${spellLevel}`) return 4;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: spellName,
        level: spellLevel,
        damage: { damage_at_slot_level: { [String(spellLevel)]: '8d6' } },
      };
      renderPopup(spell, playerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0].usePsionicPayment).toBe(false);
    });

    it('passes usePsionicPayment:true when checkbox is checked even with insufficient SP', () => {
      const onCast = vi.fn();
      const playerStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'psionic_sorcery', psionicSpells: ['Magic Missile'] }],
          actions: [],
        },
      };

      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 1;
        if (key === 'spell_slots_level_2') return 3;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        name: 'Magic Missile',
        level: 2,
        damage: {
          damage_at_slot_level: {
            '2': '4d4+1',
            '3': '5d4+1',
          },
        },
      };
      renderPopup(spell, playerStats, mockCampaignName, { onCast });

      // Checkbox is visible (SP > 0) and cast button is enabled
      // (SP >= spell level check is enforced server-side, not client-side)
      expect(
        screen.getByText(/Use Sorcery Points/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Cast Spell/ }),
      ).not.toBeDisabled();

      // User can still check the box and attempt to cast
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast.mock.calls[0][0].usePsionicPayment).toBe(true);
    });
  });
});
