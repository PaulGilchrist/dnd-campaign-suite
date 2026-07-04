// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('renders the Gold label and displays the gold value', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(screen.getByText(/Gold:/)).toBeInTheDocument();
    expect(screen.getByTestId('gold-value')).toHaveTextContent('500');
  });

  it('falls back to 0 when inventory.gold is undefined', () => {
    const statsWithoutGold = { name: 'Empty Character', inventory: {} };

    render(<CharGold playerStats={statsWithoutGold} campaignName={campaignName} />);

    expect(screen.getByTestId('gold-value')).toHaveTextContent('0');
  });

  it('uses stored gold from useRuntimeValue when available', () => {
    useRuntimeValue.mockReturnValue(250);

    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(screen.getByTestId('gold-value')).toHaveTextContent('250');
  });

  it('toggles input visibility on interaction', () => {
    render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

    expect(screen.queryByTestId('gold-input')).not.toBeInTheDocument();

    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);

    expect(screen.getByTestId('gold-input')).toBeInTheDocument();
  });

  it('calls setRuntimeValue when gold value is changed', () => {
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

  it('renders without campaignName', () => {
    render(<CharGold playerStats={mockPlayerStats} />);

    expect(screen.getByText(/Gold:/)).toBeInTheDocument();
    expect(screen.getByTestId('gold-value')).toBeInTheDocument();
  });
});
