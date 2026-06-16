import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrackedResourceInput from './TrackedResourceInput.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(() => ({
    current: 0,
    max: 10,
    update: vi.fn(),
  })),
}));

import useTrackedResource from '../../../hooks/runtime/useTrackedResource.js';

describe('TrackedResourceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTrackedResource.mockReturnValue({
      current: 5,
      max: 10,
      update: vi.fn(),
    });
  });

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

  it('should render the label', () => {
    render(<TrackedResourceInput {...defaultProps} />);
    expect(screen.getByText('Sorcery Points:')).toBeInTheDocument();
  });

  it('should display current and max values', () => {
    render(<TrackedResourceInput {...defaultProps} />);
    expect(screen.getByText('(cur/max)')).toBeInTheDocument();
    const clickable = document.querySelector('.clickable');
    expect(clickable.textContent).toContain('5/10');
  });

  it('should show the text-muted class for cur/max label', () => {
    render(<TrackedResourceInput {...defaultProps} />);
    const span = document.querySelector('.text-muted');
    expect(span).toBeInTheDocument();
    expect(span.textContent).toBe('(cur/max)');
  });

  it('should have a clickable container with tabIndex', () => {
    render(<TrackedResourceInput {...defaultProps} />);
    const clickable = document.querySelector('.clickable');
    expect(clickable).toBeInTheDocument();
    expect(clickable).toHaveAttribute('tabIndex', '0');
  });

  it('should toggle input visibility when clicked', () => {
    render(<TrackedResourceInput {...defaultProps} />);
    const clickable = document.querySelector('.clickable');
    expect(document.querySelector('input')).not.toBeInTheDocument();
    fireEvent.click(clickable);
    expect(document.querySelector('input')).toBeInTheDocument();
  });

  it('should toggle input visibility when keydown is triggered', () => {
    render(<TrackedResourceInput {...defaultProps} />);
    const clickable = document.querySelector('.clickable');
    fireEvent.keyDown(clickable);
    expect(document.querySelector('input')).toBeInTheDocument();
  });

  it('should toggle input visibility back to closed when clicked again', () => {
    render(<TrackedResourceInput {...defaultProps} />);
    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);
    expect(document.querySelector('input')).toBeInTheDocument();
    fireEvent.click(clickable);
    expect(document.querySelector('input')).not.toBeInTheDocument();
  });

  it('should call the update function from useTrackedResource when value changes', () => {
    const mockUpdate = vi.fn();
    useTrackedResource.mockReturnValue({
      current: 5,
      max: 10,
      update: mockUpdate,
    });
    render(<TrackedResourceInput {...defaultProps} />);
    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);
    const input = document.querySelector('input');
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);
    expect(mockUpdate).toHaveBeenCalledWith('7');
  });

  it('should render HiddenInput with showInput true when visible', () => {
    render(<TrackedResourceInput {...defaultProps} />);
    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);
    const input = document.querySelector('input');
    expect(input).toHaveAttribute('type', 'number');
  });

  it('should use the current value from useTrackedResource', () => {
    useTrackedResource.mockReturnValue({
      current: 8,
      max: 12,
      update: vi.fn(),
    });
    render(<TrackedResourceInput {...defaultProps} />);
    const clickable = document.querySelector('.clickable');
    expect(clickable.textContent).toContain('8/12');
  });
});
