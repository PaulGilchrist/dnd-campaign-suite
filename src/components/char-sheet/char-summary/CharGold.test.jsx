// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharGold from './CharGold.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

vi.mock('../../common/HiddenInput.jsx', () => ({
  default: vi.fn(({ value, showInput, displayValue, handleValueChange, handleInputToggle }) => {
    const isDisplayingValue = displayValue !== false;
    if (showInput) {
      return (
        <input
          data-testid="gold-input"
          type="number"
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          onBlur={handleInputToggle}
        />
      );
    }
    return isDisplayingValue ? <span data-testid="gold-value">{value}</span> : null;
  }),
}));

import { setRuntimeValue, useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

const mockPlayerStats = {
  name: 'Test Character',
  inventory: { gold: 500 },
};

const campaignName = 'test-campaign';

describe('CharGold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeValue.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the Gold label', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(screen.getByText(/Gold:/)).toBeInTheDocument();
  });

  it('renders the HiddenInput component with the gold value', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(screen.getByTestId('gold-value')).toBeInTheDocument();
  });

  it('falls back to playerStats.inventory.gold when no stored value', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(screen.getByTestId('gold-value')).toHaveTextContent('500');
  });

  it('falls back to 0 when inventory.gold is undefined', () => {
    const statsWithoutGold = { name: 'Empty Character', inventory: {} };

    render(<CharGold playerStats={statsWithoutGold} campaignName={campaignName} />);

    expect(screen.getByTestId('gold-value')).toHaveTextContent('0');
  });

  it('uses stored gold value from useRuntimeValue when available', () => {
    useRuntimeValue.mockReturnValue(250);

    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(screen.getByTestId('gold-value')).toHaveTextContent('250');
  });

  it('prefers stored gold over inventory.gold', () => {
    useRuntimeValue.mockReturnValue(250);

    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(screen.getByTestId('gold-value')).toHaveTextContent('250');
  });

  it('calls useRuntimeValue with correct arguments', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(useRuntimeValue).toHaveBeenCalledWith(
      'Test Character',
      'gold',
      'test-campaign'
    );
  });

  it('toggles input visibility on click', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(screen.queryByTestId('gold-input')).not.toBeInTheDocument();

    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);

    expect(screen.getByTestId('gold-input')).toBeInTheDocument();
  });

  it('toggles input visibility on Enter keydown', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    const clickable = document.querySelector('.clickable');
    fireEvent.keyDown(clickable, { key: 'Enter' });

    expect(screen.getByTestId('gold-input')).toBeInTheDocument();
  });

  it('toggles input visibility on other keydown events', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    const clickable = document.querySelector('.clickable');
    fireEvent.keyDown(clickable, { key: ' ' });

    expect(screen.getByTestId('gold-input')).toBeInTheDocument();
  });

  it('passes campaignName to setRuntimeValue on value change', () => {
    useRuntimeValue.mockReturnValue(250);

    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);

    const input = screen.getByTestId('gold-input');
    fireEvent.change(input, { target: { value: '1000' } });

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Test Character',
      'gold',
      '1000',
      'test-campaign'
    );
  });

  it('has tabIndex for keyboard accessibility', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    const clickable = document.querySelector('.clickable');
    expect(clickable).toHaveAttribute('tabindex', '0');
  });

  it('has clickable class on the container div', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    const clickable = document.querySelector('.clickable');
    expect(clickable).toHaveClass('clickable');
  });

  it('renders with no campaignName', () => {
    render(<CharGold playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Gold:/)).toBeInTheDocument();
    expect(screen.getByTestId('gold-value')).toBeInTheDocument();
  });
});
