// @maintained-by-ai
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

// The component resolves availableSlots through a chain:
// stored runtime value → _trackedResources for this level → totalSlots.
// Slots are plain divs (no accessible role), so spent slots are counted by
// their visual-state class — the exact class→state mapping is pinned in
// .rendering.test.jsx; the subject here is always the resolved value.
// Runtime values are provided as a key→value map so a wrong-key subscription
// or a wrong-level tracked lookup changes the rendered spent count.
// With totalSlots fixed at 4, spent = 4 - availableSlots.
function renderAndCountSpent({ level = 1, totalSlots = 4, stored = {}, tracked = {} } = {}) {
  useRuntimeValue.mockImplementation((_name, key) => stored[key] ?? null);

  const { container } = render(
    <CharSpellSlotLevel
      level={level}
      totalSlots={totalSlots}
      playerStats={helpers.createPlayerStats({ _trackedResources: tracked })}
      campaignName={CAMPAIGN}
    />
  );

  return {
    element: container.querySelector('.char-spell-slot-level'),
    spent: [...container.querySelectorAll('.slot')].filter((slot) =>
      slot.classList.contains('active')
    ).length,
  };
}

describe('CharSpellSlotLevel - availableSlots resolution chain', () => {
  beforeEach(() => {
    // reset (not clear) so mockImplementation cannot leak between tests
    vi.resetAllMocks();
  });

  it.each([
    {
      description: 'nothing is stored, tracked resources and totalSlots disagree',
      stored: { spell_slots_level_1: 2 },
      tracked: { spell_slots_level_1: { current: 3 } },
      expectedSpent: 2,
    },
    {
      description: 'a stored value of 0 must act as a real value, not fall back to tracked 3',
      stored: { spell_slots_level_1: 0 },
      tracked: { spell_slots_level_1: { current: 3 } },
      expectedSpent: 4,
    },
    {
      description: 'nothing is stored and the tracked current is used',
      tracked: { spell_slots_level_1: { current: 1 } },
      expectedSpent: 3,
    },
    {
      description: 'nothing is stored and the tracked entry has no current',
      tracked: { spell_slots_level_1: {} },
      expectedSpent: 0,
    },
    {
      description: 'tracked resources belong only to other spell levels',
      tracked: { spell_slots_level_2: { current: 0 } },
      expectedSpent: 0,
    },
    {
      level: 3,
      description: 'the runtime value is stored under another level, so the level-3 tracked value of 1 is used',
      stored: { spell_slots_level_1: 99 },
      tracked: { spell_slots_level_3: { current: 1 } },
      expectedSpent: 3,
    },
  ])('uses the right source when $description', ({ level = 1, stored, tracked, expectedSpent }) => {
    const { spent } = renderAndCountSpent({ level, stored, tracked });
    expect(spent).toBe(expectedSpent);
  });

  it('subscribes with the character name, its own level key, and campaign', () => {
    // Another level's value (99) would render nothing spent if the component
    // subscribed with the wrong key (covered behaviorally above; this pins
    // that the subscription arguments themselves come from the props).
    const { spent } = renderAndCountSpent({
      level: 3,
      stored: { spell_slots_level_3: 1, spell_slots_level_1: 99 },
    });

    expect(spent).toBe(3);
    expect(useRuntimeValue).toHaveBeenCalledWith(
      'Test Character',
      'spell_slots_level_3',
      CAMPAIGN
    );
  });

  it('clicking decrements the tracked-derived count when nothing is stored', () => {
    const { element } = renderAndCountSpent({
      tracked: { spell_slots_level_1: { current: 2 } },
    });

    fireEvent.click(element);

    // availableSlots fell back to 2, so a click writes 1
    expect(setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test Character',
      'spell_slots_level_1',
      1,
      CAMPAIGN
    );
  });
});
