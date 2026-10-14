// @maintained-by-ai
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

// Slots and header are plain divs (no accessible role), so they are located
// by class. Visual convention from CharSpellSlotLevel.css:
//   .inactive = filled box  → slot still available (unspent)
//   .active   = empty box   → slot spent
//   no class  = blank box   → placeholder beyond this level's totalSlots
// These tests pin the class → state mapping and the fixed grid structure;
// click/key writes are covered in .interactions.test.jsx and value
// resolution (stored vs _trackedResources vs totalSlots) in
// .fallback.test.jsx.
function renderLevel({ level = 1, totalSlots = 4, availableSlots = totalSlots } = {}) {
  useRuntimeValue.mockReturnValue(availableSlots);

  const { container } = render(
    <CharSpellSlotLevel
      level={level}
      totalSlots={totalSlots}
      playerStats={helpers.createPlayerStats()}
      campaignName={CAMPAIGN}
    />
  );

  return {
    container,
    slots: [...container.querySelectorAll('.slot')].map((slot) => {
      if (slot.classList.contains('active')) return 'spent';
      if (slot.classList.contains('inactive')) return 'available';
      return 'blank';
    }),
  };
}

describe('CharSpellSlotLevel - Rendering', () => {
  beforeEach(() => {
    // reset (not clear) so mockReturnValue cannot leak between tests
    vi.resetAllMocks();
  });

  it('renders the level header above a fixed 2×2 slot grid that accepts keyboard focus', () => {
    // level differs from both slot counts so the header assertion cannot
    // pass by matching a coincidental number elsewhere in the component.
    const { container, slots } = renderLevel({ level: 3, totalSlots: 2, availableSlots: 1 });

    const header = screen.getByText('3');
    expect(header).toHaveClass('header');

    const rows = [...container.querySelectorAll('.row')];
    expect(rows.map((row) => row.querySelectorAll('.slot').length)).toEqual([2, 2]);
    expect(slots.length).toBe(4);

    expect(container.querySelector('.char-spell-slot-level').tabIndex).toBe(0);
  });

  // Expected patterns are spelled out per case (not recomputed from the
  // component's formula). Each case pins a distinct branch outcome:
  // all-available, partial (spent left-to-right), all-spent, the spent/blank
  // boundary below totalSlots, no slots at all, and available > total never
  // adding extra blanks. Intermediate counts (3 or 1 of 4) merely shift the
  // same spent boundary, and totalSlots > 4 evaluates positions 0-3 with the
  // same flags as total 4 — those add no branch coverage.
  it.each([
    { totalSlots: 4, availableSlots: 4, description: 'nothing spent', expected: ['available', 'available', 'available', 'available'] },
    { totalSlots: 4, availableSlots: 2, description: 'half spent left-to-right', expected: ['spent', 'spent', 'available', 'available'] },
    { totalSlots: 4, availableSlots: 0, description: 'all spent', expected: ['spent', 'spent', 'spent', 'spent'] },
    { totalSlots: 3, availableSlots: 1, description: 'total of three with two spent: spent and blank meet', expected: ['spent', 'spent', 'available', 'blank'] },
    { totalSlots: 0, availableSlots: 0, description: 'no slots for this level', expected: ['blank', 'blank', 'blank', 'blank'] },
    { totalSlots: 2, availableSlots: 3, description: 'available exceeds total: never extra blanks', expected: ['available', 'available', 'blank', 'blank'] },
  ])(
    'marks slots spent/available/blank when $description',
    ({ totalSlots, availableSlots, expected }) => {
      expect(renderLevel({ level: 1, totalSlots, availableSlots }).slots).toEqual(expected);
    }
  );
});
