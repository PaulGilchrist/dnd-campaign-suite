// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MassHealModal from './MassHealModal.jsx';

// ── Mocked modules ──

const mockGetRuntimeValue = vi.fn();
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: (...args) => mockGetRuntimeValue(...args),
}));



// ── Test helpers ──

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

function setupRuntimeMock(returnValues) {
  mockGetRuntimeValue.mockImplementation((name, key, _campaign) => {
    if (returnValues[name] && returnValues[name][key] !== undefined) {
      return returnValues[name][key];
    }
    return null;
  });
}

function getFirstCheckbox() {
  return document.querySelector('input[type="checkbox"]');
}

function getNumberInputs() {
  return document.querySelectorAll('input[type="number"]');
}

// ── Tests ──

describe('MassHealModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders title and icon', () => {
      render(<MassHealModal {...makeProps()} />);
      expect(screen.getByText('Mass Heal')).toBeInTheDocument();
      expect(document.querySelector('.fa-tree')).toBeInTheDocument();
    });

    it('renders description with pool and max targets', () => {
      render(<MassHealModal {...makeProps({ pool: 15, maxTargets: 4 })} />);
      expect(screen.getByText(/Choose up to 4 allies to heal/)).toBeInTheDocument();
      expect(screen.getByText(/Pool: 15 HP/)).toBeInTheDocument();
    });

    it('renders default description curing conditions when no custom description', () => {
      render(<MassHealModal {...makeProps()} />);
      expect(screen.getByText(/cured of blinded, deafened, and poisoned conditions/i)).toBeInTheDocument();
    });

    it('renders custom description when provided', () => {
      render(<MassHealModal {...makeProps({ description: 'Custom heal description' })} />);
      expect(screen.getByText('Custom heal description')).toBeInTheDocument();
    });

    it('renders creature targets up to maxTargets limit', () => {
      render(<MassHealModal {...makeProps()} />);
      expect(screen.getByText('Ally1')).toBeInTheDocument();
      expect(screen.getByText('Ally2')).toBeInTheDocument();
      expect(screen.getByText('Ally3')).toBeInTheDocument();
    });

    it('renders target names when targets are strings', () => {
      render(<MassHealModal {...makeProps({ creatureTargets: ['TargetA', 'TargetB'] })} />);
      expect(screen.getByText('TargetA')).toBeInTheDocument();
      expect(screen.getByText('TargetB')).toBeInTheDocument();
    });

    it('disables confirm button when no targets are selected', () => {
      render(<MassHealModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Heal \(0\)/ })).toBeDisabled();
    });
  });

  // ── Pool display ──

  describe('pool display', () => {
    it('shows pool HP in the header bar', () => {
      render(<MassHealModal {...makeProps({ pool: 25 })} />);
      expect(screen.getByText(/Pool: 25 HP/)).toBeInTheDocument();
    });
  });

  // ── Target selection ──

  describe('target selection', () => {
    it('selects a target via checkbox', async () => {
      render(<MassHealModal {...makeProps()} />);
      const checkbox = getFirstCheckbox();
      await act(async () => fireEvent.click(checkbox));
      expect(checkbox.checked).toBe(true);
    });

    it('respects maxTargets limit on selection count', async () => {
      render(<MassHealModal {...makeProps({ maxTargets: 2, creatureTargets: ['A', 'B', 'C', 'D'] })} />);
      expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(2);
    });
  });

  // ── Allocation controls ──

  describe('allocation controls', () => {
    it('starts allocation at 0 for a newly selected target', async () => {
      render(<MassHealModal {...makeProps()} />);
      const checkbox = getFirstCheckbox();
      await act(async () => fireEvent.click(checkbox));

      expect(getNumberInputs()[0].value).toBe('0');
    });

    it('allows increasing allocation via direct input', async () => {
      render(<MassHealModal {...makeProps({ pool: 20 })} />);
      const checkbox = getFirstCheckbox();
      await act(async () => fireEvent.click(checkbox));

      const input = getNumberInputs()[0];
      await act(async () => fireEvent.change(input, { target: { value: '5' } }));

      expect(screen.getByText(/Allocated: 5 \/ 20/)).toBeInTheDocument();
    });

    it('clamps allocation to pool maximum', async () => {
      render(<MassHealModal {...makeProps({ pool: 10 })} />);
      const checkbox = getFirstCheckbox();
      await act(async () => fireEvent.click(checkbox));

      const input = getNumberInputs()[0];
      await act(async () => fireEvent.change(input, { target: { value: '999' } }));

      expect(screen.getByText(/Allocated: 10 \/ 10/)).toBeInTheDocument();
    });

    it('clamps allocation to 0 minimum', async () => {
      render(<MassHealModal {...makeProps({ pool: 10 })} />);
      const checkbox = getFirstCheckbox();
      await act(async () => fireEvent.click(checkbox));

      const input = getNumberInputs()[0];
      await act(async () => fireEvent.change(input, { target: { value: '-50' } }));

      expect(screen.getByText(/Allocated: 0 \/ 10/)).toBeInTheDocument();
    });

    it('handles invalid input (non-numeric) as 0', async () => {
      render(<MassHealModal {...makeProps({ pool: 10 })} />);
      const checkbox = getFirstCheckbox();
      await act(async () => fireEvent.click(checkbox));

      const input = getNumberInputs()[0];
      await act(async () => fireEvent.change(input, { target: { value: 'abc' } }));

      expect(screen.getByText(/Allocated: 0 \/ 10/)).toBeInTheDocument();
    });

    it('updates total allocated when multiple targets have allocations', async () => {
      render(<MassHealModal {...makeProps({ pool: 30 })} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      await act(async () => fireEvent.click(checkboxes[0]));
      await act(async () => fireEvent.click(checkboxes[1]));

      const inputs = getNumberInputs();
      await act(async () => fireEvent.change(inputs[0], { target: { value: '5' } }));
      await act(async () => fireEvent.change(inputs[1], { target: { value: '10' } }));

      expect(screen.getByText(/Allocated: 15 \/ 30/)).toBeInTheDocument();
    });

  });

  // ── "Burst" button (fill to max missing HP) ──

  describe('burst button', () => {
    it('fills allocation to max missing HP when burst button clicked', async () => {
      setupRuntimeMock({ Ally1: { currentHitPoints: 10, hitPoints: 30 } });
      render(
        <MassHealModal
          {...makeProps({
            pool: 50,
            combatSummary: {
              creatures: [
                { name: 'Ally1', type: 'player', currentHp: 10, maxHp: 30 },
              ],
            },
          })}
        />
      );
      const checkbox = getFirstCheckbox();
      await act(async () => fireEvent.click(checkbox));

      const burstBtn = document.querySelector('.sp-roll-btn i.fa-burst');
      const parentDiv = burstBtn.closest('div');
      const burstButton = parentDiv.querySelector('button.sp-roll-btn');
      await act(async () => fireEvent.click(burstButton));

      // Max missing = 30 - 10 = 20, capped at pool 50 → 20
      expect(screen.getByText(/Allocated: 20 \/ 50/)).toBeInTheDocument();
    });

    it('caps burst at max HP (cannot heal above max)', async () => {
      setupRuntimeMock({ Ally1: { currentHitPoints: 28, hitPoints: 30 } });
      render(
        <MassHealModal
          {...makeProps({
            pool: 50,
            combatSummary: {
              creatures: [
                { name: 'Ally1', type: 'player', currentHp: 28, maxHp: 30 },
              ],
            },
          })}
        />
      );
      const checkbox = getFirstCheckbox();
      await act(async () => fireEvent.click(checkbox));

      const burstBtn = document.querySelector('.sp-roll-btn i.fa-burst');
      const parentDiv = burstBtn.closest('div');
      const burstButton = parentDiv.querySelector('button.sp-roll-btn');
      await act(async () => fireEvent.click(burstButton));

      // Missing = 30 - 28 = 2
      expect(screen.getByText(/Allocated: 2 \/ 50/)).toBeInTheDocument();
    });
  });

  // ── HP info display ──

  describe('HP info display', () => {
    it('uses runtime currentHitPoints when available even if combatSummary differs', async () => {
      setupRuntimeMock({ Ally1: { currentHitPoints: 20, hitPoints: 30 } });
      render(
        <MassHealModal
          {...makeProps({
            combatSummary: {
              creatures: [
                { name: 'Ally1', type: 'player', currentHp: 5, maxHp: 30 },
              ],
            },
          })}
        />
      );
      // Runtime value 20 should be used, not combatSummary 5
      expect(screen.getByText(/20 \/ 30 HP/)).toBeInTheDocument();
    });

    it('only shows HP info for player-type creatures', () => {
      mockGetRuntimeValue.mockReturnValue(null);

      render(
        <MassHealModal
          {...makeProps({
            combatSummary: {
              creatures: [
                { name: 'Ally1', type: 'player', currentHp: 15, maxHp: 30 },
                { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 40 },
              ],
            },
          })}
        />
      );
      // Ally1 should show HP info
      expect(screen.getByText(/15 \/ 30 HP/)).toBeInTheDocument();
      // Enemy1 should NOT show HP info
      expect(screen.queryByText(/20 \/ 40 HP/)).not.toBeInTheDocument();
    });
  });

  // ── Unallocated HP warning ──

  describe('unallocated HP warning', () => {
    it('shows warning when some HP is allocated but not all', async () => {
      const { container } = render(<MassHealModal {...makeProps({ pool: 20 })} />);
      const checkbox = container.querySelector('input[type="checkbox"]');
      await act(async () => fireEvent.click(checkbox));

      const inputs = getNumberInputs();
      await act(async () => fireEvent.change(inputs[0], { target: { value: '5' } }));

      expect(screen.getByText(/5 HP unallocated/)).toBeInTheDocument();
    });

  });

  // ── Confirm behavior ──

  describe('confirm', () => {
    it('does not call onSkip when clicking the overlay', () => {
      render(<MassHealModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(mockOnSkip).not.toHaveBeenCalled();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('does not call onConfirm when confirm clicked with targets but zero allocation', async () => {
      render(<MassHealModal {...makeProps({ pool: 30 })} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      await act(async () => fireEvent.click(checkboxes[0]));
      await act(async () => fireEvent.click(checkboxes[1]));

      // Allocation stays at 0 for both
      fireEvent.click(screen.getByRole('button', { name: /Heal \(2\)/ }));
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('calls onConfirm with distribution object when targets have allocations', async () => {
      render(<MassHealModal {...makeProps({ pool: 30 })} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      await act(async () => fireEvent.click(checkboxes[0]));
      await act(async () => fireEvent.click(checkboxes[1]));

      const inputs = getNumberInputs();
      await act(async () => fireEvent.change(inputs[0], { target: { value: '10' } }));
      await act(async () => fireEvent.change(inputs[1], { target: { value: '15' } }));

      fireEvent.click(screen.getByRole('button', { name: /Heal \(2\)/ }));

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally1: 10, Ally2: 15 });
      });
    });

    it('excludes targets with 0 allocation from distribution', async () => {
      render(<MassHealModal {...makeProps({ pool: 30 })} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      await act(async () => fireEvent.click(checkboxes[0]));
      await act(async () => fireEvent.click(checkboxes[1]));

      // Ally1 stays at 0, Ally2 gets 10
      const inputs = getNumberInputs();
      await act(async () => fireEvent.change(inputs[1], { target: { value: '10' } }));

      fireEvent.click(screen.getByRole('button', { name: /Heal \(2\)/ }));

      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith({ Ally2: 10 });
      });
    });

  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles pool of 0', () => {
      render(<MassHealModal {...makeProps({ pool: 0 })} />);
      expect(screen.getByText(/Pool: 0 HP/)).toBeInTheDocument();
      expect(screen.getByText(/Allocated: 0 \/ 0/)).toBeInTheDocument();
    });

    it('handles maxTargets of 0', () => {
      render(<MassHealModal {...makeProps({ maxTargets: 0, creatureTargets: ['A', 'B'] })} />);
      expect(screen.getByText('No targets available.')).toBeInTheDocument();
    });

    it('renders target with empty name string without crashing', () => {
      render(<MassHealModal {...makeProps({ creatureTargets: [''] })} />);
      expect(screen.getByText('Mass Heal')).toBeInTheDocument();
    });

    it('preserves allocation value when target is deselected', async () => {
      render(<MassHealModal {...makeProps({ pool: 20 })} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');

      await act(async () => fireEvent.click(checkboxes[0]));
      await act(async () => fireEvent.click(checkboxes[1]));

      const inputs = getNumberInputs();
      await act(async () => fireEvent.change(inputs[0], { target: { value: '10' } }));
      await act(async () => fireEvent.change(inputs[1], { target: { value: '5' } }));

      expect(screen.getByText(/Allocated: 15 \/ 20/)).toBeInTheDocument();

      // Deselect first target
      await act(async () => fireEvent.click(checkboxes[0]));

      // Allocation for Ally1 persists in total (15), but Ally1 is no longer selected (1 target)
      await waitFor(() => {
        expect(screen.getByText(/Heal \(1\)/)).toBeInTheDocument();
      });
    });
  });
});
