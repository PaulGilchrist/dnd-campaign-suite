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

const createPsionicStats = (psionicSpellNames) => ({
  ...baseMockPlayerStats,
  automation: {
    passives: [{ type: 'psionic_sorcery', psionicSpells: psionicSpellNames }],
    actions: [],
  },
});

describe('SpellDetailPopup - Psionic Sorcery canCast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('SP enabling casting', () => {
    it('enables cast for psionic spell when player has enough SP but no slots', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 2;
        if (key === 'spell_slots_level_1') return 0;
        return null;
      });

      const spell = { ...baseMockSpell, name: 'Magic Missile', level: 1 };
      renderPopup(spell, createPsionicStats(['Magic Missile']), mockCampaignName);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    });

    it('disables cast for psionic spell when player has insufficient SP and no slots', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 0;
        if (key === 'spell_slots_level_1') return 0;
        return null;
      });

      const spell = { ...baseMockSpell, name: 'Magic Missile', level: 1 };
      renderPopup(spell, createPsionicStats(['Magic Missile']), mockCampaignName);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    });

    it('disables cast when SP is below required level and no slots available', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 0;
        if (key === 'spell_slots_level_2') return 0;
        return null;
      });

      const spell = { ...baseMockSpell, name: 'Magic Missile', level: 2 };
      renderPopup(spell, createPsionicStats(['Magic Missile']), mockCampaignName);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    });

    it('disables cast when player is raging', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 5;
        if (key === 'spell_slots_level_1') return 0;
        return null;
      });
      vi.mocked(getActiveBuffs).mockReturnValue([{ name: 'Rage' }]);

      const spell = { ...baseMockSpell, name: 'Magic Missile', level: 1 };
      renderPopup(spell, createPsionicStats(['Magic Missile']), mockCampaignName);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    });
  });

  describe('upcast casting with SP', () => {
    it('enables upcast cast when SP covers the upcast level', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 4;
        if (key === 'spell_slots_level_2') return 0;
        if (key === 'spell_slots_level_3') return 0;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        level: 2,
        damage: {
          damage_at_slot_level: {
            '2': '4d4+1',
            '3': '5d4+1',
          },
        },
      };
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: 0 },
        { level: 3, formula: '5d4+1', availableSlots: 0 },
      ];

      renderPopup(spell, createPsionicStats(['Magic Missile']), mockCampaignName, { upcastLevels });
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeEnabled();
    });

    it('disables upcast radio when neither slots nor SP cover that level', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 2;
        if (key === 'spell_slots_level_2') return 0;
        if (key === 'spell_slots_level_3') return 0;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        level: 2,
        damage: {
          damage_at_slot_level: {
            '2': '4d4+1',
            '3': '5d4+1',
          },
        },
      };
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: 0 },
        { level: 3, formula: '5d4+1', availableSlots: 0 },
      ];

      renderPopup(spell, createPsionicStats(['Magic Missile']), mockCampaignName, { upcastLevels });
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).not.toBeDisabled();
      expect(radios[1]).toBeDisabled();
    });

    it('passes correct upcast info to onCast when switching to a higher level SP can cover', () => {
      const onCast = vi.fn();
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'sorceryPoints') return 4;
        if (key === 'spell_slots_level_2') return 0;
        if (key === 'spell_slots_level_3') return 0;
        return null;
      });

      const spell = {
        ...baseMockSpell,
        level: 2,
        damage: {
          damage_at_slot_level: {
            '2': '4d4+1',
            '3': '5d4+1',
          },
        },
      };
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: 0 },
        { level: 3, formula: '5d4+1', availableSlots: 0 },
      ];

      renderPopup(spell, createPsionicStats(['Magic Missile']), mockCampaignName, { onCast, upcastLevels });
      fireEvent.click(screen.getByText('Level 3'));
      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      const passedSpell = onCast.mock.calls[0][0];
      expect(passedSpell.isUpcast).toBe(true);
      expect(passedSpell.upcastLevel).toBe(3);
      expect(passedSpell.usePsionicPayment).toBe(false);
    });
  });
});
