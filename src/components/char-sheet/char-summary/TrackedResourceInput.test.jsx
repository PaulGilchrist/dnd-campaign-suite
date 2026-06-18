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
    it('renders the label with a colon suffix', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      expect(screen.getByText('Sorcery Points:')).toBeInTheDocument();
    });

    it('renders the resource key prop on the hidden input', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      expect(clickable).toHaveTextContent('Sorcery Points:');
    });

    it('displays current and max values in the clickable area', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      expect(clickable.textContent).toContain('5/10');
    });

    it('displays the correct max when useTrackedResource returns a different max', () => {
      useTrackedResource.mockReturnValue(createTrackedResource({ current: 3, max: 20 }));
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      expect(clickable.textContent).toContain('3/20');
    });

    it('renders the (cur/max) helper text with text-muted class', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const span = screen.getByText('(cur/max)');
      expect(span).toHaveClass('text-muted');
    });

    it('renders the clickable container with tabIndex for keyboard accessibility', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      expect(clickable).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('toggle behavior', () => {
    it('does not show the input when initially rendered', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      expect(document.querySelector('input')).not.toBeInTheDocument();
    });

    it('toggles the input visible when the clickable container is clicked', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      expect(document.querySelector('input')).not.toBeInTheDocument();
      fireEvent.click(clickable);
      expect(document.querySelector('input')).toBeInTheDocument();
      fireEvent.click(clickable);
      expect(document.querySelector('input')).not.toBeInTheDocument();
    });

    it('toggles the input visible when the clickable container receives a keydown event', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.keyDown(clickable);
      expect(document.querySelector('input')).toBeInTheDocument();
    });
  });

  describe('input behavior', () => {
    it('renders an input with type number when visible', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      const input = document.querySelector('input');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('renders an input with min="0" attribute', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      const input = document.querySelector('input');
      expect(input).toHaveAttribute('min', '0');
    });

    it('initializes the input with the current value from useTrackedResource', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      const input = document.querySelector('input');
      expect(input).toHaveValue(5);
    });

    it('initializes the input with the correct current value when different', () => {
      useTrackedResource.mockReturnValue(createTrackedResource({ current: 8, max: 12 }));
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      const input = document.querySelector('input');
      expect(input).toHaveValue(8);
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
      expect(mockUpdate).toHaveBeenCalledWith('7');
    });

    it('calls the update function when Enter is pressed in the input', () => {
      const mockUpdate = vi.fn();
      useTrackedResource.mockReturnValue(createTrackedResource({ update: mockUpdate }));
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      const input = document.querySelector('input');
      fireEvent.change(input, { target: { value: '4' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockUpdate).toHaveBeenCalledWith('4');
    });

    it('closes the input after committing a value via blur', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      expect(document.querySelector('input')).toBeInTheDocument();
      const input = document.querySelector('input');
      fireEvent.change(input, { target: { value: '9' } });
      fireEvent.blur(input);
      expect(document.querySelector('input')).not.toBeInTheDocument();
    });

    it('closes the input after committing a value via Enter', () => {
      render(<TrackedResourceInput {...defaultProps} />);
      const clickable = document.querySelector('.clickable');
      fireEvent.click(clickable);
      expect(document.querySelector('input')).toBeInTheDocument();
      const input = document.querySelector('input');
      fireEvent.change(input, { target: { value: '9' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(document.querySelector('input')).not.toBeInTheDocument();
    });
  });
});
