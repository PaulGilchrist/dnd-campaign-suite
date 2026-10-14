import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MultiTargetCountPopup from './MultiTargetCountPopup.jsx';

const mockSpell = { name: 'Scorching Ray', level: 2 };
const mockCreatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
  return {
    spell: mockSpell,
    creatureTargets: mockCreatureTargets,
    maxTargets: 3,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
    icon: 'fa-solid fa-fire',
    title: 'Scorching Ray',
    school: 'Evocation',
    defaultLevel: 2,
    description: 'Create three rays of fire.',
    confirmLabel: 'Cast Scorching Ray',
    cancelLabel: 'Cancel',
    ...(overrides || {}),
  };
}

describe('MultiTargetCountPopup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders header, spell info, description, targets list, counter, and buttons', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Scorching Ray');
      expect(screen.getByText(/— Level 2 Evocation/)).toBeInTheDocument();
      expect(screen.getByText('Create three rays of fire.')).toBeInTheDocument();
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByText('Skeleton')).toBeInTheDocument();
      expect(screen.getByText('Orc')).toBeInTheDocument();
      expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
      expect(screen.getByText('Cast Scorching Ray')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('uses default labels when confirmLabel and cancelLabel are not provided', () => {
      const props = makeProps();
      delete props.confirmLabel;
      delete props.cancelLabel;
      render(<MultiTargetCountPopup {...props} />);
      expect(screen.getByText('Cast Scorching Ray')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('target selection', () => {
    it('updates counter when a target is selected', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.click(screen.getByText('Goblin'));
      expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
    });

    it('toggles target selection off when clicked again', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinBtn = screen.getByText(/Goblin/);
      fireEvent.click(goblinBtn);
      expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
      fireEvent.click(goblinBtn);
      expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('selects multiple targets independently', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.click(screen.getByText(/Goblin/));
      fireEvent.click(screen.getByText(/Skeleton/));
      expect(screen.getByText(/Targets \(2\/3\):/)).toBeInTheDocument();
    });
  });

  describe('max targets limit', () => {
    it('does not allow selecting beyond maxTargets', () => {
      render(<MultiTargetCountPopup {...makeProps({ maxTargets: 2 })} />);
      fireEvent.click(screen.getByText(/Goblin/));
      fireEvent.click(screen.getByText(/Skeleton/));
      expect(screen.getByText(/Targets \(2\/2\):/)).toBeInTheDocument();
      fireEvent.click(screen.getByText(/Orc/));
      expect(screen.getByText(/Targets \(2\/2\):/)).toBeInTheDocument();
    });

    it('allows selecting fewer than maxTargets', () => {
      render(<MultiTargetCountPopup {...makeProps({ maxTargets: 5 })} />);
      fireEvent.click(screen.getByText('Goblin'));
      expect(screen.getByText(/Targets \(1\/5\):/)).toBeInTheDocument();
    });

    it('does not allow selecting any target when maxTargets is 0', () => {
      render(<MultiTargetCountPopup {...makeProps({ maxTargets: 0 })} />);
      fireEvent.click(screen.getByText('Goblin'));
      expect(screen.getByText(/Targets \(0\/0\):/)).toBeInTheDocument();
    });
  });

  describe('confirm button state', () => {
    it('is disabled when no targets are selected, enabled when one is selected, and disabled again when deselected', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(screen.getByText('Cast Scorching Ray')).toBeDisabled();
      const goblinBtn = screen.getByText(/Goblin/);
      fireEvent.click(goblinBtn);
      expect(screen.getByText('Cast Scorching Ray')).not.toBeDisabled();
      fireEvent.click(goblinBtn);
      expect(screen.getByText('Cast Scorching Ray')).toBeDisabled();
    });
  });

  describe('confirm behavior', () => {
    it('calls onConfirm with selected targets in selection order', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.click(screen.getByText('Goblin'));
      fireEvent.click(screen.getByText('Skeleton'));
      fireEvent.click(screen.getByText('Cast Scorching Ray'));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin', 'Skeleton']);
    });

    it('calls onConfirm with all selected targets in non-sequential order', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.click(screen.getByText('Skeleton'));
      fireEvent.click(screen.getByText('Orc'));
      fireEvent.click(screen.getByText('Goblin'));
      fireEvent.click(screen.getByText('Cast Scorching Ray'));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Skeleton', 'Orc', 'Goblin']);
    });

    it('does not call onConfirm when clicked with no targets selected', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.click(screen.getByText('Cast Scorching Ray'));
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  describe('skip behavior', () => {
    it('calls onSkip when cancel button is clicked', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when Escape key is pressed', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty creature targets', () => {
    it('renders with no creature options and disabled confirm button when creatureTargets is empty', () => {
      render(<MultiTargetCountPopup {...makeProps({ creatureTargets: [] })} />);
      expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
      expect(screen.getByText('Cast Scorching Ray')).toBeDisabled();
    });
  });

  describe('spell fallback', () => {
    it('shows "Spell" fallback when spell is null', () => {
      render(<MultiTargetCountPopup {...makeProps({ spell: null })} />);
      expect(screen.getByText('Spell')).toBeInTheDocument();
    });

    it('shows spell name when provided', () => {
      render(<MultiTargetCountPopup {...makeProps({ spell: { name: 'Burning Hands' } })} />);
      expect(screen.getByText('Burning Hands')).toBeInTheDocument();
    });
  });

  describe('default level fallback', () => {
    it('uses spell level when spell has a level', () => {
      render(<MultiTargetCountPopup {...makeProps({ spell: { name: 'Fireball', level: 3 } })} />);
      expect(screen.getByText(/— Level 3/)).toBeInTheDocument();
    });

    it('uses defaultLevel when spell has no level or is null', () => {
      render(<MultiTargetCountPopup {...makeProps({ spell: { name: 'Cantrip' }, defaultLevel: 0 })} />);
      expect(screen.getByText(/— Level 0/)).toBeInTheDocument();
      render(<MultiTargetCountPopup {...makeProps({ spell: null, defaultLevel: 1 })} />);
      expect(screen.getByText(/— Level 1/)).toBeInTheDocument();
    });
  });
});
