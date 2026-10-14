import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrackedResourceInput from './TrackedResourceInput.jsx';

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

import useTrackedResource from '../../../hooks/runtime/useTrackedResource.js';

describe('TrackedResourceInput', () => {
  const baseProps = {
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
    it('renders the label, value display, and is focusable', () => {
      render(<TrackedResourceInput {...baseProps} />);
      expect(screen.getByText('Sorcery Points:')).toBeInTheDocument();
      expect(screen.getByText('(cur/max)')).toBeInTheDocument();
      const clickable = screen.getByText('Sorcery Points:').closest('.clickable');
      expect(clickable.textContent).toContain('5/10');
      expect(clickable).toHaveAttribute('tabIndex', '0');
    });

    it('renders with zero current value', () => {
      useTrackedResource.mockReturnValue(createTrackedResource({ current: 0, max: 5 }));
      render(<TrackedResourceInput {...baseProps} getMax={() => 5} />);
      const clickable = screen.getByText('Sorcery Points:').closest('.clickable');
      expect(clickable.textContent).toContain('0/5');
    });
  });

  describe('toggle behavior', () => {
    it('toggles input visibility on click', () => {
      render(<TrackedResourceInput {...baseProps} />);
      const clickable = screen.getByText('Sorcery Points:').closest('.clickable');

      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();

      fireEvent.click(clickable);
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();

      fireEvent.click(clickable);
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('toggles input visibility on Enter key', () => {
      render(<TrackedResourceInput {...baseProps} />);
      const clickable = screen.getByText('Sorcery Points:').closest('.clickable');

      fireEvent.keyDown(clickable, { key: 'Enter' });
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();

      fireEvent.keyDown(clickable, { key: 'Enter' });
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });
  });

  describe('integration', () => {
    it('passes the update function from the hook for value changes', () => {
      const mockUpdate = vi.fn();
      useTrackedResource.mockReturnValue(createTrackedResource({ update: mockUpdate }));
      render(<TrackedResourceInput {...baseProps} />);

      const clickable = screen.getByText('Sorcery Points:').closest('.clickable');
      fireEvent.click(clickable);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.blur(input);

      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});
