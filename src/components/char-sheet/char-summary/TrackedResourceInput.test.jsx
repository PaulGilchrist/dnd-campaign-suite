// @improved-by-ai
/**
 * TrackedResourceInput is a thin seam: it wires props into useTrackedResource,
 * displays "Label: current/max", and toggles an inline editor via click/Enter.
 *
 * Seam rationale (no duplicate coverage elsewhere):
 *  - useTrackedResource's own state/runtime behavior → useTrackedResource.test.js
 *  - HiddenInput clamping/commit/event-containment  → HiddenInput.test.jsx
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
  render(<TrackedResourceInput {...props} />);
  return { update, props };
}

// The whole row is one keyboard-focusable toggle; found via its unique label.
const getRow = () => screen.getByText('Sorcery Points:').closest('.clickable');

describe('TrackedResourceInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('display', () => {
    it('shows "Label: current/max" with the cur/max legend from the hook', () => {
      setup();

      expect(getRow()).toHaveTextContent('Sorcery Points: 5/10 (cur/max)');
    });

    it('shows a zero current value as "0/max", not blank', () => {
      setup({ current: 0, max: 5 });

      expect(getRow()).toHaveTextContent('Sorcery Points: 0/5 (cur/max)');
    });

    it('is keyboard focusable so Enter can open the editor', () => {
      setup();

      expect(getRow()).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('hook wiring', () => {
    it('requests the resource under resourceKey for this character, passing getMax through', () => {
      const getMax = () => 12;
      const props = { ...baseProps, getMax };
      setup({ current: 3, max: 12 }, props);

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
  });

  describe('editing toggles', () => {
    it('opens the editor on click and closes it on a second click without touching the resource', () => {
      const { update } = setup();
      const row = getRow();

      fireEvent.click(row);
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();

      fireEvent.click(row);
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
    });

    it('opens the editor on Enter and closes it on a second Enter', () => {
      const { update } = setup();
      const row = getRow();

      fireEvent.keyDown(row, { key: 'Enter' });
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();

      fireEvent.keyDown(row, { key: 'Enter' });
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('committing a value', () => {
    it('passes a typed value to the hook once on blur and closes the editor', () => {
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
});
