// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock the child component to verify props are passed correctly
vi.mock('./shared/CreatureSelectionModal.jsx', () => ({
  default: vi.fn(({ title, icon, description, confirmLabel, confirmIcon, targets, maxTargets, onConfirm, onSkip }) => {
    return (
      <div data-testid="mocked-creature-selection">
        <span data-testid="title">{title}</span>
        <span data-testid="icon">{icon}</span>
        <span data-testid="description">{description}</span>
        <span data-testid="confirmLabel">{confirmLabel}</span>
        <span data-testid="confirmIcon">{confirmIcon}</span>
        <span data-testid="maxTargets">{maxTargets}</span>
        <span data-testid="targetCount">{targets.length}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onSkip}>Skip</button>
      </div>
    );
  }),
}));

// Re-import after mocking so we get the real component using the mock
import BulwarkOfForceModal from './BulwarkOfForceModal.jsx';

const mockTargets = [{ name: 'Ally1' }, { name: 'Ally2' }];
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

describe('BulwarkOfForceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('props passthrough', () => {
    it('passes title "Bulwark of Force" to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByTestId('title')).toHaveTextContent('Bulwark of Force');
    });

    it('passes icon "fa-shield-halved" to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByTestId('icon')).toHaveTextContent('fa-shield-halved');
    });

    it('passes description "Choose allies to grant Half Cover" to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByTestId('description')).toHaveTextContent('Choose allies to grant Half Cover');
    });

    it('passes confirmLabel "Grant Half Cover" to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByTestId('confirmLabel')).toHaveTextContent('Grant Half Cover');
    });

    it('passes confirmIcon "fa-shield-halved" to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByTestId('confirmIcon')).toHaveTextContent('fa-shield-halved');
    });

    it('passes targets prop through to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByTestId('targetCount')).toHaveTextContent('2');
    });

    it('passes maxTargets prop through to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      expect(screen.getByTestId('maxTargets')).toHaveTextContent('2');
    });

    it('passes custom targets to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps({ targets: [{ name: 'CustomAlly' }] })} />);
      expect(screen.getByTestId('targetCount')).toHaveTextContent('1');
    });

    it('passes custom maxTargets to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps({ maxTargets: 5 })} />);
      expect(screen.getByTestId('maxTargets')).toHaveTextContent('5');
    });

    it('passes onConfirm callback to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      screen.getByRole('button', { name: 'Confirm' }).click();
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    it('passes onSkip callback to CreatureSelectionModal', () => {
      render(<BulwarkOfForceModal {...makeProps()} />);
      screen.getByRole('button', { name: 'Skip' }).click();
      expect(mockOnSkip).toHaveBeenCalled();
    });
  });
});
