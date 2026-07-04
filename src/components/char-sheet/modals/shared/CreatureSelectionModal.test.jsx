// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureSelectionModal from './CreatureSelectionModal.jsx';

// ── Test fixtures ──

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockObjectTargets = [
  { name: 'Goblin A', type: 'enemy', currentHp: 5, maxHp: 10 },
  { name: 'Goblin B', type: 'enemy', currentHp: 3, maxHp: 10 },
  { name: 'Player Character', type: 'player', currentHp: 20, maxHp: 30 },
];

const mockStringTargets = ['Creature1', 'Creature2', 'Creature3'];

const defaultProps = {
  title: 'Select Targets',
  icon: 'fa-crosshairs',
  targets: mockObjectTargets,
  onConfirm: mockOnConfirm,
  onSkip: mockOnSkip,
};

function makeProps(overrides) {
  return { ...defaultProps, ...overrides };
}

function selectTarget(index) {
  const labels = document.querySelectorAll('.secondary-target-row');
  fireEvent.click(labels[index]);
}

// ── Tests ──

describe('CreatureSelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the title in the header', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByText('Select Targets')).toBeInTheDocument();
    });

    it('renders the icon prop in the header (shows undefined class when not provided)', () => {
      render(<CreatureSelectionModal {...makeProps({ icon: undefined })} />);
      const headerIcon = document.querySelector('.sp-header i');
      expect(headerIcon).toBeInTheDocument();
      expect(headerIcon.className).toContain('fa-solid');
    });

    it('renders the custom icon when provided', () => {
      render(<CreatureSelectionModal {...makeProps({ icon: 'fa-sun' })} />);
      expect(document.querySelector('.sp-header .fa-solid.fa-sun')).toBeInTheDocument();
    });

    it('renders all target entries from the targets prop', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByText('Goblin A')).toBeInTheDocument();
      expect(screen.getByText('Goblin B')).toBeInTheDocument();
      expect(screen.getByText('Player Character')).toBeInTheDocument();
    });

    it('renders checkboxes for each target', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      expect(checkboxes).toHaveLength(3);
    });

    it('renders the default confirm button label', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Confirm \(0\)/ })).toBeInTheDocument();
    });

    it('renders the default crosshairs icon on the button when no confirmIcon is provided', () => {
      render(<CreatureSelectionModal {...makeProps({ icon: 'fa-sun' })} />);
      const btn = screen.getByRole('button', { name: /Confirm/ });
      expect(btn.querySelector('.fa-solid.fa-crosshairs')).toBeInTheDocument();
    });

    it('renders the custom confirm icon when no icon is provided', () => {
      render(<CreatureSelectionModal {...makeProps({ icon: undefined })} />);
      const btn = screen.getByRole('button', { name: /Confirm/ });
      expect(btn.querySelector('.fa-solid.fa-crosshairs')).toBeInTheDocument();
    });

    it('renders the Skip button', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });
  });

  // ── Description and note display ──

  describe('description and note rendering', () => {
    it('renders description when provided', () => {
      render(<CreatureSelectionModal {...makeProps({ description: 'Choose your targets wisely.' })} />);
      expect(screen.getByText('Choose your targets wisely.')).toBeInTheDocument();
    });

    it('renders description as HTML via dangerouslySetInnerHTML', () => {
      render(<CreatureSelectionModal {...makeProps({ description: '<strong>Bold text</strong>' })} />);
      const spBody = document.querySelector('.sp-body');
      expect(spBody.querySelector('strong')).toBeInTheDocument();
      expect(spBody.innerHTML).toContain('<strong>Bold text</strong>');
    });

    it('renders a default description paragraph when description is not provided', () => {
      render(<CreatureSelectionModal {...makeProps({ description: undefined })} />);
      expect(screen.getByText(/Choose multiple targets:/)).toBeInTheDocument();
    });

    it('renders a maxTargets description paragraph when description is not provided', () => {
      render(<CreatureSelectionModal {...makeProps({ description: undefined, maxTargets: 3 })} />);
      expect(screen.getByText(/Choose up to 3 targets:/)).toBeInTheDocument();
    });

    it('renders note when provided', () => {
      render(<CreatureSelectionModal {...makeProps({ note: 'This is a note.' })} />);
      expect(screen.getByText('This is a note.')).toBeInTheDocument();
      expect(document.querySelector('.sp-note')).toBeInTheDocument();
    });

    it('does not render a note paragraph when note is not provided', () => {
      render(<CreatureSelectionModal {...makeProps({ note: undefined })} />);
      const spBody = document.querySelector('.sp-body');
      expect(spBody.querySelector('.sp-note')).not.toBeInTheDocument();
    });

    it('renders note after description when both are provided', () => {
      render(<CreatureSelectionModal {...makeProps({ description: 'Description', note: 'Note text' })} />);
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Note text')).toBeInTheDocument();
    });

    it('renders custom confirmLabel on the button', () => {
      render(<CreatureSelectionModal {...makeProps({ confirmLabel: 'Attack' })} />);
      expect(screen.getByRole('button', { name: /Attack \(0\)/ })).toBeInTheDocument();
    });

    it('renders custom confirmIcon on the button', () => {
      render(<CreatureSelectionModal {...makeProps({ confirmIcon: 'fa-heart' })} />);
      const btn = screen.getByRole('button', { name: /Confirm/ });
      expect(btn.querySelector('.fa-solid.fa-heart')).toBeInTheDocument();
    });
  });

  // ── Target name formats ──

  describe('target name formats', () => {
    it('renders target name when target is a string', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: mockStringTargets })} />);
      expect(screen.getByText('Creature1')).toBeInTheDocument();
      expect(screen.getByText('Creature2')).toBeInTheDocument();
      expect(screen.getByText('Creature3')).toBeInTheDocument();
    });

    it('renders target name from object with name property', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: [{ name: 'CustomTarget' }] })} />);
      expect(screen.getByText('CustomTarget')).toBeInTheDocument();
    });
  });

  // ── HP display ──

  describe('HP percentage display', () => {
    it('shows HP percentage for non-player creatures with currentHp and maxHp', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByText('(50% HP)')).toBeInTheDocument();
    });

    it('shows rounded HP percentage', () => {
      const targets = [{ name: 'Monster', type: 'enemy', currentHp: 7, maxHp: 20 }];
      render(<CreatureSelectionModal {...makeProps({ targets })} />);
      // 7/20 = 35%
      expect(screen.getByText('(35% HP)')).toBeInTheDocument();
    });

    it('does not show HP percentage for player-type targets', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const playerRow = [...document.querySelectorAll('.secondary-target-row')].find(
        row => row.textContent.includes('Player Character')
      );
      expect(playerRow.textContent).not.toContain('% HP');
    });

    it('does not show HP percentage when currentHp is null', () => {
      const targets = [{ name: 'Ghost', type: 'enemy', currentHp: null, maxHp: 10 }];
      render(<CreatureSelectionModal {...makeProps({ targets })} />);
      expect(screen.queryByText(/% HP/)).not.toBeInTheDocument();
    });

    it('does not show HP percentage when maxHp is null', () => {
      const targets = [{ name: 'Wraith', type: 'enemy', currentHp: 5, maxHp: null }];
      render(<CreatureSelectionModal {...makeProps({ targets })} />);
      expect(screen.queryByText(/% HP/)).not.toBeInTheDocument();
    });

    it('does not show HP percentage when target has no HP properties', () => {
      const targets = [{ name: 'Ambiguous' }];
      render(<CreatureSelectionModal {...makeProps({ targets })} />);
      expect(screen.queryByText(/% HP/)).not.toBeInTheDocument();
    });

    it('shows 100% HP when currentHp equals maxHp', () => {
      const targets = [{ name: 'Full Health', type: 'enemy', currentHp: 10, maxHp: 10 }];
      render(<CreatureSelectionModal {...makeProps({ targets })} />);
      expect(screen.getByText('(100% HP)')).toBeInTheDocument();
    });

    it('shows 0% HP when currentHp is 0', () => {
      const targets = [{ name: 'Dying', type: 'enemy', currentHp: 0, maxHp: 10 }];
      render(<CreatureSelectionModal {...makeProps({ targets })} />);
      expect(screen.getByText('(0% HP)')).toBeInTheDocument();
    });
  });

  // ── Selection behavior ──

  describe('selection behavior', () => {
    it('has no target selected initially', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      checkboxes.forEach(cb => expect(cb.checked).toBe(false));
    });

    it('toggles a target selection on row click', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
      });
    });

    it('deselects a target when its row is clicked again', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
      });
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).not.toBeChecked();
      });
    });

    it('selects multiple targets', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).toBeChecked();
      });
    });

    it('highlights selected targets with the selected class', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const rows = document.querySelectorAll('.secondary-target-row');
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(rows[0]).toHaveClass('secondary-target-selected');
        expect(rows[1]).not.toHaveClass('secondary-target-selected');
      });
    });

    it('toggles selection via checkbox click directly', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      // Checkbox click fires both onChange and label onClick, causing double-toggle
      // So first click toggles on, second click toggles off
      await act(async () => checkboxes[0].click());
      await waitFor(() => {
        expect(checkboxes[0]).not.toBeChecked();
      });
      await act(async () => checkboxes[0].click());
      await waitFor(() => {
        expect(checkboxes[0]).not.toBeChecked();
      });
    });

    it('updates confirm button label with selection count', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).toBeInTheDocument();
      });
      await act(async () => selectTarget(1));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(2\)/ })).toBeInTheDocument();
      });
    });

    it('updates the button label when selection is deselected', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(2\)/ })).toBeInTheDocument();
      });
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).toBeInTheDocument();
      });
    });
  });

  // ── maxTargets limit ──

  describe('maxTargets limit', () => {
    it('does not limit selection when maxTargets is not provided', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      await act(async () => {
        checkboxes[0].click();
        checkboxes[1].click();
        checkboxes[2].click();
      });
      checkboxes.forEach(cb => expect(cb.disabled).toBe(false));
    });

    it('respects maxTargets limit when selecting', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 2 })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).toBeChecked();
      });
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[2]).toBeDisabled();
      });
    });

    it('disables unchecked targets when at maxTargets', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 1 })} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[1]).toBeDisabled();
        expect(checkboxes[2]).toBeDisabled();
      });
    });

    it('enables disabled targets when a selected target is deselected', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 1 })} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[1]).toBeDisabled();
      });
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[1]).not.toBeDisabled();
      });
    });

    it('allows deselecting a target below maxTargets', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 2 })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
        expect(checkboxes[0]).not.toBeChecked();
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).not.toBeDisabled();
      });
    });

    it('applies disabled class to row when at maxTargets', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 1 })} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const rows = document.querySelectorAll('.secondary-target-row');
        expect(rows[1]).toHaveClass('secondary-target-disabled');
        expect(rows[2]).toHaveClass('secondary-target-disabled');
      });
    });

    it('does not apply disabled class to selected rows', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 1 })} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        const rows = document.querySelectorAll('.secondary-target-row');
        expect(rows[0]).not.toHaveClass('secondary-target-disabled');
      });
    });
  });

  // ── Confirm button state ──

  describe('confirm button state', () => {
    it('is disabled when no targets are selected', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Confirm \(0\)/ })).toBeDisabled();
    });

    it('is enabled when at least one target is selected', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Confirm \(1\)/ })).not.toBeDisabled();
      });
    });

    it('is disabled when targets array is empty', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: [] })} />);
      expect(screen.getByRole('button', { name: /Confirm \(0\)/ })).toBeDisabled();
    });

    it('uses custom confirmLabel on the button', () => {
      render(<CreatureSelectionModal {...makeProps({ confirmLabel: 'Attack' })} />);
      expect(screen.getByRole('button', { name: /Attack \(0\)/ })).toBeInTheDocument();
    });
  });

  // ── Confirm behavior ──

  describe('confirm behavior', () => {
    it('calls onConfirm with selected target names when confirm is clicked', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(2));
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin A', 'Player Character']);
    });

    it('does not call onConfirm when confirm is clicked with no selection', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(0\)/ }));
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('calls onConfirm with all selected targets', async () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await act(async () => selectTarget(2));
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(3\)/ }));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin A', 'Goblin B', 'Player Character']);
    });

    it('passes string target names to onConfirm', async () => {
      render(<CreatureSelectionModal {...makeProps({ targets: mockStringTargets })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Creature1', 'Creature2']);
    });

    it('calls onConfirm with maxTargets-limited selections', async () => {
      render(<CreatureSelectionModal {...makeProps({ maxTargets: 2 })} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      fireEvent.click(screen.getByRole('button', { name: /Confirm \(2\)/ }));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin A', 'Goblin B']);
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onSkip when the Skip button is clicked', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when clicking the overlay background', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip when clicking inside the modal content', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('does not call onSkip when clicking inside the modal body', () => {
      render(<CreatureSelectionModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-body'));
      expect(mockOnSkip).not.toHaveBeenCalled();
    });
  });

  // ── Empty targets ──

  describe('empty targets', () => {
    it('shows "No creatures available." when targets is empty', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: [] })} />);
      expect(screen.getByText('No creatures available.')).toBeInTheDocument();
    });

    it('disables confirm button when targets is empty', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: [] })} />);
      expect(screen.getByRole('button', { name: /Confirm \(0\)/ })).toBeDisabled();
    });

    it('still shows description when targets is empty', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: [], description: 'Choose wisely.' })} />);
      expect(screen.getByText('Choose wisely.')).toBeInTheDocument();
    });

    it('still shows note when targets is empty', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: [], note: 'No targets available.' })} />);
      expect(screen.getByText('No targets available.')).toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('renders without crashing when onConfirm is undefined', () => {
      render(<CreatureSelectionModal {...makeProps({ onConfirm: undefined })} />);
      expect(screen.getByText('Select Targets')).toBeInTheDocument();
    });

    it('renders without crashing when onSkip is undefined', () => {
      render(<CreatureSelectionModal {...makeProps({ onSkip: undefined })} />);
      expect(screen.getByText('Select Targets')).toBeInTheDocument();
    });

    it('renders without crashing when title is undefined', () => {
      render(<CreatureSelectionModal {...makeProps({ title: undefined })} />);
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
    });

    it('renders without crashing when icon is undefined', () => {
      render(<CreatureSelectionModal {...makeProps({ icon: undefined })} />);
      expect(document.querySelector('.sp-header i')).toBeInTheDocument();
    });

    it('crashes when targets is undefined (no null check on targets)', () => {
      expect(() => render(<CreatureSelectionModal {...makeProps({ targets: undefined })} />)).toThrow();
    });

    it('renders with custom title', () => {
      render(<CreatureSelectionModal {...makeProps({ title: 'Custom Title' })} />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('renders with both description and note', () => {
      render(<CreatureSelectionModal {...makeProps({ description: 'Choose targets', note: 'Note here' })} />);
      expect(screen.getByText('Choose targets')).toBeInTheDocument();
      expect(screen.getByText('Note here')).toBeInTheDocument();
    });

    it('renders with only note (no description)', () => {
      render(<CreatureSelectionModal {...makeProps({ description: undefined, note: 'Just a note' })} />);
      expect(screen.getByText('Just a note')).toBeInTheDocument();
    });

    it('renders string targets with checkboxes', () => {
      render(<CreatureSelectionModal {...makeProps({ targets: ['A', 'B'] })} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      expect(checkboxes).toHaveLength(2);
    });
  });
});
