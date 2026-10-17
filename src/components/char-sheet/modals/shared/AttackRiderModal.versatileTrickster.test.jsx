// @maintained-by-ai
// Versatile Trickster lane only — base selection/apply/result and Stalker's
// Flurry flows live in AttackRiderModal.test.jsx; handler internals live in
// services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.test.js.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AttackRiderModal from './AttackRiderModal.jsx';

vi.mock('../../../../services/automation/handlers/combat/attackRiderHandler.js', () => ({
  applyRiderOption: vi.fn(),
  // automation/index.js imports handle statically — mock full surface
  handle: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js', () => ({
  applyVersatileTrickster: vi.fn(),
}));

import { applyRiderOption } from '../../../../services/automation/handlers/combat/attackRiderHandler.js';
import { applyVersatileTrickster } from '../../../../services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.js';
import {
  makeProps,
  selectSingleOption,
  clickApplySingle,
  defaultResult,
} from './AttackRiderModal.test-utils.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

const vtTripResult = {
  type: 'popup',
  payload: { type: 'automation_info', name: 'Trip', description: 'Secondary target tripped.' },
};

// Simulate a fresh Trip cast whose secondary-target scan found `targets`
// (applyRiderOption writes these keys at entry, cleared first per CLA-376).
function mockFreshTripScan(targets) {
  getRuntimeValue.mockImplementation((charName, key) => {
    if (key === 'versatileTricksterSecondaryTargets') return targets;
    if (key === 'versatileTricksterAction') return { name: 'Trip' };
    return null;
  });
}

function selectRadioTarget(name) {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(name) }));
}

describe('AttackRiderModal - Versatile Trickster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    applyRiderOption.mockResolvedValue(defaultResult);
  });

  it('full VT flow: after applying, shows chooser for scanned targets, applies Trip to the picked target, shows the handler result, closes on Done', async () => {
    const onClose = vi.fn();
    applyVersatileTrickster.mockResolvedValue(vtTripResult);
    mockFreshTripScan([
      { name: 'Orc A', size: 'Medium' },
      { name: 'Orc B', size: 'Medium' },
    ]);

    render(<AttackRiderModal {...makeProps({ onClose })} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();

    await waitFor(() => {
      expect(screen.getByText('Versatile Trickster')).toBeInTheDocument();
    });
    expect(screen.getByRole('radio', { name: /Orc A/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Orc B/ })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    selectRadioTarget('Orc A');
    fireEvent.click(screen.getByRole('button', { name: /Trip Secondary Target/ }));

    await waitFor(() => {
      expect(applyRiderOption).toHaveBeenCalledWith(
        expect.objectContaining({ automation: expect.objectContaining({ options: expect.any(Array) }) }),
        expect.any(Object),
        'test-campaign',
        'Goblin A',
        ['Burning Hands']
      );
      // Forwards the action persisted by the scan plus the picked target.
      expect(applyVersatileTrickster).toHaveBeenCalledWith(
        { name: 'Trip' },
        expect.any(Object),
        'test-campaign',
        'Orc A'
      );
    });
    // Chooser replaced by the handler's result overlay.
    expect(screen.queryByText('Trip Secondary Target')).not.toBeInTheDocument();
    expect(screen.getByText('Secondary target tripped.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('CLA-376: Trip save legs return null from applyRiderOption — chooser still opens off the freshly persisted keys', async () => {
    const onClose = vi.fn();
    applyRiderOption.mockResolvedValue(null);
    applyVersatileTrickster.mockResolvedValue(vtTripResult);
    mockFreshTripScan([{ name: 'Orc A', size: 'Medium' }]);

    render(<AttackRiderModal {...makeProps({ onClose })} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();

    await waitFor(() => {
      expect(screen.getByText('Versatile Trickster')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Orc A/ })).toBeInTheDocument();
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('CLA-376: a null-result apply whose VT keys were cleared closes immediately without replaying the chooser', async () => {
    const onClose = vi.fn();
    applyRiderOption.mockResolvedValue(null);
    getRuntimeValue.mockReturnValue(null);

    render(<AttackRiderModal {...makeProps({ onClose })} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('Versatile Trickster')).not.toBeInTheDocument();
  });

  it('Skip closes the chooser without applying the trickster trip', async () => {
    const onClose = vi.fn();
    mockFreshTripScan([{ name: 'Orc A', size: 'Medium' }]);

    render(<AttackRiderModal {...makeProps({ onClose })} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(applyVersatileTrickster).not.toHaveBeenCalled();
  });

  it('shows the normal result overlay, not the chooser, when the Trip scan found no secondary targets', async () => {
    mockFreshTripScan([]);

    render(<AttackRiderModal {...makeProps()} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();

    await waitFor(() => {
      expect(screen.getByText('Effect applied successfully.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Versatile Trickster')).not.toBeInTheDocument();
  });
});
