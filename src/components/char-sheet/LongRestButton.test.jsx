// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocked modules ──

vi.mock('../../services/rules/effects/restRules.js', () => ({
  applyLongRest: vi.fn(),
}));

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as restRules from '../../services/rules/effects/restRules.js';
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

  describe('button text and icon', () => {
    it('renders the button with "Long Rest" text', () => {
      render(<LongRestButton {...makeProps()} />);
      expect(screen.getByText('Long Rest')).toBeInTheDocument();
    });

    it('renders a bed icon inside the button', () => {
      render(<LongRestButton {...makeProps()} />);
      const button = screen.getByRole('button', { name: /Long Rest/i });
      const icon = button.querySelector('i');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('fas');
      expect(icon).toHaveClass('fa-bed');
    });

    it('applies char-btn class to the button', () => {
      render(<LongRestButton {...makeProps()} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('char-btn');
    });

    it('appends " (4 hours)" when player has Trance trait', () => {
      tranceRules.hasTranceTrait.mockReturnValue(true);
      render(<LongRestButton {...makeProps({ playerStats: trancePlayerStats })} />);
      expect(screen.getByText('Long Rest (4 hours)')).toBeInTheDocument();
    });

    it('omits " (4 hours)" when player lacks Trance trait', () => {
      tranceRules.hasTranceTrait.mockReturnValue(false);
      render(<LongRestButton {...makeProps({ playerStats: trancePlayerStats })} />);
      expect(screen.getByText('Long Rest')).toBeInTheDocument();
    });
  });

  // ── Title attribute ──

  describe('title attribute', () => {
    it('includes "Long Rest" and "HP" in the title for non-trance', () => {
      tranceRules.hasTranceTrait.mockReturnValue(false);
      render(<LongRestButton {...makeProps()} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title');
      expect(button.getAttribute('title')).toContain('Long Rest');
      expect(button.getAttribute('title')).toContain('HP');
    });

    it('includes "4 hours" in the title for trance', () => {
      tranceRules.hasTranceTrait.mockReturnValue(true);
      render(<LongRestButton {...makeProps({ playerStats: trancePlayerStats })} />);
      const button = screen.getByRole('button');
      expect(button.getAttribute('title')).toContain('4 hours');
    });
  });

  // ── Click behavior ──

  describe('on click', () => {
    it('calls applyLongRest with playerStats and campaignName', () => {
      render(<LongRestButton {...makeProps()} />);
      fireEvent.click(screen.getByRole('button'));
      expect(restRules.applyLongRest).toHaveBeenCalledWith(
        basePlayerStats,
        mockCampaignName,
      );
    });

    it('calls onLongRest callback when provided', () => {
      const onLongRest = vi.fn();
      render(<LongRestButton {...makeProps({ onLongRest })} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onLongRest).toHaveBeenCalledTimes(1);
    });

    it('does not call onLongRest when it is not provided', () => {
      const props = makeProps();
      delete props.onLongRest;
      render(<LongRestButton {...props} />);
      fireEvent.click(screen.getByRole('button'));
      // No error thrown; applyLongRest was still called
      expect(restRules.applyLongRest).toHaveBeenCalled();
    });

    it('does not throw when onLongRest is not provided', () => {
      const props = makeProps();
      delete props.onLongRest;
      render(<LongRestButton {...props} />);
      expect(() => {
        fireEvent.click(screen.getByRole('button'));
      }).not.toThrow();
    });
  });

  // ── Props passthrough ──

  describe('props passthrough', () => {
    it('passes playerStats to applyLongRest', () => {
      const customStats = { name: 'AnotherChar', level: 10, hitPoints: 80 };
      render(<LongRestButton {...makeProps({ playerStats: customStats })} />);
      fireEvent.click(screen.getByRole('button'));
      expect(restRules.applyLongRest).toHaveBeenCalledWith(
        customStats,
        mockCampaignName,
      );
    });

    it('passes campaignName to applyLongRest', () => {
      render(<LongRestButton {...makeProps({ campaignName: 'my-campaign' })} />);
      fireEvent.click(screen.getByRole('button'));
      expect(restRules.applyLongRest).toHaveBeenCalledWith(
        basePlayerStats,
        'my-campaign',
      );
    });
  });
});
