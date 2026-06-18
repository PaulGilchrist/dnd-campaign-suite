// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { useRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const createPlayerStats = (overrides = {}) => ({
  name: 'Test Character',
  _trackedResources: {},
  ...overrides,
});

describe('CharSpellSlotLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the level number in the header', () => {
      useRuntimeValue.mockReturnValue(3);

      render(
        <CharSpellSlotLevel
          level={2}
          totalSlots={3}
          playerStats={createPlayerStats()}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders four slot divs when totalSlots >= 4', () => {
      useRuntimeValue.mockReturnValue(4);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={4}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots).toHaveLength(4);
    });

    it('renders four slot divs when totalSlots is less than 4', () => {
      useRuntimeValue.mockReturnValue(2);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={2}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots).toHaveLength(4);
    });

    it('renders four slot divs when totalSlots is 0', () => {
      useRuntimeValue.mockReturnValue(0);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={0}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots).toHaveLength(4);
    });
  });

  describe('slot active/inactive classes', () => {
    it('marks slots as active when availableSlots exceeds slot index', () => {
      useRuntimeValue.mockReturnValue(3);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={4}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots[0]).toHaveClass('active');
      expect(slots[1]).toHaveClass('active');
      expect(slots[2]).toHaveClass('active');
      expect(slots[3]).toHaveClass('inactive');
    });

    it('marks all slots as active when availableSlots equals totalSlots', () => {
      useRuntimeValue.mockReturnValue(4);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={4}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots[0]).toHaveClass('active');
      expect(slots[1]).toHaveClass('active');
      expect(slots[2]).toHaveClass('active');
      expect(slots[3]).toHaveClass('active');
    });

    it('marks slots as inactive when availableSlots is 0 and totalSlots > 0', () => {
      useRuntimeValue.mockReturnValue(0);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots[0]).toHaveClass('inactive');
      expect(slots[1]).toHaveClass('inactive');
      expect(slots[2]).toHaveClass('inactive');
      // Slot 3 has no class because totalSlots (3) is not > 3
      expect(slots[3]).not.toHaveClass('active');
      expect(slots[3]).not.toHaveClass('inactive');
    });

    it('marks no slots as active or inactive when totalSlots is 0', () => {
      useRuntimeValue.mockReturnValue(0);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={0}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      slots.forEach((slot) => {
        expect(slot).not.toHaveClass('active');
        expect(slot).not.toHaveClass('inactive');
      });
    });

    it('marks all slots as active when availableSlots exceeds totalSlots', () => {
      useRuntimeValue.mockReturnValue(10);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={4}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots[0]).toHaveClass('active');
      expect(slots[1]).toHaveClass('active');
      expect(slots[2]).toHaveClass('active');
      expect(slots[3]).toHaveClass('active');
    });

    it('marks exactly the right number of slots as active for totalSlots of 1', () => {
      useRuntimeValue.mockReturnValue(1);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={1}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots[0]).toHaveClass('active');
      expect(slots[1]).not.toHaveClass('active');
      expect(slots[2]).not.toHaveClass('active');
      expect(slots[3]).not.toHaveClass('active');
    });
  });

  describe('available slots source', () => {
    it('uses stored value from useRuntimeValue when available', () => {
      useRuntimeValue.mockReturnValue(2);

      render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={4}
          playerStats={createPlayerStats()}
        />
      );

      expect(useRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        undefined
      );
    });

    it('uses stored value with campaignName when provided', () => {
      useRuntimeValue.mockReturnValue(2);

      render(
        <CharSpellSlotLevel
          level={2}
          totalSlots={3}
          playerStats={createPlayerStats()}
          campaignName="MyCampaign"
        />
      );

      expect(useRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_2',
        'MyCampaign'
      );
    });

    it('falls back to _trackedResources.current when useRuntimeValue returns null', () => {
      useRuntimeValue.mockReturnValue(null);

      const playerStats = createPlayerStats({
        _trackedResources: {
          'spell_slots_level_3': { current: 5 },
        },
      });

      const { container } = render(
        <CharSpellSlotLevel
          level={3}
          totalSlots={4}
          playerStats={playerStats}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots[0]).toHaveClass('active');
      expect(slots[1]).toHaveClass('active');
      expect(slots[2]).toHaveClass('active');
      expect(slots[3]).toHaveClass('active');
    });

    it('falls back to totalSlots when both stored value and _trackedResources are absent', () => {
      useRuntimeValue.mockReturnValue(null);

      const playerStats = createPlayerStats({
        _trackedResources: {},
      });

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={playerStats}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots[0]).toHaveClass('active');
      expect(slots[1]).toHaveClass('active');
      expect(slots[2]).toHaveClass('active');
      expect(slots[3]).not.toHaveClass('active');
    });

    it('prefers stored value over _trackedResources', () => {
      useRuntimeValue.mockReturnValue(1);

      const playerStats = createPlayerStats({
        _trackedResources: {
          'spell_slots_level_1': { current: 4 },
        },
      });

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={4}
          playerStats={playerStats}
        />
      );

      const slots = container.querySelectorAll('.slot');
      // Stored value (1) takes precedence, so only slot 0 is active
      expect(slots[0]).toHaveClass('active');
      expect(slots[1]).not.toHaveClass('active');
      expect(slots[2]).not.toHaveClass('active');
      expect(slots[3]).not.toHaveClass('active');
    });
  });

  describe('interaction', () => {
    it('decrements available slots on click when slots are available', () => {
      useRuntimeValue.mockReturnValue(3);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={createPlayerStats()}
        />
      );

      const levelDiv = container.querySelector('.level');
      fireEvent.click(levelDiv);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2,
        undefined
      );
    });

    it('resets to totalSlots when availableSlots is 0 on click', () => {
      useRuntimeValue.mockReturnValue(0);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={createPlayerStats()}
        />
      );

      const levelDiv = container.querySelector('.level');
      fireEvent.click(levelDiv);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        3,
        undefined
      );
    });

    it('resets to totalSlots when using _trackedResources fallback and slots are 0', () => {
      useRuntimeValue.mockReturnValue(null);

      const playerStats = createPlayerStats({
        _trackedResources: {
          'spell_slots_level_2': { current: 0 },
        },
      });

      const { container } = render(
        <CharSpellSlotLevel
          level={2}
          totalSlots={4}
          playerStats={playerStats}
        />
      );

      const levelDiv = container.querySelector('.level');
      fireEvent.click(levelDiv);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_2',
        4,
        undefined
      );
    });

    it('does not decrement on Tab key press', () => {
      useRuntimeValue.mockReturnValue(3);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={createPlayerStats()}
        />
      );

      const levelDiv = container.querySelector('.level');
      fireEvent.keyDown(levelDiv, { key: 'Tab' });

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('decrements on Enter key press', () => {
      useRuntimeValue.mockReturnValue(3);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={createPlayerStats()}
        />
      );

      const levelDiv = container.querySelector('.level');
      fireEvent.keyDown(levelDiv, { key: 'Enter' });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2,
        undefined
      );
    });

    it('decrements on Space key press', () => {
      useRuntimeValue.mockReturnValue(3);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={createPlayerStats()}
        />
      );

      const levelDiv = container.querySelector('.level');
      fireEvent.keyDown(levelDiv, { key: ' ' });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2,
        undefined
      );
    });

    it('passes campaignName to setRuntimeValue on interaction', () => {
      useRuntimeValue.mockReturnValue(3);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={createPlayerStats()}
          campaignName="MyCampaign"
        />
      );

      const levelDiv = container.querySelector('.level');
      fireEvent.click(levelDiv);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2,
        'MyCampaign'
      );
    });

    it('decrements on ArrowDown key press', () => {
      useRuntimeValue.mockReturnValue(3);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={createPlayerStats()}
        />
      );

      const levelDiv = container.querySelector('.level');
      fireEvent.keyDown(levelDiv, { key: 'ArrowDown' });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2,
        undefined
      );
    });
  });

  describe('accessibility', () => {
    it('has clickable class and tabIndex on the level container', () => {
      useRuntimeValue.mockReturnValue(2);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={createPlayerStats()}
        />
      );

      const levelDiv = container.querySelector('.level');
      expect(levelDiv).toHaveClass('clickable');
      expect(levelDiv).toHaveAttribute('tabindex', '0');
    });
  });

  describe('playerStats edge cases', () => {
    it('handles playerStats with no _trackedResources property', () => {
      useRuntimeValue.mockReturnValue(null);

      const playerStats = { name: 'Test Character' };

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={playerStats}
        />
      );

      const slots = container.querySelectorAll('.slot');
      expect(slots[0]).toHaveClass('active');
      expect(slots[1]).toHaveClass('active');
      expect(slots[2]).toHaveClass('active');
      expect(slots[3]).not.toHaveClass('active');
    });

    it('throws when playerStats is null', () => {
      useRuntimeValue.mockReturnValue(2);

      expect(() =>
        render(
          <CharSpellSlotLevel
            level={1}
            totalSlots={3}
            playerStats={null}
          />
        )
      ).toThrow();
    });
  });
});
