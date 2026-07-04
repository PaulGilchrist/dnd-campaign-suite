/* @improved-by-ai */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SpellDetailPopup from './SpellDetailPopup.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
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

  describe('area of effect rendering', () => {
    it('renders area of effect with type and size', () => {
      const spell = {
        ...baseMockSpell,
        area_of_effect: { type: 'Circle', size: '20 ft. radius' },
      };
      renderPopup(spell);
      expect(screen.getByText(/Area:/)).toBeInTheDocument();
      expect(screen.getByText('Circle - 20 ft. radius')).toBeInTheDocument();
    });

    it('renders area of effect with only type when size is missing', () => {
      const spell = {
        ...baseMockSpell,
        area_of_effect: { type: 'Sphere' },
      };
      renderPopup(spell);
      expect(screen.getByText('Sphere')).toBeInTheDocument();
    });

    it('does not render area field when area_of_effect is missing', () => {
      renderPopup(baseMockSpell);
      expect(screen.queryByText(/Area:/)).not.toBeInTheDocument();
    });
  });

  describe('missing metadata fields', () => {
    it('renders dash for missing casting_time', () => {
      const spell = {
        ...baseMockSpell,
        casting_time: undefined,
      };
      renderPopup(spell);
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders dash for missing range', () => {
      const spell = {
        ...baseMockSpell,
        range: undefined,
      };
      renderPopup(spell);
      const rangeTexts = screen.getAllByText(/—/);
      expect(rangeTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('renders dash for missing duration', () => {
      const spell = {
        ...baseMockSpell,
        duration: undefined,
      };
      renderPopup(spell);
      const dashTexts = screen.getAllByText('—');
      expect(dashTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('does not render school span when school is missing', () => {
      const spell = {
        ...baseMockSpell,
        school: undefined,
      };
      renderPopup(spell);
      expect(screen.getByText(/Level:/)).toBeInTheDocument();
      expect(screen.getByText(/Casting Time:/)).toBeInTheDocument();
      expect(screen.getByText(/Range:/)).toBeInTheDocument();
      expect(screen.getByText(/Duration:/)).toBeInTheDocument();
    });
  });
});
