/* @cleaned-by-ai */
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
    it('renders spell name, description, and all metadata fields', () => {
      renderPopup();
      expect(screen.getByText('Magic Missile')).toBeInTheDocument();
      expect(
        screen.getByText('Three darts of force strike a creature.')
      ).toBeInTheDocument();
      expect(screen.getByText(/Level:/)).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText(/Casting Time:/)).toBeInTheDocument();
      expect(screen.getByText('1 action')).toBeInTheDocument();
      expect(screen.getByText(/Range:/)).toBeInTheDocument();
      expect(screen.getByText('120 feet')).toBeInTheDocument();
      expect(screen.getByText(/Duration:/)).toBeInTheDocument();
      expect(screen.getByText('Instantaneous')).toBeInTheDocument();
      expect(screen.getByText(/School:/)).toBeInTheDocument();
      expect(screen.getByText('Evocation')).toBeInTheDocument();
    });

    it('renders "Cantrip" for level 0 spells', () => {
      const cantrip = { ...baseMockSpell, level: 0 };
      renderPopup(cantrip);
      expect(screen.getByText('Cantrip')).toBeInTheDocument();
    });

    it.each([
      { spell: { ...baseMockSpell, level: 0 }, showSlots: false, name: 'cantrip' },
      { spell: baseMockSpell, showSlots: true, name: 'non-upcastable spell' },
    ])('shows slots remaining for $name, hides for cantrip', ({ spell, showSlots }) => {
      renderPopup(spell);
      if (showSlots) {
        expect(screen.getByText(/Slots Remaining:/)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(/Slots Remaining:/)).not.toBeInTheDocument();
      }
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

    it('renders Close button', () => {
      renderPopup();
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

    it.each([
      { levels: [{ level: 1, formula: '3d4+1', availableSlots: 0 }, { level: 2, formula: '4d4+1', availableSlots: 3 }], expectedChecked: 1, expectedDefault: 'first available', name: 'first available slot' },
      { levels: [{ level: 1, formula: '3d4+1', availableSlots: 4 }], expectedChecked: null, expectedDefault: 'base level', name: 'single level (no selector shown)' },
    ])('defaults to $expectedDefault when $name', ({ levels, expectedChecked }) => {
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels: levels,
      });
      if (expectedChecked !== null) {
        const radios = screen.getAllByRole('radio');
        expect(radios[expectedChecked]).toBeChecked();
      } else {
        expect(screen.queryByText(/Cast at Level:/)).not.toBeInTheDocument();
      }
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

    it.each([
      { slots: 3, expectedText: '3 slots', name: 'plural' },
      { slots: 1, expectedText: '1 slot', name: 'singular' },
    ])('uses $name slot label for available slots', ({ slots, expectedText }) => {
      const upcastLevels = [
        { level: 2, formula: '4d4+1', availableSlots: slots },
        { level: 3, formula: '5d4+1', availableSlots: 2 },
      ];
      renderPopup(baseMockSpell, baseMockPlayerStats, mockCampaignName, {
        upcastLevels,
      });
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    });
  });

  describe('cantrip auto-level', () => {
    it('adjusts cantrip level based on character level thresholds', () => {
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

      // Character level exceeds threshold → auto-levels to 5
      renderPopup(cantrip, baseMockPlayerStats, mockCampaignName, {
        onCast,
        playerLevel: 5,
      });
      fireEvent.click(screen.getByRole('button', { name: /Cast Spell/ }));
      expect(onCast).toHaveBeenCalled();
      expect(onCast.mock.calls[0][0].level).toBe(5);

      onCast.mockClear();

      // Character level below threshold → keeps base level 0
      renderPopup(cantrip, baseMockPlayerStats, mockCampaignName, {
        onCast,
        playerLevel: 2,
      });
      const castButtons = screen.getAllByRole('button', { name: /Cast Spell/ });
      fireEvent.click(castButtons[1]);
      expect(onCast).toHaveBeenCalled();
      expect(onCast.mock.calls[0][0].level).toBe(0);
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
  });

  describe('area of effect rendering', () => {
    it.each([
      { aoe: { type: 'Circle', size: '20 ft. radius' }, expectedText: 'Circle - 20 ft. radius', name: 'with type and size' },
      { aoe: { type: 'Sphere' }, expectedText: 'Sphere', name: 'type only, no size' },
    ])('renders area of effect $name', ({ aoe, expectedText }) => {
      const spell = {
        ...baseMockSpell,
        area_of_effect: aoe,
      };
      renderPopup(spell);
      expect(screen.getByText(/Area:/)).toBeInTheDocument();
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    });
  });

  describe('missing metadata fields', () => {
    it('renders dash for missing casting_time, range, and duration', () => {
      const spell = {
        ...baseMockSpell,
        casting_time: undefined,
        range: undefined,
        duration: undefined,
      };
      renderPopup(spell);
      const dashTexts = screen.getAllByText('—');
      expect(dashTexts.length).toBeGreaterThanOrEqual(3);
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
      expect(screen.queryByText('Evocation')).not.toBeInTheDocument();
    });
  });
});
