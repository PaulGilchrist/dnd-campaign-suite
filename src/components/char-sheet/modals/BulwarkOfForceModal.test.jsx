// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BulwarkOfForceModal from './BulwarkOfForceModal.jsx';

// ── Test fixtures ──

const mockTargets = [
  { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 30 },
  { name: 'Ally2', type: 'npc', currentHp: 15, maxHp: 25 },
  { name: 'Ally3' },
];

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
  return {
    targets: mockTargets,
    maxTargets: 2,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    ...(overrides || {}),
  };
}

function selectTarget(index) {
  const labels = document.querySelectorAll('.secondary-target-row');
  fireEvent.click(labels[index]);
}

// ── Tests ──

describe('BulwarkOfForceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the modal overlay and modal container', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('renders the header with "Bulwark of Force" title and shield icon', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByText('Bulwark of Force')).toBeInTheDocument();
      expect(document.querySelector('.sp-header .fa-solid.fa-shield-halved')).toBeInTheDocument();
    });

    it('renders the description "Choose allies to grant Half Cover"', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByText('Choose allies to grant Half Cover')).toBeInTheDocument();
    });

    it('renders the confirm button with "Grant Half Cover" label and shield icon', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      const confirmBtn = screen.getByRole('button', { name: /Grant Half Cover/ });
      expect(confirmBtn).toHaveClass('sp-roll-btn');
      expect(confirmBtn.querySelector('.fa-solid.fa-shield-halved')).toBeInTheDocument();
    });

    it('renders the Skip button', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Skip' })).toHaveClass('sp-dismiss-btn');
    });

    it('renders all target entries from the targets prop', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByText('Ally1')).toBeInTheDocument();
      expect(screen.getByText('Ally2')).toBeInTheDocument();
      expect(screen.getByText('Ally3')).toBeInTheDocument();
    });

    it('renders checkboxes for each target', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      expect(checkboxes).toHaveLength(3);
    });

    it('shows HP percentage for non-player targets', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByText(/60% HP/)).toBeInTheDocument();
    });

    it('does not show HP percentage for player-type targets', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      const ally1Row = [...document.querySelectorAll('.secondary-target-row')].find(
        row => row.textContent.includes('Ally1')
      );
      expect(ally1Row.textContent).not.toContain('% HP');
    });
  });

  // ── Props passthrough ──

  describe('props passthrough', () => {
    it('passes targets to the underlying CreatureSelectionModal', () => {
      const customTargets = [{ name: 'CustomAlly' }];
      render(<BulwarkOfForceModal {...makeProps({ targets: customTargets })} />);
      expect(screen.getByText('CustomAlly')).toBeInTheDocument();
    });

    it('passes maxTargets to the underlying CreatureSelectionModal', async () => {
      render(<BulwarkOfForceModal {...makeProps({ maxTargets: 1 })} />);
      await act(async () => selectTarget(0));
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[1].disabled).toBe(true);
      expect(checkboxes[2].disabled).toBe(true);
    });

    it('passes onConfirm to the underlying CreatureSelectionModal', async () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      fireEvent.click(screen.getByRole('button', { name: /Grant Half Cover/ }));
      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith(['Ally1']);
      });
    });

    it('passes onSkip to the underlying CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('passes empty targets array to render "No creatures available" message', () => {
      render(<BulwarkOfForceModal {...makeProps({ targets: [] })} />);
      expect(screen.getByText('No creatures available.')).toBeInTheDocument();
    });
  });

  // ── Selection behavior ──

  describe('selection behavior', () => {
    it('toggles a target selection on label click', async () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      await waitFor(() => {
        expect(checkboxes[0].checked).toBe(true);
      });
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(checkboxes[0].checked).toBe(false);
      });
    });

    it('respects maxTargets limit when selecting', async () => {
      render(<BulwarkOfForceModal {...makeProps({ maxTargets: 2 })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      await waitFor(() => {
        expect(checkboxes[0].checked).toBe(true);
        expect(checkboxes[1].checked).toBe(true);
      });
      // Third checkbox should be disabled
      await waitFor(() => {
        expect(checkboxes[2].disabled).toBe(true);
      });
    });

    it('deselects a target when clicked again', async () => {
      render(<BulwarkOfForceModal {...makeProps({ maxTargets: 2 })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await act(async () => selectTarget(0));
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      await waitFor(() => {
        expect(checkboxes[0].checked).toBe(false);
        expect(checkboxes[1].checked).toBe(true);
      });
      // Third checkbox should now be enabled since we have room
      await waitFor(() => {
        expect(checkboxes[2].disabled).toBe(false);
      });
    });

    it('confirms with selected targets array', async () => {
      render(<BulwarkOfForceModal {...makeProps({ maxTargets: 3 })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(2));
      fireEvent.click(screen.getByRole('button', { name: /Grant Half Cover/ }));
      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith(['Ally1', 'Ally3']);
      });
    });

    it('does not call onConfirm when no targets are selected', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Grant Half Cover/ }));
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onSkip when the Skip button is clicked', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when clicking the overlay background', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(mockOnSkip).not.toHaveBeenCalled();
    });
  });

  // ── Button disabled state ──

  describe('confirm button state', () => {
    it('is disabled when no targets are selected', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Grant Half Cover/ })).toBeDisabled();
    });

    it('is enabled when at least one target is selected', async () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Grant Half Cover/ })).not.toBeDisabled();
      });
    });

    it('shows selected count in the button label', async () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Grant Half Cover \(2\)/ })).toBeInTheDocument();
      });
    });

    it('updates the button label when selection changes', async () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Grant Half Cover \(1\)/ })).toBeInTheDocument();
      });
      await act(async () => selectTarget(1));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Grant Half Cover \(2\)/ })).toBeInTheDocument();
      });
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Grant Half Cover \(1\)/ })).toBeInTheDocument();
      });
    });
  });

  // ── Target name formats ──

  describe('target name formats', () => {
    it('renders target name when target is a string', () => {
      render(<BulwarkOfForceModal {...makeProps({ targets: ['Ally1', 'Ally2'] })} />);
      expect(screen.getByText('Ally1')).toBeInTheDocument();
      expect(screen.getByText('Ally2')).toBeInTheDocument();
    });

    it('renders target name from object with name property', () => {
      render(<BulwarkOfForceModal {...makeProps({ targets: [{ name: 'Ally1' }] })} />);
      expect(screen.getByText('Ally1')).toBeInTheDocument();
    });
  });

  // ── Empty targets ──

  describe('empty targets', () => {
    it('shows "No creatures available" when targets is empty', () => {
      render(<BulwarkOfForceModal {...makeProps({ targets: [] })} />);
      expect(screen.getByText('No creatures available.')).toBeInTheDocument();
    });

    it('disables confirm button when targets is empty', () => {
      render(<BulwarkOfForceModal {...makeProps({ targets: [] })} />);
      expect(screen.getByRole('button', { name: /Grant Half Cover/ })).toBeDisabled();
    });
  });
});
