// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RadianceOfDawnModal from './RadianceOfDawnModal.jsx';

// ── Test fixtures ──

const mockTargets = [
  { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 30 },
  { name: 'Enemy2', type: 'npc', currentHp: 10, maxHp: 25 },
  { name: 'Enemy3' },
];

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
  return {
    creatureTargets: mockTargets,
    saveType: 'Constitution',
    saveDc: 15,
    damageExpression: '8d10',
    damageType: 'Radiant',
    rangeFeet: 15,
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

describe('RadianceOfDawnModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──

  describe('initial render', () => {
    it('renders the modal overlay and modal container', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('renders the header with "Radiance of the Dawn" title and sun icon', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByText('Radiance of the Dawn')).toBeInTheDocument();
      expect(document.querySelector('.sp-header .fa-solid.fa-sun')).toBeInTheDocument();
    });

    it('renders the description with range, save type, and save DC', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByText(/Select creatures within 15 feet/)).toBeInTheDocument();
      const descEl = document.querySelector('.sp-body p');
      expect(descEl.innerHTML).toContain('<strong>Constitution</strong>');
      expect(descEl.innerHTML).toContain('DC 15');
      expect(descEl.textContent).toContain('saving throw');
    });

    it('renders the note with damage expression and damage type', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByText(/On a failed save, target takes 8d10 Radiant damage/)).toBeInTheDocument();
      expect(screen.getByText(/On a successful save, target takes half damage/)).toBeInTheDocument();
    });

    it('renders the confirm button with "Channel Divinity" label and sun icon', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      const confirmBtn = screen.getByRole('button', { name: /Channel Divinity/ });
      expect(confirmBtn).toHaveClass('sp-roll-btn');
      expect(confirmBtn.querySelector('.fa-solid.fa-sun')).toBeInTheDocument();
    });

    it('renders the Skip button', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Skip' })).toHaveClass('sp-dismiss-btn');
    });

    it('renders all target entries from the creatureTargets prop', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByText('Enemy1')).toBeInTheDocument();
      expect(screen.getByText('Enemy2')).toBeInTheDocument();
      expect(screen.getByText('Enemy3')).toBeInTheDocument();
    });

    it('renders checkboxes for each target', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      const checkboxes = document.querySelectorAll('.secondary-target-list input[type="checkbox"]');
      expect(checkboxes).toHaveLength(3);
    });

    it('renders the description as HTML via dangerouslySetInnerHTML', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      const spBody = document.querySelector('.sp-body');
      expect(spBody.querySelector('strong')).toBeInTheDocument();
    });

    it('does not show HP percentage for player-type targets', () => {
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: [{ name: 'Ally1', type: 'player' }] })} />);
      const allyRow = [...document.querySelectorAll('.secondary-target-row')].find(
        row => row.textContent.includes('Ally1')
      );
      expect(allyRow.textContent).not.toContain('% HP');
    });
  });

  // ── Props passthrough ──

  describe('props passthrough', () => {
    it('passes creatureTargets to the underlying CreatureSelectionModal', () => {
      const customTargets = [{ name: 'CustomEnemy' }];
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: customTargets })} />);
      expect(screen.getByText('CustomEnemy')).toBeInTheDocument();
    });

    it('passes onConfirm to the underlying CreatureSelectionModal', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      fireEvent.click(screen.getByRole('button', { name: /Channel Divinity/ }));
      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith(['Enemy1']);
      });
    });

    it('passes onSkip to the underlying CreatureSelectionModal', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('passes empty creatureTargets array to render "No creatures available" message', () => {
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: [] })} />);
      expect(screen.getByText('No creatures available.')).toBeInTheDocument();
    });

    it('renders description with different save type and DC', () => {
      render(<RadianceOfDawnModal {...makeProps({ saveType: 'Wisdom', saveDc: 18 })} />);
      const descEl = document.querySelector('.sp-body p');
      expect(descEl.innerHTML).toContain('<strong>Wisdom</strong>');
      expect(descEl.innerHTML).toContain('DC 18');
    });

    it('renders description with different damage expression and type', () => {
      render(<RadianceOfDawnModal {...makeProps({ damageExpression: '5d6', damageType: 'Fire' })} />);
      expect(screen.getByText(/On a failed save, target takes 5d6 Fire damage/)).toBeInTheDocument();
    });

    it('renders description with different range', () => {
      render(<RadianceOfDawnModal {...makeProps({ rangeFeet: 30 })} />);
      expect(screen.getByText(/Select creatures within 30 feet/)).toBeInTheDocument();
    });
  });

  // ── Selection behavior ──

  describe('selection behavior', () => {
    it('toggles a target selection on label click', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
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

    it('confirms with selected targets array', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(2));
      fireEvent.click(screen.getByRole('button', { name: /Channel Divinity/ }));
      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith(['Enemy1', 'Enemy3']);
      });
    });

    it('does not call onConfirm when no targets are selected', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: /Channel Divinity/ }));
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
    it('calls onSkip when the Skip button is clicked', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when clicking the overlay background', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the modal content', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(mockOnSkip).not.toHaveBeenCalled();
    });
  });

  // ── Button disabled state ──

  describe('confirm button state', () => {
    it('is disabled when no targets are selected', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Channel Divinity/ })).toBeDisabled();
    });

    it('is enabled when at least one target is selected', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Channel Divinity/ })).not.toBeDisabled();
      });
    });

    it('shows selected count in the button label', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await act(async () => selectTarget(1));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Channel Divinity \(2\)/ })).toBeInTheDocument();
      });
    });

    it('updates the button label when selection changes', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Channel Divinity \(1\)/ })).toBeInTheDocument();
      });
      await act(async () => selectTarget(1));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Channel Divinity \(2\)/ })).toBeInTheDocument();
      });
      await act(async () => selectTarget(0));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Channel Divinity \(1\)/ })).toBeInTheDocument();
      });
    });
  });

  // ── Target name formats ──

  describe('target name formats', () => {
    it('renders target name when target is a string', () => {
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: ['Enemy1', 'Enemy2'] })} />);
      expect(screen.getByText('Enemy1')).toBeInTheDocument();
      expect(screen.getByText('Enemy2')).toBeInTheDocument();
    });

    it('renders target name from object with name property', () => {
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: [{ name: 'Enemy1' }] })} />);
      expect(screen.getByText('Enemy1')).toBeInTheDocument();
    });
  });

  // ── Empty targets ──

  describe('empty targets', () => {
    it('shows "No creatures available" when creatureTargets is empty', () => {
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: [] })} />);
      expect(screen.getByText('No creatures available.')).toBeInTheDocument();
    });

    it('disables confirm button when creatureTargets is empty', () => {
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: [] })} />);
      expect(screen.getByRole('button', { name: /Channel Divinity/ })).toBeDisabled();
    });
  });
});
