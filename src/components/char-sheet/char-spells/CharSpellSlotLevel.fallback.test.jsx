// @improved-by-ai
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx';
import * as helpers from './CharSpellSlotLevel.test-utils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { useRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'Test Campaign';
const TOTAL_SLOTS = 4;

// Renders the component and returns the count of "spent" slots. The component
// renders slots as plain divs (no accessible role), so they are counted by
// their visual-state class — but each test's subject is the resolved
// availableSlots value, not the class mapping (covered in .rendering.test).
// With TOTAL_SLOTS fixed at 4, spentCount = TOTAL_SLOTS - availableSlots.
function renderAndCountSpent({ level = 1, totalSlots = TOTAL_SLOTS, playerStats } = {}) {
  const { container } = render(
    <CharSpellSlotLevel
      level={level}
      totalSlots={totalSlots}
      playerStats={playerStats ?? helpers.createPlayerStats()}
      campaignName={CAMPAIGN}
    />
  );
  return [...container.querySelectorAll('.slot')].filter((slot) =>
    slot.classList.contains('active')
  ).length;
}

describe('CharSpellSlotLevel - Fallback Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('availableSlots resolution chain', () => {
    it('prefers the stored runtime value over _trackedResources', () => {
      useRuntimeValue.mockReturnValue(2);

      const spent = renderAndCountSpent({
        playerStats: helpers.createPlayerStats({
          _trackedResources: { spell_slots_level_1: { current: 3 } },
        }),
      });

      // availableSlots = 2 (runtime), not 3 (tracked) → 2 spent slots
      expect(spent).toBe(2);
    });

    it('treats a stored runtime value of 0 as a real value, not as missing', () => {
      useRuntimeValue.mockReturnValue(0);

      const spent = renderAndCountSpent({
        playerStats: helpers.createPlayerStats({
          _trackedResources: { spell_slots_level_1: { current: 3 } },
        }),
      });

      // availableSlots = 0 → every slot spent; a truthiness check would
      // wrongly fall back to the tracked value of 3 (1 spent).
      expect(spent).toBe(4);
    });

    it('falls back to _trackedResources when no runtime value is stored', () => {
      useRuntimeValue.mockReturnValue(null);

      const spent = renderAndCountSpent({
        playerStats: helpers.createPlayerStats({
          _trackedResources: { spell_slots_level_1: { current: 1 } },
        }),
      });

      // availableSlots = 1 → 3 spent slots (not 0 from the totalSlots fallback)
      expect(spent).toBe(3);
    });

    it('falls back to totalSlots when the tracked entry has no current value', () => {
      useRuntimeValue.mockReturnValue(null);

      const spent = renderAndCountSpent({
        playerStats: helpers.createPlayerStats({
          _trackedResources: { spell_slots_level_1: {} },
        }),
      });

      // availableSlots = totalSlots → nothing spent
      expect(spent).toBe(0);
    });

    it('ignores tracked resources belonging to other spell levels', () => {
      useRuntimeValue.mockReturnValue(null);

      const spent = renderAndCountSpent({
        level: 1,
        playerStats: helpers.createPlayerStats({
          _trackedResources: { spell_slots_level_2: { current: 0 } },
        }),
      });

      // Level 1 has no tracked entry → availableSlots = totalSlots → 0 spent;
      // leaking level 2's tracked value of 0 would show 4 spent.
      expect(spent).toBe(0);
    });

    it('subscribes to the runtime key for its own level', () => {
      useRuntimeValue.mockImplementation((_name, key) =>
        key === 'spell_slots_level_3' ? 1 : 99
      );

      const spent = renderAndCountSpent({ level: 3, totalSlots: 4 });

      expect(useRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_3',
        CAMPAIGN
      );
      // availableSlots comes from level 3's key (1) → 3 spent,
      // not from another key (99 would render nothing spent).
      expect(spent).toBe(3);
    });
  });

  describe('fallback value drives interaction', () => {
    it('decrements the _trackedResources-derived count when no runtime value is stored', () => {
      useRuntimeValue.mockReturnValue(null);

      renderAndCountSpent({
        playerStats: helpers.createPlayerStats({
          _trackedResources: { spell_slots_level_1: { current: 2 } },
        }),
      });

      fireEvent.click(document.querySelector('.char-spell-slot-level'));

      // availableSlots fell back to 2, so a click writes 1
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'spell_slots_level_1',
        1,
        CAMPAIGN
      );
    });
  });
});
