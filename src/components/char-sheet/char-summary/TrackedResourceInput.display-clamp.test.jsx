// @maintained-by-ai
/**
 * Regression pins for the belt-and-braces DISPLAY clamp in TrackedResourceInput:
 * even when a producer hands the component an impossible current > max (the
 * _trackedResources branch of useTrackedResource.resolveCurrent passes through
 * UNCLAMPED — clampToMax only guards the runtime-bucket read), the sheet badge
 * must never render an inverted fraction (95/65). The clamp is render-only:
 * no write-back to the runtime store, and non-numeric values (boolean latches,
 * null-as-armed) pass through verbatim.
 *
 * Seam rationale: the runtime store is mocked but the hook runs for real, so
 * these tests travel the exact producer path the root fix leaves unclamped.
 * Hook-internal clamp behaviour → useTrackedResource.max-clamp.test.js;
 * component wiring/editing contract → TrackedResourceInput.test.jsx.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrackedResourceInput from './TrackedResourceInput.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
  addStorageChangeListener: vi.fn().mockImplementation(() => () => {}),
  hasRuntimeValue: vi.fn(),
}));

import {
  getRuntimeValue,
  setRuntimeValue,
  addStorageChangeListener,
  hasRuntimeValue,
} from '../../../hooks/runtime/useRuntimeState.js';

const RESOURCE_KEY = 'layOnHandsPool';

// Forces the _trackedResources producer path: no runtime bucket exists, so
// resolveCurrent returns playerStats._trackedResources[key].current raw.
function setup(current, getMax = () => 65) {
  hasRuntimeValue.mockReturnValue(false);
  getRuntimeValue.mockReturnValue(undefined);
  const playerStats = {
    name: 'ElderPaladin',
    _trackedResources: { [RESOURCE_KEY]: { current } },
  };
  const result = render(
    <TrackedResourceInput
      label="Lay On Hands Pool"
      resourceKey={RESOURCE_KEY}
      playerName="ElderPaladin"
      getMax={getMax}
      deps={[]}
      campaignName="test-campaign"
      playerStats={playerStats}
    />
  );
  return result;
}

// The whole row is one keyboard-focusable toggle; found via its unique label.
const getRow = () => screen.getByText('Lay On Hands Pool:').closest('.clickable');

describe('TrackedResourceInput — display clamp (never an inverted fraction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addStorageChangeListener.mockImplementation(() => () => {});
    setRuntimeValue.mockResolvedValue(undefined);
  });

  it('clamps an inverted current for display: producer 95 with derived max 65 renders 65/65', () => {
    setup(95);

    expect(getRow()).toHaveTextContent('Lay On Hands Pool: 65/65 (cur/max)');
  });

  it('passes the clamped value into the editor: opening the row shows 65, not 95', () => {
    setup(95);

    fireEvent.click(getRow());
    expect(screen.getByRole('spinbutton')).toHaveValue(65);
  });

  it('renders a sub-max current verbatim (30/65 unchanged)', () => {
    setup(30);

    expect(getRow()).toHaveTextContent('Lay On Hands Pool: 30/65 (cur/max)');

    fireEvent.click(getRow());
    expect(screen.getByRole('spinbutton')).toHaveValue(30);
  });

  it('renders a zero current verbatim (0 is a finite number, not falsy-blank)', () => {
    setup(0);

    expect(getRow()).toHaveTextContent('Lay On Hands Pool: 0/65 (cur/max)');
  });

  it('renders a boolean latch current unchanged (no coercion, no NaN, no [object Object])', () => {
    // hasInspiration-style latch. React renders boolean children as nothing,
    // so the pre-fix face is 'Label: /1'; an unguarded Math.min(true, 1) would
    // poison it to a visible '1/1'. Pin the untouched passthrough face.
    setup(true, () => 1);

    expect(getRow()).toHaveTextContent('Lay On Hands Pool: /1 (cur/max)');
    expect(getRow().textContent).not.toContain('1/1');
  });

  it('does not write the clamped value back to the runtime store on render or toggle', () => {
    setup(95);

    expect(getRow()).toHaveTextContent('65/65');
    // Open and close the editor without committing — still zero persistence.
    fireEvent.click(getRow());
    fireEvent.click(getRow());

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});
