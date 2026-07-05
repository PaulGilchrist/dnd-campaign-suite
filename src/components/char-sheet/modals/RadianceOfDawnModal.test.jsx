// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RadianceOfDawnModal from './RadianceOfDawnModal.jsx';

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
  return {
    creatureTargets: [
      { name: 'Enemy1', type: 'npc', currentHp: 20, maxHp: 30 },
      { name: 'Enemy2', type: 'npc', currentHp: 10, maxHp: 25 },
      { name: 'Enemy3' },
    ],
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

describe('RadianceOfDawnModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with the correct title, icon, and confirm label', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByText('Radiance of the Dawn')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Channel Divinity/ })).toBeInTheDocument();
    });

    it('renders the description with range, save type, and DC', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByText(/Select creatures within 15 feet/)).toBeInTheDocument();
      expect(screen.getByText(/Constitution/)).toBeInTheDocument();
      expect(screen.getByText(/DC 15/)).toBeInTheDocument();
    });

    it('renders the note with damage expression and type', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByText(/On a failed save, target takes 8d10 Radiant damage/)).toBeInTheDocument();
      expect(screen.getByText(/On a successful save, target takes half damage/)).toBeInTheDocument();
    });

    it('renders targets from creatureTargets prop', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByText('Enemy1')).toBeInTheDocument();
      expect(screen.getByText('Enemy2')).toBeInTheDocument();
      expect(screen.getByText('Enemy3')).toBeInTheDocument();
    });

    it('renders targets when they are strings', () => {
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: ['Enemy1', 'Enemy2'] })} />);
      expect(screen.getByText('Enemy1')).toBeInTheDocument();
      expect(screen.getByText('Enemy2')).toBeInTheDocument();
    });

    it('shows "No creatures available" when creatureTargets is empty', () => {
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: [] })} />);
      expect(screen.getByText('No creatures available.')).toBeInTheDocument();
    });

    it('disables confirm button when no targets are selected', () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: /Channel Divinity/ })).toBeDisabled();
    });
  });

  describe('props passthrough', () => {
    it('passes creatureTargets to render targets', () => {
      render(<RadianceOfDawnModal {...makeProps({ creatureTargets: [{ name: 'CustomEnemy' }] })} />);
      expect(screen.getByText('CustomEnemy')).toBeInTheDocument();
    });

    it('calls onConfirm with selected target names', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      const labels = document.querySelectorAll('.secondary-target-row');
      await act(async () => fireEvent.click(labels[0]));
      fireEvent.click(screen.getByRole('button', { name: /Channel Divinity/ }));
      await waitFor(() => {
        expect(mockOnConfirm).toHaveBeenCalledWith(['Enemy1']);
      });
    });

    it('calls onConfirm with multiple selected targets', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      const labels = document.querySelectorAll('.secondary-target-row');
      await act(async () => fireEvent.click(labels[0]));
      await act(async () => fireEvent.click(labels[2]));
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

    it('renders with different save type and DC', () => {
      render(<RadianceOfDawnModal {...makeProps({ saveType: 'Wisdom', saveDc: 18 })} />);
      expect(screen.getByText(/Wisdom/)).toBeInTheDocument();
      expect(screen.getByText(/DC 18/)).toBeInTheDocument();
    });

    it('renders with different damage expression and type', () => {
      render(<RadianceOfDawnModal {...makeProps({ damageExpression: '5d6', damageType: 'Fire' })} />);
      expect(screen.getByText(/On a failed save, target takes 5d6 Fire damage/)).toBeInTheDocument();
    });

    it('renders with different range', () => {
      render(<RadianceOfDawnModal {...makeProps({ rangeFeet: 30 })} />);
      expect(screen.getByText(/Select creatures within 30 feet/)).toBeInTheDocument();
    });

    it('shows selected count in the button label', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      const labels = document.querySelectorAll('.secondary-target-row');
      await act(async () => fireEvent.click(labels[0]));
      await act(async () => fireEvent.click(labels[1]));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Channel Divinity \(2\)/ })).toBeInTheDocument();
      });
    });

    it('updates the button label when selection changes', async () => {
      render(<RadianceOfDawnModal {...makeProps()} />);
      const labels = document.querySelectorAll('.secondary-target-row');
      await act(async () => fireEvent.click(labels[0]));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Channel Divinity \(1\)/ })).toBeInTheDocument();
      });
      await act(async () => fireEvent.click(labels[1]));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Channel Divinity \(2\)/ })).toBeInTheDocument();
      });
      await act(async () => fireEvent.click(labels[0]));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Channel Divinity \(1\)/ })).toBeInTheDocument();
      });
    });
  });
});
