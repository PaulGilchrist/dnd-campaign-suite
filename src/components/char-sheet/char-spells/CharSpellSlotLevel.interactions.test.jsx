import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx';
import * as helpers from './CharSpellSlotLevel.test-utils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { useRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const campaignName = 'Test Campaign';

function renderSpellSlotLevel(props = {}) {
  return render(
    <CharSpellSlotLevel
      level={1}
      totalSlots={3}
      campaignName={campaignName}
      playerStats={helpers.createPlayerStats()}
      {...props}
    />
  );
}

describe('CharSpellSlotLevel - Interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('click interactions', () => {
    it('decrements availableSlots by 1 when available > 0', () => {
      useRuntimeValue.mockReturnValue(3);

      renderSpellSlotLevel();

      const levelElement = screen.getByText('1');
      levelElement.click();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        2,
        campaignName
      );
    });

    it('resets to totalSlots when availableSlots is 0', () => {
      useRuntimeValue.mockReturnValue(0);

      renderSpellSlotLevel({ level: 2, totalSlots: 5 });

      const levelElement = screen.getByText('2');
      levelElement.click();

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_2',
        5,
        campaignName
      );
    });
  });

  describe('keyboard interactions', () => {
    it('does NOT decrement on Tab key press', () => {
      useRuntimeValue.mockReturnValue(3);

      renderSpellSlotLevel();

      const levelElement = screen.getByText('1');
      fireEvent.keyDown(levelElement, { key: 'Tab' });

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });
});
