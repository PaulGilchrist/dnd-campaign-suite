import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharGold from './CharGold.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
}));

import { useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function createPlayerStats(overrides = {}) {
  return {
    name: 'Test Character',
    inventory: { gold: 500 },
    ...overrides,
  };
}

function renderCharGold(overrides = {}) {
  const { playerStats: customPlayerStats, ...statsOverrides } = overrides;
  const playerStats = customPlayerStats || createPlayerStats(statsOverrides);
  return render(
    <CharGold
      playerStats={playerStats}
      campaignName="test-campaign"
    />
  );
}

describe('CharGold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeValue.mockReturnValue(null);
  });

  describe('value display priority', () => {
    it('displays stored runtime gold when available', () => {
      useRuntimeValue.mockReturnValue(250);

      renderCharGold();

      const clickable = screen.getByText(/Gold:/).parentElement;
      expect(clickable).toHaveTextContent(/Gold:\s*250/);
    });

    it('falls back to inventory.gold when runtime value is null', () => {
      renderCharGold();

      const clickable = screen.getByText(/Gold:/).parentElement;
      expect(clickable).toHaveTextContent(/Gold:\s*500/);
    });

    it('falls back to 0 when both runtime and inventory.gold are missing', () => {
      useRuntimeValue.mockReturnValue(null);

      renderCharGold({ inventory: {} });

      const clickable = screen.getByText(/Gold:/).parentElement;
      expect(clickable).toHaveTextContent(/Gold:\s*0/);
    });
  });
});
