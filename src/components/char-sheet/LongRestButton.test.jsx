// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocked modules ──

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  applyLongRest: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as tranceRules from '../../services/rules/effects/tranceRules.js';
import * as restRules from '../../services/rules/effects/restRules.js';

// ── Test fixtures ──

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
  hitPoints: 45,
  class: { name: 'Cleric' },
};

const trancePlayerStats = {
  ...basePlayerStats,
  race: { traits: [{ name: 'Trance' }] },
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
  });

  it('renders with correct text based on Trance trait and calls onLongRest on click', async () => {
    const onLongRest = vi.fn();
    tranceRules.hasTranceTrait.mockReturnValue(false);
    const { rerender } = render(<LongRestButton {...makeProps({ onLongRest })} />);
    expect(screen.getByText('Long Rest')).toBeInTheDocument();

    tranceRules.hasTranceTrait.mockReturnValue(true);
    rerender(<LongRestButton {...makeProps({ playerStats: trancePlayerStats, onLongRest })} />);
    expect(screen.getByText('Long Rest (4 hours)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(restRules.applyLongRest).toHaveBeenCalledWith(expect.any(Object), mockCampaignName);
    await vi.waitFor(() => {
      expect(onLongRest).toHaveBeenCalledTimes(1);
    });
  });
});
