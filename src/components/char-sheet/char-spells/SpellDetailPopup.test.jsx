/* @improved-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getActiveBuffs } from '../../../services/combat/buffs/buffService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
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
    />
  );

describe('SpellDetailPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(getRuntimeValue).mockReturnValue(null);
    vi.mocked(getActiveBuffs).mockReturnValue([]);
    vi.mocked(setRuntimeValue).mockReturnValue();
  });

  describe('rendering', () => {
    it('renders spell name and description', () => {
      renderPopup();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(
        screen.getByText('Three darts of force strike a creature.')
      ).toBeInTheDocument();
    });

    it('renders spell metadata fields', () => {
      renderPopup();
      expect(screen.getByText(/Level:/)).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText(/Casting Time:/)).toBeInTheDocument();
      expect(screen.getByText('1 action')).toBeInTheDocument();
      expect(screen.getByText(/Range:/)).toBeInTheDocument();
      expect(screen.getByText('120 feet')).toBeInTheDocument();
      expect(screen.getByText(/Duration:/)).toBeInTheDocument();
      expect(screen.getByText('Instantaneous')).toBeInTheDocument();
    });

    it('renders "Cantrip" for level 0 spells', () => {
      const cantrip = { ...baseMockSpell, level: 0 };
      renderPopup(cantrip);
      expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

    it('does not show slots remaining for cantrips', () => {
      const cantrip = { ...baseMockSpell, level: 0 };
      renderPopup(cantrip);
      expect(screen.queryByText(/Slots Remaining:/)).not.toBeInTheDocument();
    });

    it('shows slots remaining for non-upcastable spells', () => {
      const fixedLevelSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(fixedLevelSpell);
      expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
    });

    it('hides slots remaining when upcast selector is shown', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      expect(screen.queryByText(/Slots Remaining:/)).not.toBeInTheDocument();
    });

    it('renders Cast Spell and Close buttons', () => {
      renderPopup();
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  describe('upcast selector', () => {
    it('renders level options when upcastable with multiple levels', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
        { level: 3, formula: '5d4+1', availableSlots: 2 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      expect(screen.getByText(/Cast at Level:/)).toBeInTheDocument();
      expect(screen.getByText('Level 2')).toBeInTheDocument();
      expect(screen.getByText('Level 3')).toBeInTheDocument();
    });

    it('selects first level with available slots by default', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 0 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      const radios = screen.getAllByRole('radio');
      expect(radios[1]).toBeChecked();
    });

    it('defaults to base spell level when only one upcast level available', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
    });

    it('disables radio options with zero available slots', () => {
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: 0 },
        { level: 3, formula: '5d4+1', availableSlots: 1 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeDisabled();
    });

    it('allows selecting a different upcast level via radio click', () => {
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      const radios = screen.getAllByRole('radio');
      expect(radios[0]).toBeChecked();

      fireEvent.click(screen.getByText('Level 2'));
      expect(radios[1]).toBeChecked();
    });

    it('shows slot counts next to each upcast level option', () => {
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: 3 },
        { level: 3, formula: '5d4+1', availableSlots: 2 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      expect(screen.getByText('3 slots')).toBeInTheDocument();
    });

    it('uses singular "slot" when availableSlots is 1', () => {
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: 1 },
        { level: 3, formula: '5d4+1', availableSlots: 2 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      expect(screen.getByText('1 slot')).toBeInTheDocument();
    });
  });

  describe('Warlock Psychic Spells', () => {
    const warlockStats = {
      ...baseMockPlayerStats,
      class: { name: 'Warlock', major: { name: 'Warlock' } },
      automation: {
        passives: [{ type: 'psychic_spells' }],
        actions: [],
      },
    };

    it('renders psychic damage toggle for Warlock with psychic_spells passive', () => {
      const spell = {
        ...baseMockSpell,
        school: 'Enchantment',
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      renderPopup(spell, warlockStats);
      expect(
        screen.getByText('Change damage type to Psychic')
      ).toBeInTheDocument();
    });

    it('does not render psychic damage toggle for non-damage spells', () => {
      const spell = {
        ...baseMockSpell,
        school: 'Enchantment',
        damage: null,
      };
      renderPopup(spell, warlockStats);
      expect(
        screen.queryByText('Change damage type to Psychic')
      ).not.toBeInTheDocument();
    });

    it('renders no verbal/somatic components badge for Enchantment school', () => {
      const spell = {
        ...baseMockSpell,
        school: 'Enchantment',
      };
      renderPopup(spell, warlockStats);
      expect(
        screen.getByText('No Verbal or Somatic components (Psychic Spells)')
      ).toBeInTheDocument();
    });

    it('renders no verbal/somatic components badge for Illusion school', () => {
      const spell = {
        ...baseMockSpell,
        school: 'Illusion',
      };
      renderPopup(spell, warlockStats);
      expect(
        screen.getByText('No Verbal or Somatic components (Psychic Spells)')
      ).toBeInTheDocument();
    });

    it('does not render no-VS badge for non-enchantment/illusion schools', () => {
      const spell = {
        ...baseMockSpell,
        school: 'Evocation',
      };
      renderPopup(spell, warlockStats);
      expect(
        screen.queryByText('No Verbal or Somatic components (Psychic Spells)')
      ).not.toBeInTheDocument();
    });
  });

  describe('Warlock Improved Illusions', () => {
    const warlockStats = {
      ...baseMockPlayerStats,
      class: { name: 'Warlock', major: { name: 'Warlock' } },
      automation: {
        passives: [{ type: 'improved_illusions' }],
        actions: [],
      },
    };

    it('renders no verbal components badge for Illusion school', () => {
      const spell = {
        ...baseMockSpell,
        school: 'Illusion',
      };
      renderPopup(spell, warlockStats);
      expect(
        screen.getByText('No Verbal components (Improved Illusions)')
      ).toBeInTheDocument();
    });

    it('does not render no-V badge for non-Illusion schools', () => {
      const spell = {
        ...baseMockSpell,
        school: 'Enchantment',
      };
      renderPopup(spell, warlockStats);
      expect(
        screen.queryByText('No Verbal components (Improved Illusions)')
      ).not.toBeInTheDocument();
    });
  });

  describe('Spell Breaker', () => {
    const spellBreakerStats = {
      ...baseMockPlayerStats,
      automation: {
        passives: [{ type: 'passive_rule', effect: 'spell_breaker' }],
        actions: [],
      },
    };

    it('does not modify the displayed casting time for Dispel Magic', () => {
      const dispelSpell = {
        ...baseMockSpell,
        name: 'Dispel Magic',
        casting_time: '1 action',
      };
      renderPopup(dispelSpell, spellBreakerStats);
      expect(screen.getByText('1 action')).toBeInTheDocument();
    });

    it('does not modify casting time for non-Dispel Magic spells', () => {
      renderPopup(baseMockSpell, spellBreakerStats);
      expect(screen.getByText('1 action')).toBeInTheDocument();
    });
  });

  describe('free cast authorization', () => {
    it('renders free cast message when Spell Mastery grants free cast', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Spell_Mastery_freeCast') return ['Magic Missile'];
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [{ name: 'Spell Mastery', type: 'free_spell', spell: 'Magic Missile' }],
        },
      };
      renderPopup(baseMockSpell, stats);
      expect(
        screen.getByText('Free Cast — no spell slot consumed')
      ).toBeInTheDocument();
    });

    it('does not render free cast message for unauthorized spells', () => {
      renderPopup(baseMockSpell, baseMockPlayerStats);
      expect(
        screen.queryByText('Free Cast — no spell slot consumed')
      ).not.toBeInTheDocument();
    });
  });

  describe('canCast logic', () => {
    it('disables Cast Spell button when player is raging', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);
      vi.mocked(getActiveBuffs).mockReturnValue([
        { name: 'Rage', effect: 'rage_active' },
      ]);

      const noSlotsSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(noSlotsSpell, baseMockPlayerStats);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
    });

    it('disables Cast Spell button when no slots are available', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(0);

      const noSlotsSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(noSlotsSpell, baseMockPlayerStats);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).toBeDisabled();
      expect(
        screen.getByText('No spell slots available for this level.')
      ).toBeInTheDocument();
    });

    it('enables Cast Spell button for cantrips regardless of slots', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(0);

      const cantrip = { ...baseMockSpell, level: 0 };
      renderPopup(cantrip, baseMockPlayerStats);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).not.toBeDisabled();
    });

    it('enables Cast Spell button when free cast is authorized', () => {
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === '_Spell_Mastery_freeCast') return ['Magic Missile'];
        return null;
      });

      const stats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [],
          actions: [{ name: 'Spell Mastery', type: 'free_spell', spell: 'Magic Missile' }],
        },
      };
      const noUpcastSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(noUpcastSpell, stats);
      expect(screen.getByRole('button', { name: /Cast Spell/ })).not.toBeDisabled();
    });
  });

  describe('cantrip auto-level', () => {
    it('passes modified cantrip level to onCast when character level exceeds cantrip thresholds', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const onCast = vi.fn();
      const cantrip = {
        ...baseMockSpell,
        level: 0,
        damage: {
          damage_at_character_level: {
            '3': '2d6',
            '5': '3d6',
          },
        },
      };
      renderPopup(cantrip, baseMockPlayerStats, mockCampaignName, {
        onCast,
        playerLevel: 5,
      });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalled();
      const castSpell = onCast.mock.calls[0][0];
      expect(castSpell.level).toBe(5);
    });

    it('passes unmodified cantrip to onCast when character level is below thresholds', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const onCast = vi.fn();
      const cantrip = {
        ...baseMockSpell,
        level: 0,
        damage: {
          damage_at_character_level: {
            '3': '2d6',
            '5': '3d6',
          },
        },
      };
      renderPopup(cantrip, baseMockPlayerStats, mockCampaignName, {
        onCast,
        playerLevel: 2,
      });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalled();
      const castSpell = onCast.mock.calls[0][0];
      expect(castSpell.level).toBe(0);
    });
  });

  describe('onCast behavior', () => {
    it('calls onClose when Close button is clicked', () => {
      const onClose = vi.fn();
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        onClose,
      });
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onCast with the spell when Cast Spell is clicked and canCast is true', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const onCast = vi.fn();
      const noUpcastSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(noUpcastSpell, baseMockPlayerStats, mockCampaignName, {
        onCast,
      });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
    });

    it('does not call onCast when Cast Spell is clicked but canCast is false', () => {
      const onCast = vi.fn();
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        onCast,
      });

      const castButton = screen.getByRole('button', { name: /Cast Spell/ });
      expect(castButton).toBeDisabled();
      fireEvent.click(castButton);
      expect(onCast).not.toHaveBeenCalled();
    });

    it('marks spell as upcast when selecting higher level and calling onCast', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const upcastLevels = [
        { level: 1, formula: '3d4+1', availableSlots: 4 },
        { level: 2, formula: '4d4+1', availableSlots: 3 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        onCast,
        upcastLevels,
      });

      // Select level 2
      const radios = screen.getAllByRole('radio');
      fireEvent.click(radios[1]);
      expect(radios[1]).toBeChecked();

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      const castSpell = onCast.mock.calls[0][0];
      expect(castSpell.level).toBe(2);
    });

    it('passes _psychicSpellsOverride when Warlock casts with psychic damage toggle', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const onCast = vi.fn();
      const warlockStats = {
        ...baseMockPlayerStats,
        class: { name: 'Warlock', major: { name: 'Warlock' } },
        automation: {
          passives: [{ type: 'psychic_spells' }],
          actions: [],
        },
      };
      const spell = {
        ...baseMockSpell,
        school: 'Enchantment',
        damage: { damage_at_slot_level: { '1': '1d6' } },
      };
      renderPopup(spell, warlockStats, mockCampaignName, { onCast });

      // Toggle the psychic damage checkbox
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      const castSpell = onCast.mock.calls[0][0];
      expect(castSpell._psychicSpellsOverride).toBe(true);
    });

    it('passes modified casting_time when Dispel Magic is cast with Spell Breaker', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const onCast = vi.fn();
      const spellBreakerStats = {
        ...baseMockPlayerStats,
        automation: {
          passives: [{ type: 'passive_rule', effect: 'spell_breaker' }],
          actions: [],
        },
      };
      const dispelSpell = {
        ...baseMockSpell,
        name: 'Dispel Magic',
        casting_time: '1 action',
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(dispelSpell, spellBreakerStats, mockCampaignName, { onCast });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalledTimes(1);
      const castSpell = onCast.mock.calls[0][0];
      expect(castSpell.casting_time).toBe('1 bonus action');
    });

    it('decrements spell slot when casting a non-free-cast spell', () => {
      vi.mocked(getRuntimeValue).mockReturnValue(4);
      vi.mocked(setRuntimeValue).mockReturnValue();

      const onCast = vi.fn();
      const noSlotsSpell = {
        ...baseMockSpell,
        damage: { damage_at_slot_level: { '1': '3d4+1' } },
      };
      renderPopup(noSlotsSpell, baseMockPlayerStats, mockCampaignName, {
        onCast,
      });

      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Elara',
        'spell_slots_level_1',
        3,
        mockCampaignName
      );
    });
  });

  describe('description rendering edge cases', () => {
    it('joins description array strings when rendering', () => {
      const spell = {
        ...baseMockSpell,
        description: ['Line 1.', 'Line 2.'],
      };
      renderPopup(spell);
      expect(screen.getByText('Line 1.Line 2.')).toBeInTheDocument();
    });

    it('handles missing description gracefully', () => {
      const spell = {
        ...baseMockSpell,
        description: undefined,
      };
      renderPopup(spell);
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
    });
  });
});
