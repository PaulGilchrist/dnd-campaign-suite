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
  class: { name: 'Bard', major: { name: 'Bard' } },
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

const animalFriendshipSpell = {
  name: 'Animal Friendship',
  level: 1,
  description: 'This spell lets you suggest a course of action to a beast.',
  casting_time: '1 action',
  range: '30 feet',
  duration: '24 hours',
  school: 'Enchantment',
  damage: {
    damage_at_slot_level: {
      '1': '1d8',
    },
  },
  dc: { dc_type: 'WIS', dc_success: 'none' },
};

const renderPopup = (
  spell = animalFriendshipSpell,
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
    />
  );

describe('SpellDetailPopup - Non-upcastable spell slot availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
  });

  describe('non-upcastable spell (single damage tier at base level)', () => {
    it('enables cast button when character has available spell slots at the spell level', () => {
      const spell = {
        ...animalFriendshipSpell,
        damage: { damage_at_slot_level: { '1': '1d8' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName);

      const button = screen.getByRole('button', { name: /Cast Spell/ });
      expect(button).toBeEnabled();
    });

    it('disables cast button when character has no spell slots at the spell level', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 0;
        return null;
      });

      const spell = {
        ...animalFriendshipSpell,
        damage: { damage_at_slot_level: { '1': '1d8' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName);

      const button = screen.getByRole('button', { name: /Cast Spell/ });
      expect(button).toBeDisabled();
    });

    it('enables cast button when runtime value shows available slots (not null)', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 2;
        return null;
      });

      const spell = {
        ...animalFriendshipSpell,
        damage: { damage_at_slot_level: { '1': '1d8' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName);

      const button = screen.getByRole('button', { name: /Cast Spell/ });
      expect(button).toBeEnabled();
    });

    it('falls back to spellAbilities max when runtime value is null', () => {
      vi.mocked(getRuntimeValue).mockImplementation(() => null);

      const spell = {
        ...animalFriendshipSpell,
        damage: { damage_at_slot_level: { '1': '1d8' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName);

      const button = screen.getByRole('button', { name: /Cast Spell/ });
      expect(button).toBeEnabled();
    });

    it('disables cast button when slots are exhausted (runtime value = 0)', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'spell_slots_level_1') return 0;
        return null;
      });

      const spell = {
        ...animalFriendshipSpell,
        damage: { damage_at_slot_level: { '1': '1d8' } },
      };

      renderPopup(spell, baseMockPlayerStats, mockCampaignName);

      const button = screen.getByRole('button', { name: /Cast Spell/ });
      expect(button).toBeDisabled();
    });

    it('calls onCast when cast button is clicked for non-upcastable spell', () => {
      const onCast = vi.fn();

      renderPopup(animalFriendshipSpell, baseMockPlayerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));

      expect(onCast).toHaveBeenCalledTimes(1);
      expect(onCast).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: 'Animal Friendship', level: 1 }),
        expect.any(Object)
      );
    });
  });
});
