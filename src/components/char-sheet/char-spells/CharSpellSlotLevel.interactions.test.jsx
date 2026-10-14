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

  describe('click interactions', () => {
    it('spends one slot: writes availableSlots - 1 for its own level key', () => {
      const { element } = renderLevel({ level: 1, totalSlots: 3, availableSlots: 3 });

      fireEvent.click(element);

      expectSlotWrite(1, 2);
    });

    it('resets to totalSlots when clicking with no slots available', () => {
      const { element } = renderLevel({ level: 2, totalSlots: 5, availableSlots: 0 });

      fireEvent.click(element);

      expectSlotWrite(2, 5);
    });

    it('writes 0 (never a negative count) for a zero-slot level', () => {
      const { element } = renderLevel({ level: 1, totalSlots: 0, availableSlots: 0 });

      fireEvent.click(element);

      expectSlotWrite(1, 0);
    });
  });

  describe('keyboard interactions', () => {
    it.each([{ key: 'Enter' }, { key: ' ' }])(
      'spends one slot when activated with the $key key',
      ({ key }) => {
        const { element } = renderLevel({ level: 1, totalSlots: 3, availableSlots: 3 });

        fireEvent.keyDown(element, { key });

        expectSlotWrite(1, 2);
      }
    );

    it('does NOT spend a slot on Tab while slots are available', () => {
      const { element } = renderLevel({ level: 1, totalSlots: 3, availableSlots: 3 });

      fireEvent.keyDown(element, { key: 'Tab' });

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does NOT reset to totalSlots on Tab when no slots are available', () => {
      const { element } = renderLevel({ level: 1, totalSlots: 3, availableSlots: 0 });

      fireEvent.keyDown(element, { key: 'Tab' });

      expect(setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  describe('repeated activation', () => {
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

      expect(setRuntimeValue.mock.calls.map((call) => call[2])).toEqual([1, 0, 2]);
      // Every write targets this level's key, character, and campaign.
      expect(
        setRuntimeValue.mock.calls.every(
          ([name, key, , campaign]) =>
            name === CHARACTER && key === 'spell_slots_level_1' && campaign === CAMPAIGN
        )
      ).toBe(true);
    });
  });
});
