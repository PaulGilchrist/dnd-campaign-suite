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
const CHARACTER = 'Test Character';

// The clickable region is a plain div with tabIndex (no accessible role),
// so it is located by its class. The subject of these tests is what each
// activation writes to the runtime store — visual slot states are covered
// in CharSpellSlotLevel.rendering.test.jsx and value resolution in
// CharSpellSlotLevel.fallback.test.jsx.
// `availableSlots` may be a function, to simulate a live store whose value
// changes as the component writes to it.
function renderLevel({ level = 1, totalSlots = 3, availableSlots = 3, playerStats } = {}) {
  useRuntimeValue.mockImplementation((_name, key) => {
    if (key !== `spell_slots_level_${level}`) return null;
    return typeof availableSlots === 'function' ? availableSlots() : availableSlots;
  });

  const stats = playerStats ?? helpers.createPlayerStats();
  const result = render(
    <CharSpellSlotLevel
      level={level}
      totalSlots={totalSlots}
      playerStats={stats}
      campaignName={CAMPAIGN}
    />
  );

  const element = result.container.querySelector('.char-spell-slot-level');
  return { element, result, stats };
}

function expectSlotWrite(level, newValue) {
  expect(setRuntimeValue).toHaveBeenCalledTimes(1);
  expect(setRuntimeValue).toHaveBeenCalledWith(
    CHARACTER,
    `spell_slots_level_${level}`,
    newValue,
    CAMPAIGN
  );
}

describe('CharSpellSlotLevel - Interactions', () => {
  beforeEach(() => {
    // reset (not clear) so mockImplementation cannot leak between tests
    vi.resetAllMocks();
  });

  it('mouse click spends one slot: writes availableSlots - 1 for its own level key', () => {
    const { element } = renderLevel({ level: 1, totalSlots: 3, availableSlots: 3 });

    fireEvent.click(element);

    expectSlotWrite(1, 2);
  });

  // One single-click test per handler branch (spend vs reset). The reset
  // branch always writes totalSlots, so it can never write a negative
  // count — no separate zero-slot case needed.
  it('resets to totalSlots when clicking with no slots available', () => {
    const { element } = renderLevel({ level: 2, totalSlots: 5, availableSlots: 0 });

    fireEvent.click(element);

    expectSlotWrite(2, 5);
  });

  it.each([
    { key: 'Enter' },
    { key: ' ' },
  ])('spends one slot when activated with the $key key', ({ key }) => {
    const { element } = renderLevel({ level: 1, totalSlots: 3, availableSlots: 3 });

    fireEvent.keyDown(element, { key });

    expectSlotWrite(1, 2);
  });

  // Tab only moves focus. Tested at 0-available (the worst regression:
  // tabbing past an exhausted level silently refilling every slot);
  // the guard is one line, so one negative case pins it for both branches.
  it('does NOT spend or reset slots on Tab', () => {
    const { element } = renderLevel({ level: 1, totalSlots: 3, availableSlots: 0 });

    fireEvent.keyDown(element, { key: 'Tab' });

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('cycles down through each slot and resets to totalSlots at zero', () => {
    // Simulate a live runtime store: each write becomes the value the
    // component reads back after the following re-render.
    let stored = 2;
    const { element, result, stats } = renderLevel({
      level: 1,
      totalSlots: 2,
      availableSlots: () => stored,
    });
    setRuntimeValue.mockImplementation((_name, _key, value) => {
      stored = value;
    });

    // The mocked hook does not re-render on write, so re-render manually
    // after each click to mimic the SSE round-trip the real store performs.
    const clickAndSync = () => {
      fireEvent.click(element);
      result.rerender(
        <CharSpellSlotLevel
          level={1}
          totalSlots={2}
          playerStats={stats}
          campaignName={CAMPAIGN}
        />
      );
    };

    clickAndSync(); // 2 -> 1
    clickAndSync(); // 1 -> 0
    clickAndSync(); // 0 -> reset to 2

    // Pin every argument of every write: each goes to this character's own
    // level key in this campaign, and the reset lands exactly at zero,
    // never before or after.
    expect(setRuntimeValue.mock.calls).toEqual([
      [CHARACTER, 'spell_slots_level_1', 1, CAMPAIGN],
      [CHARACTER, 'spell_slots_level_1', 0, CAMPAIGN],
      [CHARACTER, 'spell_slots_level_1', 2, CAMPAIGN],
    ]);
  });
});
