// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrackedResourceInput from './TrackedResourceInput.jsx';

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

  it('renders the label with current and max values and toggles input on click', () => {
    render(<TrackedResourceInput {...defaultProps} />);
    expect(screen.getByText('Sorcery Points:')).toBeInTheDocument();
    expect(document.querySelector('.clickable').textContent).toContain('5/10');

    const clickable = document.querySelector('.clickable');
    fireEvent.click(clickable);
    expect(document.querySelector('input')).toBeInTheDocument();

    fireEvent.click(clickable);
    expect(document.querySelector('input')).not.toBeInTheDocument();
  });
});
