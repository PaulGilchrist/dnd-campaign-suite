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
      expect(slots[3]).not.toHaveClass('active');
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
  });

  describe('available slots source', () => {
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

    it.each(['Enter', ' ', 'ArrowDown'])(
      'decrements on %s key press',
      (key) => {
        useRuntimeValue.mockReturnValue(3);

        const { container } = render(
          <CharSpellSlotLevel
            level={1}
            totalSlots={3}
            playerStats={createPlayerStats()}
          />
        );

        const levelDiv = container.querySelector('.level');
        fireEvent.keyDown(levelDiv, { key });

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'spell_slots_level_1',
          2,
          undefined
        );
      }
    );

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
