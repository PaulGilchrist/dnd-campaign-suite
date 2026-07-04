// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrackedResourceInput from './TrackedResourceInput.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

import useTrackedResource from '../../../hooks/runtime/useTrackedResource.js';

describe('TrackedResourceInput', () => {
  const defaultProps = {
    label: 'Sorcery Points',
    resourceKey: 'sorceryPoints',
    playerName: 'Test Character',
    getMax: () => 10,
    deps: [],
    campaignName: 'test-campaign',
    playerStats: {
      name: 'Test Character',
      _trackedResources: {},
    },
  };

  const createTrackedResource = (overrides = {}) => ({
    current: 5,
    max: 10,
    update: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useTrackedResource.mockReturnValue(createTrackedResource());
  });

  describe('rendering', () => {
    it('renders the label with current and max values', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      expect(screen.getByText('Sorcery Points:')).toBeInTheDocument();
      const clickable = document.querySelector('.clickable');
      expect(clickable.textContent).toContain('5/10');
    });

    it('displays updated current and max values when useTrackedResource changes', () => {
      useTrackedResource.mockReturnValue(createTrackedResource({ current: 3, max: 20 }));
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      expect(clickable.textContent).toContain('3/20');
    });

    it('renders with zero values', () => {
      useTrackedResource.mockReturnValue(createTrackedResource({ current: 0, max: 0 }));
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      expect(clickable.textContent).toContain('0/0');
    });
  });

  describe('toggle behavior', () => {
    it('does not show the input when initially rendered', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      expect(document.querySelector('input')).not.toBeInTheDocument();
    });

    it('toggles the input visible on click', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      expect(document.querySelector('input')).toBeInTheDocument();
      fireEvent.click(clickable);
      expect(document.querySelector('input')).not.toBeInTheDocument();
    });

    it('toggles the input visible on keydown', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.keyDown(clickable);
      expect(document.querySelector('input')).toBeInTheDocument();
    });
  });

  describe('input behavior', () => {
    it('initializes the input with the current value from useTrackedResource', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      fireEvent.click(document.querySelector('.clickable'));
      expect(document.querySelector('input')).toHaveValue(5);
    });

    it('initializes the input with a different current value', () => {
      useTrackedResource.mockReturnValue(createTrackedResource({ current: 8, max: 12 }));
      render(<TrackedResourceInput {...defaultProps} />);
      fireEvent.click(document.querySelector('.clickable'));
      expect(document.querySelector('input')).toHaveValue(8);
    });

    it('calls the update function with the new value on blur', () => {
      const mockUpdate = vi.fn();
      useTrackedResource.mockReturnValue(createTrackedResource({ update: mockUpdate }));
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      const input = document.querySelector('input');
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.blur(input);
      expect(mockUpdate).toHaveBeenCalledWith(7);
    });

    it('calls the update function when Enter is pressed', () => {
      const mockUpdate = vi.fn();
      useTrackedResource.mockReturnValue(createTrackedResource({ update: mockUpdate }));
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      const input = document.querySelector('input');
      fireEvent.change(input, { target: { value: '4' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockUpdate).toHaveBeenCalledWith(4);
    });
  });
});
