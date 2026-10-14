import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocks ──

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(() => false),
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

describe('LongRestButton - long rest click flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows CreatureSelectionModal when applyLongRest returns celestialResilienceAllies', async () => {
    const celestialData = {
      creatureTargets: [{ name: 'Ally1', type: 'player' }],
      allyTempHp: 10,
      selfTempHp: 5,
      maxTargets: 5,
    };
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });

    render(<LongRestButton {...makeProps()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).toBeInTheDocument();
    });
  });

  it('calls onLongRest when celestialResilienceAllies is falsy (null or undefined)', async () => {
    // Test with null
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: null });

    const onLongRest = vi.fn();
    const { unmount } = render(<LongRestButton {...makeProps({ onLongRest })} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(onLongRest).toHaveBeenCalledTimes(1);
    });

    expect(document.querySelector('[data-testid="creature-selection-modal"]')).not.toBeInTheDocument();

    unmount();

    // Test with undefined
    restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: undefined });

    const onLongRest2 = vi.fn();
    render(<LongRestButton {...makeProps({ onLongRest: onLongRest2 })} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(onLongRest2).toHaveBeenCalledTimes(1);
    });

    expect(document.querySelector('[data-testid="creature-selection-modal"]')).not.toBeInTheDocument();
  });

});
