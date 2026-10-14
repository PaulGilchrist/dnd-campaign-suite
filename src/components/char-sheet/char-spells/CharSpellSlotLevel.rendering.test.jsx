// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx';
import * as helpers from './CharSpellSlotLevel.test-utils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

import { useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'Test Campaign';

// The slots and header are plain divs (no accessible role), so they are
// located by class. Visual convention from CharSpellSlotLevel.css:
//   .inactive = filled box  → slot still available (unspent)
//   .active   = empty box   → slot spent
//   no class  = blank box   → placeholder beyond this level's totalSlots
// These tests pin the class → state mapping and the fixed grid structure;
// click/key writes are covered in .interactions.test.jsx and value
// resolution (stored vs _trackedResources vs totalSlots) in
// .fallback.test.jsx.
function renderLevel({
  level = 1,
  totalSlots = 4,
  availableSlots = totalSlots,
  playerStats,
} = {}) {
  useRuntimeValue.mockReturnValue(availableSlots);

  const { container } = render(
    <CharSpellSlotLevel
      level={level}
      totalSlots={totalSlots}
      playerStats={playerStats ?? helpers.createPlayerStats()}
      campaignName={CAMPAIGN}
    />
  );

  return [...container.querySelectorAll('.slot')].map((slot) => {
    if (slot.classList.contains('active')) return 'spent';
    if (slot.classList.contains('inactive')) return 'available';
    return 'blank';
  });
}

describe('CharSpellSlotLevel - Rendering', () => {
  beforeEach(() => {
    // reset (not clear) so mockReturnValue cannot leak between tests
    vi.resetAllMocks();
  });

  describe('header', () => {
    // availableSlots deliberately differs from level so the assertion cannot
    // pass by matching a coincidental number elsewhere in the component.
    it.each([1, 9])('displays the level number %i, distinct from the slot count', (level) => {
      renderLevel({ level, totalSlots: 4, availableSlots: 2 });

      const header = screen.getByText(String(level));
      expect(header).toHaveClass('header');
      expect(header.textContent).toBe(String(level));
    });
  });

  describe('slot grid', () => {
    it('always renders a fixed grid of four slots in two rows of two', () => {
      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={3}
          playerStats={helpers.createPlayerStats()}
          campaignName={CAMPAIGN}
        />
      );

      const rows = [...container.querySelectorAll('.row')];
      expect(rows.length).toBe(2);
      expect(rows.map((row) => row.querySelectorAll('.slot').length)).toEqual([2, 2]);
    });

    it('is keyboard-focusable', () => {
      const { container } = render(
        <CharSpellSlotLevel
          level={1}
          totalSlots={4}
          playerStats={helpers.createPlayerStats()}
          campaignName={CAMPAIGN}
        />
      );

      expect(container.querySelector('.char-spell-slot-level').tabIndex).toBe(0);
    });
  });

  describe('slot states', () => {
    // Expected patterns are spelled out per case (not recomputed from the
    // component's formula): reading down the column documents that slots are
    // spent left-to-right, top row first, and blanks appear past totalSlots.
    it.each([
      { totalSlots: 4, availableSlots: 4, description: 'nothing spent', expected: ['available', 'available', 'available', 'available'] },
      { totalSlots: 4, availableSlots: 3, description: 'one spent', expected: ['spent', 'available', 'available', 'available'] },
      { totalSlots: 4, availableSlots: 2, description: 'two spent', expected: ['spent', 'spent', 'available', 'available'] },
      { totalSlots: 4, availableSlots: 1, description: 'three spent', expected: ['spent', 'spent', 'spent', 'available'] },
      { totalSlots: 4, availableSlots: 0, description: 'all spent', expected: ['spent', 'spent', 'spent', 'spent'] },
      { totalSlots: 3, availableSlots: 3, description: 'total of three: fourth box blank', expected: ['available', 'available', 'available', 'blank'] },
      { totalSlots: 3, availableSlots: 1, description: 'total of three with two spent', expected: ['spent', 'spent', 'available', 'blank'] },
      { totalSlots: 2, availableSlots: 0, description: 'total of two, both spent', expected: ['spent', 'spent', 'blank', 'blank'] },
      { totalSlots: 0, availableSlots: 0, description: 'no slots for this level', expected: ['blank', 'blank', 'blank', 'blank'] },
      { totalSlots: 2, availableSlots: 3, description: 'available exceeds total: never extra blanks', expected: ['available', 'available', 'blank', 'blank'] },
      { totalSlots: 6, availableSlots: 4, description: 'total beyond the grid: only four boxes shown', expected: ['spent', 'spent', 'available', 'available'] },
    ])(
      'marks slots spent/available/blank when $description',
      ({ totalSlots, availableSlots, expected }) => {
        expect(renderLevel({ level: 1, totalSlots, availableSlots })).toEqual(expected);
      }
    );
  });
});
