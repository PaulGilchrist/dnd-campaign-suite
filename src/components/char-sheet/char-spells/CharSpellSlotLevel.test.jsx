// @cleaned-by-ai
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

    it.each`
      availableSlots | totalSlots | expectedActive
      ${3}           | ${4}       | ${3}
      ${4}           | ${4}       | ${4}
      ${0}           | ${3}       | ${0}
    `('renders $expectedActive active slots when availableSlots=$availableSlots and totalSlots=$totalSlots', ({ availableSlots, totalSlots, expectedActive }) => {
      useRuntimeValue.mockReturnValue(availableSlots);

      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={totalSlots}
          playerStats={createPlayerStats()}
        />
      );

      const slots = container.querySelectorAll('.slot');
      const activeSlots = [...slots].filter((slot) => slot.classList.contains('active'));
      expect(activeSlots.length).toBe(expectedActive);

      const inactiveSlots = [...slots].filter((slot) => slot.classList.contains('inactive'));
      if (availableSlots === 0 && totalSlots > 0) {
        expect(inactiveSlots.length).toBe(totalSlots);
      }
    });

    it('falls back to _trackedResources when runtime value is null', () => {
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
      const activeSlots = [...slots].filter((slot) => slot.classList.contains('active'));
      expect(activeSlots.length).toBe(4);
    });

    it('falls back to totalSlots when both runtime value and _trackedResources are absent', () => {
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
      const activeSlots = [...slots].filter((slot) => slot.classList.contains('active'));
      expect(activeSlots.length).toBe(3);
    });
  });

  describe('interaction', () => {
    it.each`
      availableSlots | expectedNewValue
      ${3}           | ${2}
      ${0}           | ${3}
    `('decrements when available > 0, resets when 0 (availableSlots=$availableSlots)', ({ availableSlots, expectedNewValue }) => {
      useRuntimeValue.mockReturnValue(availableSlots);

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
        expectedNewValue,
        undefined
      );
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

    it('uses _trackedResources fallback for interaction when runtime value is null', () => {
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
  });
});
