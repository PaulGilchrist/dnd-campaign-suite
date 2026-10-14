import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocks ──

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  applyLongRest: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function MockModal() {
    return <div data-testid="creature-selection-modal" />;
  },
}));

// ── Re-import mocks ──

import * as tranceRules from '../../services/rules/effects/tranceRules.js';
import * as restRules from '../../services/rules/effects/restRules.js';

// ── Fixtures ──

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
  hitPoints: 45,
  class: { name: 'Cleric' },
};

const mockCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    playerStats: basePlayerStats,
    campaignName: mockCampaignName,
    onLongRest: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('LongRestButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tranceRules.hasTranceTrait.mockReturnValue(false);
    restRules.applyLongRest.mockResolvedValue({});
  });

  it('renders the button and calls applyLongRest with correct arguments on click', async () => {
    const onLongRest = vi.fn();
    render(<LongRestButton {...makeProps({ onLongRest })} />);

    fireEvent.click(screen.getByRole('button'));

    expect(restRules.applyLongRest).toHaveBeenCalledWith(basePlayerStats, mockCampaignName);

    await waitFor(() => {
      expect(onLongRest).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call onLongRest when modal is shown', async () => {
    const onLongRest = vi.fn();
    restRules.applyLongRest.mockResolvedValue({
      celestialResilienceAllies: {
        creatureTargets: [{ name: 'Ally1', type: 'player' }],
        allyTempHp: 10,
        selfTempHp: 5,
        maxTargets: 5,
      },
    });

    render(<LongRestButton {...makeProps({ onLongRest })} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });

    expect(onLongRest).not.toHaveBeenCalled();
  });
});
