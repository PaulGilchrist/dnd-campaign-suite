// @maintained-by-ai 2026-11-27
// Versatile Trickster lane only — base selection/apply payload/result and
// Stalker's Flurry flows live in AttackRiderModal.test.jsx (its lines 165-176
// already pin the applyRiderOption dispatch shape, so this lane never
// restates it); handler internals live in
// services/automation/handlers/class-fighter-rogue/versatileTricksterHandler.test.js.
// Unlike the base file's parity VT mock, the dynamic import here IS reached —
// the full-flow test drives applyVersatileTrickster through the real
// component path and pins its forwarding.
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
  // SecondaryTargetModal (real, mounted via the VT flow) imports this name —
  // complete factory (LiveHpTargetRow only, never mounted here, but a missing
  // mock key is a link-time defect).
  useRuntimeValue: vi.fn(),
}));

// Component reaches this via `await import(...)` inside the flow — vitest
// intercepts dynamic imports; only the destructured key is required.
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
// primarySave: the threaded primary-save outcome (bug-vt-picker-header-claims-trip-after-save-success).
function mockFreshTripScan(targets, primarySave = null) {
  getRuntimeValue.mockImplementation((charName, key) => {
    if (key === 'versatileTricksterSecondaryTargets') return targets;
    if (key === 'versatileTricksterAction') return { name: 'Trip' };
    if (key === 'versatileTricksterPrimarySave') return primarySave;
    return null;
  });
}

// Full-sentence pin for the picker header: the copy embeds <b>Target</b>, so
// the sentence is broken across text nodes — match the whole <p> by its
// complete textContent (documented by-text function-matcher for split text).
function getBySplitText(fullText) {
  return screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === fullText);
}

// SecondaryTargetModal rows carry the explicit `Select <Name>` accessible
// name (no HP segment — scanned targets are name/size snapshots).
function selectRadioTarget(name) {
  fireEvent.click(screen.getByRole('radio', { name: `Select ${name}` }));
}

// Drive the chooser-open seam: pick the single option and dispatch Apply.
async function openChooser() {
  selectSingleOption('Burning Hands');
  clickApplySingle();
  await waitFor(() => {
    expect(screen.getByText('Versatile Trickster')).toBeInTheDocument();
  });
}

describe('AttackRiderModal - Versatile Trickster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations — re-baseline every stub any test
    // overrides (getRuntimeValue via mockImplementation, both handlers via
    // mockResolvedValue).
    getRuntimeValue.mockReturnValue(null);
    applyRiderOption.mockResolvedValue(defaultResult);
    applyVersatileTrickster.mockResolvedValue(null);
  });

  it('full VT flow: opens the chooser for scanned targets, forwards the persisted Trip action + picked target exactly once, shows the handler result, closes on Done', async () => {
    const onClose = vi.fn();
    applyVersatileTrickster.mockResolvedValue(vtTripResult);
    mockFreshTripScan([
      { name: 'Orc A', size: 'Medium' },
      { name: 'Orc B', size: 'Medium' },
    ]);

    render(<AttackRiderModal {...makeProps({ onClose })} />);
    await openChooser();
    expect(screen.getByRole('radio', { name: 'Select Orc A' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Select Orc B' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    selectRadioTarget('Orc A');
    fireEvent.click(screen.getByRole('button', { name: 'Trip Secondary Target' }));

    await waitFor(() => {
      // Forwards the action persisted by the scan plus the picked target —
      // VT consumes a limited use, so exactly one dispatch.
      expect(applyVersatileTrickster).toHaveBeenCalledTimes(1);
    });
    expect(applyVersatileTrickster).toHaveBeenCalledWith(
      { name: 'Trip' },
      { name: 'TestCharacter' },
      'test-campaign',
      'Orc A'
    );
    // Chooser (radios, Skip, confirm) fully replaced by the result overlay.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByText('Trip Secondary Target')).not.toBeInTheDocument();
    expect(screen.getByText('Secondary target tripped.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('CLA-376: Trip save legs return null from applyRiderOption — chooser still opens off the freshly persisted keys', async () => {
    const onClose = vi.fn();
    applyRiderOption.mockResolvedValue(null);
    mockFreshTripScan([{ name: 'Orc A', size: 'Medium' }]);

    render(<AttackRiderModal {...makeProps({ onClose })} />);
    await openChooser();
    expect(screen.getByRole('radio', { name: 'Select Orc A' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('CLA-376: a null-result apply whose VT keys were cleared closes immediately without replaying the chooser', async () => {
    const onClose = vi.fn();
    applyRiderOption.mockResolvedValue(null);

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
    await openChooser();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(applyVersatileTrickster).not.toHaveBeenCalled();
  });

  it('shows the normal result overlay, not the chooser, when the Trip scan found no secondary targets', async () => {
    const onClose = vi.fn();
    mockFreshTripScan([]);

    render(<AttackRiderModal {...makeProps({ onClose })} />);
    selectSingleOption('Burning Hands');
    clickApplySingle();

    await waitFor(() => {
      expect(screen.getByText('Effect applied successfully.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Versatile Trickster')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  // bug-vt-picker-header-claims-trip-after-save-success: the picker header must
  // not claim a trip was applied when the primary DEX save just succeeded —
  // mirror the honest 82ded5c1c result-popup copy on that face. Both branches
  // of buildVersatileTricksterDescription in one harness, unmounted between.
  it('primary-save header faces: SUCCESS claims attempted/no-trip, never applied; FAIL keeps the applied copy', async () => {
    const { unmount } = render(<AttackRiderModal {...makeProps()} />);
    mockFreshTripScan([{ name: 'Orc A', size: 'Medium' }], { success: true, saveType: 'DEX', saveDc: 15 });
    await openChooser();
    expect(getBySplitText('Trip attempted on Goblin A but Goblin A succeeded its Dexterity save (DC 15) — no trip. Versatile Trickster still lets you Trip another creature within 5 feet of the spectral hand:')).toBeInTheDocument();
    expect(screen.queryByText(/^Trip applied to/)).not.toBeInTheDocument();
    unmount();

    mockFreshTripScan([{ name: 'Orc A', size: 'Medium' }], { success: false, saveType: 'DEX', saveDc: 15 });
    render(<AttackRiderModal {...makeProps()} />);
    await openChooser();
    expect(getBySplitText('Trip applied to Goblin A. Versatile Trickster allows you to also Trip another creature within 5 feet of the spectral hand:')).toBeInTheDocument();
    expect(screen.queryByText(/no trip/)).not.toBeInTheDocument();
  });
});
