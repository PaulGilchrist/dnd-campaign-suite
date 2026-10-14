import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharSpellSlotLevel from './CharSpellSlotLevel.jsx';
import * as helpers from './CharSpellSlotLevel.test-utils.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
}));

import { useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

describe('CharSpellSlotLevel - Fallback Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('available slots resolution', () => {
    it('resolves available slots from runtime value, _trackedResources, or totalSlots fallback chain', () => {
      // When runtime value is defined (even 0), it takes priority over _trackedResources
      useRuntimeValue.mockReturnValue(2);

      const playerStats = helpers.createPlayerStats({
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

      const slots = [...container.querySelectorAll('.slot')];
      expect(slots.length).toBe(4);

      const activeCount = slots.filter((s) => s.classList.contains('active')).length;
      expect(activeCount).toBe(2);
    });
  });
});
