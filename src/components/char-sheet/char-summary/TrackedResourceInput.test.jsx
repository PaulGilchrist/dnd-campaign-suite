// @maintained-by-ai
/**
 * TrackedResourceInput is a thin seam: it wires props into useTrackedResource,
 * displays "Label: current/max", and toggles an inline editor via click/Enter.
 *
 * Seam rationale (no duplicate coverage elsewhere):
 *  - useTrackedResource's own state/runtime behavior → useTrackedResource.test.js
 *  - HiddenInput clamping/commit/event-containment  → HiddenInput.test.jsx
 *  - all other CharClassFeatures/CharRace tests mock this component entirely
 * So this file mocks the hook and verifies only the component's own contract:
 * what it requests from the hook and what it displays/commits back.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrackedResourceInput from './TrackedResourceInput.jsx';

vi.mock('../../../hooks/runtime/useTrackedResource.js', () => ({
  default: vi.fn(),
}));

import useTrackedResource from '../../../hooks/runtime/useTrackedResource.js';

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

// Renders with a fresh hook result + update spy per test; no shared mock state.
function setup(hookOverrides = {}, props = baseProps) {
  const update = vi.fn();
  useTrackedResource.mockReturnValue({ current: 5, max: 10, update, ...hookOverrides });
  const result = render(<TrackedResourceInput {...props} />);
  return { update, props, ...result };
}

// The whole row is one keyboard-focusable toggle; found via its unique label.
const getRow = () => screen.getByText('Sorcery Points:').closest('.clickable');

describe('TrackedResourceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays "Label: current/max (cur/max)" from the hook, keyboard-focusable, including a zero current', () => {
    const { rerender } = setup();

    expect(getRow()).toHaveTextContent('Sorcery Points: 5/10 (cur/max)');
    // tabIndex is what lets keyboard users open the editor at all
    expect(getRow()).toHaveAttribute('tabIndex', '0');

    // Zero must render as "0", not blank
    useTrackedResource.mockReturnValue({ current: 0, max: 5, update: vi.fn() });
    rerender(<TrackedResourceInput {...baseProps} />);
    expect(getRow()).toHaveTextContent('Sorcery Points: 0/5 (cur/max)');
  });

  it('requests the resource under resourceKey for this character, passing getMax through', () => {
    const getMax = () => 12;
    setup({ current: 3, max: 12 }, { ...baseProps, getMax });

    expect(useTrackedResource).toHaveBeenCalledWith({
      storageKey: 'sorceryPoints',
      playerName: 'Test Character',
      maxGetter: getMax,
      deps: [],
      campaignName: 'test-campaign',
      playerStats: baseProps.playerStats,
    });
    // Displayed max comes from the hook, keeping the shown bound in sync.
    expect(getRow()).toHaveTextContent('3/12');
  });

  it.each([
    { name: 'click', toggle: (row) => fireEvent.click(row) },
    { name: 'Enter', toggle: (row) => fireEvent.keyDown(row, { key: 'Enter' }) },
  ])('opens and closes the inline editor on $name without touching the resource', ({ toggle }) => {
    const { update } = setup();
    const row = getRow();

    toggle(row);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();

    toggle(row);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('commits a typed value to the hook once on blur and closes the editor', () => {
    const { update } = setup();

    fireEvent.click(getRow());
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(7);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
