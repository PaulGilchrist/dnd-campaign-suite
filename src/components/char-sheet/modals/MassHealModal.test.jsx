// @maintained-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MassHealModal from './MassHealModal.jsx';

// MassHealModal is a STANDALONE allocation modal (unlike siblings
// MassCureWoundsModal/MassHealingWordModal, which are thin CreatureSelectionModal
// adapters). Its pool-division UI — selection, allocation clamping, burst,
// distribution payload — is verified only here: CharActionModals.healing-handlers
// and .mass-healing-skips mock this component and cover the handler wiring instead.

const mockGetRuntimeValue = vi.fn();
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
}));

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
  return {
    creatureTargets: [
      { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
      { name: 'Ally2', type: 'player', currentHp: 30, maxHp: 30 },
      { name: 'Ally3', type: 'player', currentHp: 5, maxHp: 25 },
      { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 40 },
    ],
    maxTargets: 3,
    pool: 20,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    campaignName: 'test-campaign',
    combatSummary: null,
    ...(overrides || {}),
  };
}

function checkboxes() {
  return document.querySelectorAll('input[type="checkbox"]');
}

function numberInputs() {
  return document.querySelectorAll('input[type="number"]');
}

// Burst buttons appear in target order within the rows; the confirm button
// shares the .sp-roll-btn class but carries no fa-burst icon.
function burstButtons() {
  return Array.from(document.querySelectorAll('button')).filter(b => b.querySelector('i.fa-burst'));
}

async function selectTarget(index) {
  await act(async () => fireEvent.click(checkboxes()[index]));
}

async function setAllocation(index, value) {
  await act(async () => fireEvent.change(numberInputs()[index], { target: { value: String(value) } }));
}

describe('MassHealModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeValue.mockReturnValue(null);
  });

  it('renders header, default description, pool, and targets with confirm disabled', () => {
    render(<MassHealModal {...makeProps()} />);
    expect(screen.getByText('Mass Heal')).toBeInTheDocument();
    expect(document.querySelector('.fa-tree')).toBeInTheDocument();
    expect(screen.getByText(/Choose up to 3 allies to heal/)).toBeInTheDocument();
    expect(screen.getByText(/cured of blinded, deafened, and poisoned conditions/i)).toBeInTheDocument();
    expect(screen.getByText(/Pool: 20 HP/)).toBeInTheDocument();
    // Target list is sliced to maxTargets — Enemy1 (4th) is not listed.
    expect(screen.getByText('Ally1')).toBeInTheDocument();
    expect(screen.getByText('Ally3')).toBeInTheDocument();
    expect(screen.queryByText('Enemy1')).not.toBeInTheDocument();
    expect(checkboxes().length).toBe(3);
    expect(screen.getByRole('button', { name: /Heal \(0\)/ })).toBeDisabled();
  });

  it('replaces the default description with a custom one when provided', () => {
    render(<MassHealModal {...makeProps({ description: 'Custom heal description' })} />);
    expect(screen.getByText('Custom heal description')).toBeInTheDocument();
    expect(screen.queryByText(/cured of blinded/i)).not.toBeInTheDocument();
  });

  it('supports string targets and shows an empty state when maxTargets is 0', () => {
    const { unmount } = render(<MassHealModal {...makeProps({ creatureTargets: ['TargetA', 'TargetB'] })} />);
    expect(screen.getByText('TargetA')).toBeInTheDocument();
    expect(screen.getByText('TargetB')).toBeInTheDocument();
    unmount();

    render(<MassHealModal {...makeProps({ maxTargets: 0, creatureTargets: ['A', 'B'] })} />);
    expect(screen.getByText('No targets available.')).toBeInTheDocument();
    expect(checkboxes().length).toBe(0);
  });

  it('reveals an allocation control starting at 0 and enables confirm when a target is selected', async () => {
    render(<MassHealModal {...makeProps({ pool: 20 })} />);
    expect(numberInputs().length).toBe(0);

    await selectTarget(0);

    expect(checkboxes()[0].checked).toBe(true);
    expect(numberInputs()[0].value).toBe('0');
    const confirmBtn = screen.getByRole('button', { name: /Heal \(1\)/ });
    expect(confirmBtn).toBeEnabled();

    await setAllocation(0, 5);
    expect(screen.getByText(/Allocated: 5 \/ 20/)).toBeInTheDocument();
  });

  it.each([
    ['999', '10'],  // clamps to pool maximum
    ['-50', '0'],  // clamps to 0 minimum
    ['abc', '0'],  // non-numeric treated as 0
  ])('clamps typed allocation %s to %s of a 10 HP pool', async (typed, expected) => {
    render(<MassHealModal {...makeProps({ pool: 10 })} />);
    await selectTarget(0);
    await setAllocation(0, typed);

    expect(numberInputs()[0].value).toBe(expected);
    expect(screen.getByText(`Allocated: ${expected} / 10`)).toBeInTheDocument();
  });

  it('totals allocations across targets and warns about unallocated HP', async () => {
    render(<MassHealModal {...makeProps({ pool: 30 })} />);
    await selectTarget(0);
    await selectTarget(1);
    await setAllocation(0, 5);
    await setAllocation(1, 10);

    expect(screen.getByText(/Allocated: 15 \/ 30/)).toBeInTheDocument();
    expect(screen.getByText(/15 HP unallocated/)).toBeInTheDocument();
  });

  it('burst fills a target to its missing HP', async () => {
    mockGetRuntimeValue.mockImplementation((name, key) =>
      name === 'Ally1' && key === 'currentHitPoints' ? 10 :
      name === 'Ally1' && key === 'hitPoints' ? 30 : null);
    render(<MassHealModal {...makeProps({
      pool: 50,
      combatSummary: { creatures: [{ name: 'Ally1', type: 'player', currentHp: 10, maxHp: 30 }] },
    })} />);
    await selectTarget(0);
    await act(async () => fireEvent.click(burstButtons()[0]));

    // Missing = 30 - 10 = 20, well under the 50 HP pool.
    expect(numberInputs()[0].value).toBe('20');
    expect(screen.getByText(/Allocated: 20 \/ 50/)).toBeInTheDocument();
  });

  it('burst is capped by the remaining pool when other targets hold allocations', async () => {
    mockGetRuntimeValue.mockImplementation((name, key) =>
      key === 'currentHitPoints' ? (name === 'Ally1' ? 0 : 25) :
      key === 'hitPoints' ? (name === 'Ally1' ? 30 : 45) : null);
    render(<MassHealModal {...makeProps({
      pool: 50,
      maxTargets: 2,
      creatureTargets: [
        { name: 'Ally1', type: 'player', currentHp: 0, maxHp: 30 },
        { name: 'Ally2', type: 'player', currentHp: 25, maxHp: 45 },
      ],
      combatSummary: {
        creatures: [
          { name: 'Ally1', type: 'player', currentHp: 0, maxHp: 30 },
          { name: 'Ally2', type: 'player', currentHp: 25, maxHp: 45 },
        ],
      },
    })} />);
    await selectTarget(0);
    await selectTarget(1);
    await setAllocation(1, 25);

    // Ally1 missing 30, but only 50 - 25 = 25 remain in the pool.
    await act(async () => fireEvent.click(burstButtons()[0]));

    expect(numberInputs()[0].value).toBe('25');
    expect(screen.getByText(/Allocated: 50 \/ 50/)).toBeInTheDocument();
  });

  it('shows live HP for players only, preferring runtime values over combatSummary', () => {
    mockGetRuntimeValue.mockImplementation((name, key) =>
      name === 'Ally1' && key === 'currentHitPoints' ? 20 :
      name === 'Ally1' && key === 'hitPoints' ? 30 : null);
    render(<MassHealModal {...makeProps({
      maxTargets: 2,
      creatureTargets: [
        { name: 'Ally1', type: 'player', currentHp: 5, maxHp: 30 },
        { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 40 },
      ],
      combatSummary: {
        creatures: [
          { name: 'Ally1', type: 'player', currentHp: 5, maxHp: 30 },
          { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 40 },
        ],
      },
    })} />);
    // Runtime 20 wins over combatSummary 5 for the player.
    expect(screen.getByText(/20 \/ 30 HP/)).toBeInTheDocument();
    expect(screen.queryByText(/5 \/ 30 HP/)).not.toBeInTheDocument();
    // NPCs get no HP readout.
    expect(screen.queryByText(/20 \/ 40 HP/)).not.toBeInTheDocument();
  });

  it('does not skip or close when the overlay is clicked', () => {
    render(<MassHealModal {...makeProps()} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(mockOnSkip).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('blocks confirm when every selected allocation is zero', async () => {
    render(<MassHealModal {...makeProps({ pool: 30 })} />);
    await selectTarget(0);
    await selectTarget(1);

    fireEvent.click(screen.getByRole('button', { name: /Heal \(2\)/ }));
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('confirms a distribution containing only selected targets with HP allocated', async () => {
    render(<MassHealModal {...makeProps({ pool: 30 })} />);
    await selectTarget(0);
    await selectTarget(1);
    await setAllocation(1, 10); // Ally1 stays at 0

    fireEvent.click(screen.getByRole('button', { name: /Heal \(2\)/ }));

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith({ Ally2: 10 });
    });
    expect(mockOnSkip).not.toHaveBeenCalled();
  });

  it('excludes a deselected target from the confirmed distribution', async () => {
    render(<MassHealModal {...makeProps({ pool: 20 })} />);
    await selectTarget(0);
    await selectTarget(1);
    await setAllocation(0, 10);
    await setAllocation(1, 5);

    // display-truth pin: with both selected the header counts both (15).
    expect(screen.getByText(/Allocated: 15 \/ 20/)).toBeInTheDocument();

    await selectTarget(0); // deselect Ally1 (its 10 HP stays in state for re-selection)

    // Falsifiability arm: deselecting must MOVE the header — "Allocated"
    // equals exactly what handleConfirm sends (Ally2's 5), never the stale
    // 15 that summed all allocations incl. deselected (:21-era defect).
    expect(screen.getByText(/Allocated: 5 \/ 20/)).toBeInTheDocument();
    expect(screen.queryByText(/Allocated: 15 \/ 20/)).not.toBeInTheDocument();
    expect(screen.getByText(/Remaining: 15/)).toBeInTheDocument();
    expect(screen.getByText(/15 HP unallocated/)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Heal \(1\)/ })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Heal \(1\)/ }));

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledWith({ Ally2: 5 });
    });
  });

  it('re-selecting a deselected target starts from 0 — stale kept allocation never resurfaces in the header', async () => {
    render(<MassHealModal {...makeProps({ pool: 20 })} />);
    await selectTarget(0);
    await setAllocation(0, 10);
    await selectTarget(0); // deselect: header drops to 0/20 (nothing selected)
    expect(screen.getByText(/Allocated: 0 \/ 20/)).toBeInTheDocument();

    await selectTarget(0); // re-select: toggleTarget re-initializes the allocation to 0
    expect(numberInputs()[0].value).toBe('0');
    expect(screen.getByText(/Allocated: 0 \/ 20/)).toBeInTheDocument();
  });
});
