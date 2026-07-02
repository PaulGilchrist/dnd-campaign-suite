// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CoronaEnemySelectionModal from './CoronaEnemySelectionModal.jsx';

// We test that CoronaEnemySelectionModal renders CreatureSelectionModal
// with the correct hardcoded props and passes through the callback props.

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockTargets = [
  { name: 'Goblin A', type: 'enemy', currentHp: 5, maxHp: 10 },
  { name: 'Goblin B', type: 'enemy', currentHp: 3, maxHp: 10 },
  { name: 'Player Character', type: 'player', currentHp: 20, maxHp: 30 },
];

describe('CoronaEnemySelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders the modal overlay and structure', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('renders the title "Corona of Light" in the header', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(screen.getByText('Corona of Light')).toBeInTheDocument();
    });

    it('renders the sun icon in the header', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(document.querySelector('.sp-header .fa-solid.fa-sun')).toBeInTheDocument();
    });

    it('renders the description text', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(
        screen.getByText(
          'Select which creatures are enemies of the caster. Enemies in the bright light have Disadvantage on saving throws against Fire and Radiant damage:'
        )
      ).toBeInTheDocument();
    });

    it('renders the confirm button with label "Activate Corona"', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(screen.getByRole('button', { name: 'Activate Corona (0)' })).toBeInTheDocument();
    });

    it('renders the confirm button with the sun icon', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(document.querySelector('.sp-actions .fa-solid.fa-sun')).toBeInTheDocument();
    });

    it('renders the Skip button', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });

    it('renders all creature targets in the list', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(screen.getByText('Goblin A')).toBeInTheDocument();
      expect(screen.getByText('Goblin B')).toBeInTheDocument();
      expect(screen.getByText('Player Character')).toBeInTheDocument();
    });

    it('disables the confirm button when no targets are selected', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(screen.getByRole('button', { name: 'Activate Corona (0)' })).toBeDisabled();
    });

    it('renders checkboxes for each target', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes).toHaveLength(3);
    });

    it('shows HP percentage for non-player creatures', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      // Goblin A: 5/10 = 50%
      expect(screen.getByText('(50% HP)')).toBeInTheDocument();
    });

    it('does not show HP percentage for player creatures', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      const playerLabel = document.querySelector('.secondary-target-row:last-child .secondary-target-name');
      expect(playerLabel.textContent).not.toContain('%');
    });

    it('renders targets as string entries', () => {
      const stringTargets = ['Creature1', 'Creature2'];
      render(
        <CoronaEnemySelectionModal
          creatureTargets={stringTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(screen.getByText('Creature1')).toBeInTheDocument();
      expect(screen.getByText('Creature2')).toBeInTheDocument();
    });

    it('shows "No creatures available." when targets is empty', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={[]}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      expect(screen.getByText('No creatures available.')).toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('does not call onSkip when clicking inside the modal body', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      const body = document.querySelector('.sp-body');
      fireEvent.click(body);
      expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('calls onSkip when the Skip button is clicked', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      const skipBtn = screen.getByRole('button', { name: 'Skip' });
      fireEvent.click(skipBtn);
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });
  });

  describe('selection and confirmation', () => {
    it('calls onConfirm with selected target names when confirm is clicked', async () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      // Click the labels (not the checkboxes directly) to avoid double-toggle from label+input
      const rows = document.querySelectorAll('.secondary-target-row');
      await act(async () => {
        rows[0].click();
        rows[1].click();
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Activate Corona \(2\)/ })).toBeInTheDocument();
      });
      await act(async () => {
        screen.getByRole('button', { name: /Activate Corona \(2\)/ }).click();
      });
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin A', 'Goblin B']);
    });

    it('does not call onConfirm when confirm is clicked with no selection', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      screen.getByRole('button', { name: 'Activate Corona (0)' }).click();
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('selects a target when its row is clicked', async () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      const rows = document.querySelectorAll('.secondary-target-row');
      await act(async () => {
        rows[0].click();
      });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
      });
    });

    it('deselects a target when its row is clicked again', async () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      const rows = document.querySelectorAll('.secondary-target-row');
      await act(async () => {
        rows[0].click();
      });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
      });
      await act(async () => {
        rows[0].click();
      });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes[0]).not.toBeChecked();
      });
    });

    it('updates confirm button label with selection count', async () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      const rows = document.querySelectorAll('.secondary-target-row');
      await act(async () => {
        rows[0].click();
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Activate Corona (1)' })).toBeInTheDocument();
      });
      await act(async () => {
        rows[1].click();
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Activate Corona (2)' })).toBeInTheDocument();
      });
    });

    it('highlights selected targets with the selected class', async () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      const rows = document.querySelectorAll('.secondary-target-row');
      await act(async () => {
        rows[0].click();
      });
      await waitFor(() => {
        expect(rows[0]).toHaveClass('secondary-target-selected');
        expect(rows[1]).not.toHaveClass('secondary-target-selected');
      });
    });
  });

  describe('maxTargets limit', () => {
    it('does not limit selection when maxTargets is not provided', async () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={mockOnSkip}
        />
      );
      // No maxTargets prop is passed, so all should be selectable
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      await act(async () => {
        checkboxes[0].click();
        checkboxes[1].click();
        checkboxes[2].click();
      });
      // All should still be enabled since no maxTargets
      checkboxes.forEach(cb => expect(cb.disabled).toBe(false));
    });
  });

  describe('edge cases', () => {
    it('renders without crashing when onConfirm is undefined', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={undefined}
          onSkip={mockOnSkip}
        />
      );
      expect(screen.getByText('Corona of Light')).toBeInTheDocument();
    });

    it('renders without crashing when onSkip is undefined', () => {
      render(
        <CoronaEnemySelectionModal
          creatureTargets={mockTargets}
          onConfirm={mockOnConfirm}
          onSkip={undefined}
        />
      );
      expect(screen.getByText('Corona of Light')).toBeInTheDocument();
    });
  });
});
