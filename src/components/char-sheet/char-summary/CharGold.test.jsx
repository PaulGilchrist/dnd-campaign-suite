// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharGold from './CharGold.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

vi.mock('../../common/HiddenInput.jsx', () => ({
  default: vi.fn(({ value, showInput, displayValue }) => {
    const isDisplayingValue = displayValue !== false;
    if (showInput) {
      return (
        <input
          data-testid="gold-input"
          type="number"
          value={value}
        />
      );
    }
    return isDisplayingValue ? <span data-testid="gold-value">{value}</span> : null;
  }),
}));

const mockPlayerStats = {
  name: 'Test Character',
  inventory: { gold: 500 },
};

import { useRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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
});
