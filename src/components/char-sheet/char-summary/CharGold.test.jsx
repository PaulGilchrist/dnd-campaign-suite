import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharGold from './CharGold.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(),
}));

vi.mock('../../common/HiddenInput.jsx', () => {
  const MockHiddenInput = ({ value, showInput, handleValueChange, handleInputToggle, max }) => {
    const [localValue, setLocalValue] = React.useState(value ?? '');

    const commit = () => {
      const numVal = Number(localValue);
      const clamped = max != null ? Math.min(Math.max(numVal, 0), max) : Math.max(numVal, 0);
      handleValueChange(clamped);
      handleInputToggle();
    };

    const handleChange = (event) => {
      setLocalValue(event.target.value);
    };

    if (showInput) {
      return (
        <span className="hidden-input clickable">
          <input
            data-testid="gold-input"
            type="number"
            min="0"
            max={max}
            value={localValue}
            onChange={handleChange}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                commit();
              }
            }}
          />
        </span>
      );
    }
    return <span data-testid="gold-value">{value}</span>;
  };
  const React = require('react');
  MockHiddenInput.displayName = 'MockHiddenInput';
  return { default: MockHiddenInput };
});

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

  describe('initial display', () => {
    it('renders the Gold label and displays the gold value from runtime storage', () => {
      useRuntimeValue.mockReturnValue(250);

      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      expect(screen.getByText(/Gold:/)).toBeInTheDocument();
      expect(screen.getByTestId('gold-value')).toHaveTextContent('250');
    });

    it('falls back to inventory.gold when runtime storage is null', () => {
      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      expect(screen.getByText(/Gold:/)).toBeInTheDocument();
      expect(screen.getByTestId('gold-value')).toHaveTextContent('500');
    });

    it('falls back to 0 when inventory.gold is undefined', () => {
      const statsWithoutGold = { name: 'Empty Character', inventory: {} };

      render(<CharGold playerStats={statsWithoutGold} campaignName={campaignName} />);

      expect(screen.getByTestId('gold-value')).toHaveTextContent('0');
    });

    it('prioritizes runtime storage over inventory.gold', () => {
      useRuntimeValue.mockReturnValue(100);

      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      expect(screen.getByTestId('gold-value')).toHaveTextContent('100');
    });
  });

  describe('input toggling', () => {
    it('shows input when clickable area is clicked', () => {
      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      const clickable = screen.getByText(/Gold:/).parentElement;
      fireEvent.click(clickable);

      expect(screen.getByTestId('gold-input')).toBeInTheDocument();
      expect(screen.queryByTestId('gold-value')).not.toBeInTheDocument();
    });

    it('hides input and shows value when input is blurred', () => {
      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      const clickable = screen.getByText(/Gold:/).parentElement;
      fireEvent.click(clickable);
      expect(screen.getByTestId('gold-input')).toBeInTheDocument();

      const input = screen.getByTestId('gold-input');
      fireEvent.blur(input);

      expect(screen.getByTestId('gold-value')).toBeInTheDocument();
      expect(screen.queryByTestId('gold-input')).not.toBeInTheDocument();
    });

    it('is keyboard accessible via Enter key', () => {
      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      const clickable = screen.getByText(/Gold:/).parentElement;
      fireEvent.keyDown(clickable, { key: 'Enter' });

      expect(screen.getByTestId('gold-input')).toBeInTheDocument();
    });
  });

  describe('value changes', () => {
    it('calls setRuntimeValue when gold value is changed and input is blurred', () => {
      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      const clickable = screen.getByText(/Gold:/).parentElement;
      fireEvent.click(clickable);

      const input = screen.getByTestId('gold-input');
      fireEvent.change(input, { target: { value: '750' } });
      fireEvent.blur(input);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'gold',
        750,
        'test-campaign'
      );
    });

    it('clamps negative values to 0', () => {
      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      const clickable = screen.getByText(/Gold:/).parentElement;
      fireEvent.click(clickable);

      const input = screen.getByTestId('gold-input');
      fireEvent.change(input, { target: { value: '-100' } });
      fireEvent.blur(input);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'gold',
        0,
        'test-campaign'
      );
    });

    it('saves the value when Enter is pressed in the input', () => {
      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      const clickable = screen.getByText(/Gold:/).parentElement;
      fireEvent.click(clickable);

      const input = screen.getByTestId('gold-input');
      fireEvent.change(input, { target: { value: '300' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Test Character',
        'gold',
        300,
        'test-campaign'
      );
    });

    it('reflects the new value after saving', async () => {
      render(<CharGold playerStats={mockPlayerStats} campaignName={campaignName} />);

      const clickable = screen.getByText(/Gold:/).parentElement;
      fireEvent.click(clickable);

      const input = screen.getByTestId('gold-input');
      fireEvent.change(input, { target: { value: '999' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'gold',
          999,
          'test-campaign'
        );
      });
    });
  });
});
