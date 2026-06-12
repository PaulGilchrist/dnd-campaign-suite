import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocked modules ──

vi.mock('../../services/rules/restRules.js', () => ({
  applyLongRest: vi.fn(),
}));

// ── Re-import mocked modules ──
import * as restRules from '../../services/rules/restRules.js';

// ── Test fixtures ──

const mockPlayerStats = {
  name: 'TestCharacter',
  level: 5,
  hitPoints: 45,
  class: { name: 'Cleric' },
};

const mockCampaignName = 'test-campaign';

function makeProps(overrides) {
  return {
    playerStats: mockPlayerStats,
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

  it('renders the button with correct text', () => {
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

  it('includes a title describing the long rest effect', () => {
    render(<LongRestButton {...makeProps()} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title');
    expect(button.getAttribute('title')).toContain('Long Rest');
    expect(button.getAttribute('title')).toContain('HP');
  });

  // ── Click behavior ──

  it('calls applyLongRest when clicked', async () => {
    render(<LongRestButton {...makeProps()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(restRules.applyLongRest).toHaveBeenCalledWith(
      mockPlayerStats,
      mockCampaignName,
    );
  });

  it('calls onLongRest callback when provided and button is clicked', () => {
    const onLongRest = vi.fn();
    render(<LongRestButton {...makeProps({ onLongRest })} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onLongRest).toHaveBeenCalledTimes(1);
  });

  it('does not throw when onLongRest is not provided', () => {
    render(
      <LongRestButton
        playerStats={mockPlayerStats}
        campaignName={mockCampaignName}
      />,
    );
    expect(() => {
      fireEvent.click(screen.getByRole('button'));
    }).not.toThrow();
  });

  it('does not call onLongRest when it is not provided', () => {
    render(
      <LongRestButton
        playerStats={mockPlayerStats}
        campaignName={mockCampaignName}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    // No error thrown and applyLongRest was called
    expect(restRules.applyLongRest).toHaveBeenCalled();
  });

  // ── Props passthrough ──

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
      mockPlayerStats,
      'my-campaign',
    );
  });
});
