// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocked modules ──

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as tranceRules from '../../services/rules/effects/tranceRules.js';

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

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the button with "Long Rest" text', () => {
      render(<LongRestButton {...makeProps()} />);
      expect(screen.getByText('Long Rest')).toBeInTheDocument();
    });

    it('appends " (4 hours)" when player has Trance trait', () => {
      tranceRules.hasTranceTrait.mockReturnValue(true);
      render(<LongRestButton {...makeProps({ playerStats: trancePlayerStats })} />);
      expect(screen.getByText('Long Rest (4 hours)')).toBeInTheDocument();
    });
  });

  // ── Click behavior ──

  describe('on click', () => {
    it('calls onLongRest callback when provided', () => {
      const onLongRest = vi.fn();
      render(<LongRestButton {...makeProps({ onLongRest })} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onLongRest).toHaveBeenCalledTimes(1);
    });
  });
});
