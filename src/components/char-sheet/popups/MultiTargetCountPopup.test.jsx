// @cleaned-by-ai
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

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the popup overlay and modal', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
      expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('renders the header with icon and title', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(document.querySelector('h3')).toHaveTextContent('Scorching Ray');
    });

    it('renders spell name and subtitle with level and school', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(document.querySelector('.metamagic-spell-name strong')).toHaveTextContent('Scorching Ray');
      expect(screen.getByText(/— Level 2 Evocation/)).toBeInTheDocument();
    });

    it('renders the description', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(screen.getByText('Create three rays of fire.')).toBeInTheDocument();
    });

    it('renders creature targets list', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByText('Skeleton')).toBeInTheDocument();
      expect(screen.getByText('Orc')).toBeInTheDocument();
    });

    it('renders the targets counter label', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('renders confirm and cancel buttons with correct labels', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(screen.getByText('Cast Scorching Ray')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('uses default label "Cast {title}" when confirmLabel is not provided', () => {
      const props = makeProps();
      delete props.confirmLabel;
      render(<MultiTargetCountPopup {...props} />);
      expect(screen.getByText('Cast Scorching Ray')).toBeInTheDocument();
    });

    it('uses default "Cancel" label when cancelLabel is not provided', () => {
      const props = makeProps();
      delete props.cancelLabel;
      render(<MultiTargetCountPopup {...props} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  // ── Target selection display ──

  describe('target selection display', () => {
    it('shows no checkmark for unselected targets initially', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      expect(goblinEl.textContent).not.toContain('\u2713');
    });

    it('updates counter when a target is selected', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      fireEvent.click(goblinEl);
      expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
    });

    it('shows checkmark for selected target', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      fireEvent.click(goblinEl);
      expect(goblinEl.textContent).toContain('\u2713');
    });

    it('toggles target selection off when clicked again', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      fireEvent.click(goblinEl);
      expect(screen.getByText(/Targets \(1\/3\):/)).toBeInTheDocument();
      fireEvent.click(goblinEl);
      expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('shows selected target with green styling', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      fireEvent.click(goblinEl);
      expect(goblinEl).toHaveStyle({ backgroundColor: 'rgba(76, 175, 80, 0.3)' });
      expect(goblinEl).toHaveStyle({ border: '1px solid #4CAF50' });
    });

    it('shows unselected target with white styling', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      expect(goblinEl).toHaveStyle({ backgroundColor: 'rgba(255, 255, 255, 0.1)' });
    });

    it('selects multiple targets independently', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      const skeletonEl = screen.getByText('Skeleton');
      fireEvent.click(goblinEl);
      fireEvent.click(skeletonEl);
      expect(screen.getByText(/Targets \(2\/3\):/)).toBeInTheDocument();
      expect(goblinEl.textContent).toContain('\u2713');
      expect(skeletonEl.textContent).toContain('\u2713');
    });
  });

  // ── Max targets limit ──

  describe('max targets limit', () => {
    it('does not allow selecting beyond maxTargets', () => {
      render(<MultiTargetCountPopup {...makeProps({ maxTargets: 2 })} />);
      const goblinEl = screen.getByText('Goblin');
      const skeletonEl = screen.getByText('Skeleton');
      const orcEl = screen.getByText('Orc');
      fireEvent.click(goblinEl);
      fireEvent.click(skeletonEl);
      expect(screen.getByText(/Targets \(2\/2\):/)).toBeInTheDocument();
      fireEvent.click(orcEl);
      expect(screen.getByText(/Targets \(2\/2\):/)).toBeInTheDocument();
    });

    it('does not change selection when max is reached and clicking another', () => {
      render(<MultiTargetCountPopup {...makeProps({ maxTargets: 2 })} />);
      const goblinEl = screen.getByText('Goblin');
      const skeletonEl = screen.getByText('Skeleton');
      const orcEl = screen.getByText('Orc');
      fireEvent.click(goblinEl);
      fireEvent.click(skeletonEl);
      expect(goblinEl.textContent).toContain('\u2713');
      expect(skeletonEl.textContent).toContain('\u2713');
      expect(orcEl.textContent).not.toContain('\u2713');
      fireEvent.click(orcEl);
      expect(orcEl.textContent).not.toContain('\u2713');
    });

    it('allows selecting fewer than maxTargets', () => {
      render(<MultiTargetCountPopup {...makeProps({ maxTargets: 5 })} />);
      const goblinEl = screen.getByText('Goblin');
      fireEvent.click(goblinEl);
      expect(screen.getByText(/Targets \(1\/5\):/)).toBeInTheDocument();
    });
  });

  // ── Confirm button state ──

  describe('confirm button state', () => {
    it('is disabled when no targets are selected', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      expect(screen.getByText('Cast Scorching Ray')).toBeDisabled();
    });

    it('is enabled when at least one target is selected', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      fireEvent.click(goblinEl);
      expect(screen.getByText('Cast Scorching Ray')).not.toBeDisabled();
    });

    it('is disabled again when all targets are deselected', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      fireEvent.click(goblinEl);
      expect(screen.getByText('Cast Scorching Ray')).not.toBeDisabled();
      fireEvent.click(goblinEl);
      expect(screen.getByText('Cast Scorching Ray')).toBeDisabled();
    });
  });

  // ── Confirm behavior ──

  describe('confirm behavior', () => {
    it('calls onConfirm with selected targets array', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      const skeletonEl = screen.getByText('Skeleton');
      fireEvent.click(goblinEl);
      fireEvent.click(skeletonEl);
      fireEvent.click(screen.getByText('Cast Scorching Ray'));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin', 'Skeleton']);
    });

    it('calls onConfirm with single target when only one is selected', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      fireEvent.click(goblinEl);
      fireEvent.click(screen.getByText('Cast Scorching Ray'));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin']);
    });

    it('calls onConfirm with all selected targets in selection order', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const goblinEl = screen.getByText('Goblin');
      const skeletonEl = screen.getByText('Skeleton');
      const orcEl = screen.getByText('Orc');
      fireEvent.click(skeletonEl);
      fireEvent.click(orcEl);
      fireEvent.click(goblinEl);
      fireEvent.click(screen.getByText('Cast Scorching Ray'));
      expect(mockOnConfirm).toHaveBeenCalledWith(['Skeleton', 'Orc', 'Goblin']);
    });

    it('does not call onConfirm when clicked with no targets selected', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.click(screen.getByText('Cast Scorching Ray'));
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  // ── Skip behavior ──

  describe('skip behavior', () => {
    it('calls onSkip when cancel button is clicked', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when clicking the overlay background', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const overlay = document.querySelector('.popup-overlay');
      fireEvent.click(overlay);
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onSkip when clicking inside the modal content', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      const modal = document.querySelector('.popup-modal');
      fireEvent.click(modal);
      expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('calls onSkip when Escape key is pressed', () => {
      render(<MultiTargetCountPopup {...makeProps()} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });
  });

  // ── Empty creature targets ──

  describe('empty creature targets', () => {
    it('renders with no creature options when creatureTargets is empty', () => {
      render(<MultiTargetCountPopup {...makeProps({ creatureTargets: [] })} />);
      expect(screen.getByText(/Targets \(0\/3\):/)).toBeInTheDocument();
    });

    it('confirm button stays disabled when creatureTargets is empty', () => {
      render(<MultiTargetCountPopup {...makeProps({ creatureTargets: [] })} />);
      expect(screen.getByText('Cast Scorching Ray')).toBeDisabled();
    });
  });

  // ── Spell fallback ──

  describe('spell fallback', () => {
    it('shows "Spell" fallback when spell is null', () => {
      render(<MultiTargetCountPopup {...makeProps({ spell: null })} />);
      expect(document.querySelector('.metamagic-spell-name strong')).toHaveTextContent('Spell');
    });

    it('shows spell name when provided', () => {
      render(<MultiTargetCountPopup {...makeProps({ spell: { name: 'Burning Hands' } })} />);
      expect(screen.getByText('Burning Hands')).toBeInTheDocument();
    });
  });

  // ── Default level fallback ──

  describe('default level fallback', () => {
    it('uses spell level when spell has a level', () => {
      render(<MultiTargetCountPopup {...makeProps({ spell: { name: 'Fireball', level: 3 } })} />);
      expect(screen.getByText(/— Level 3/)).toBeInTheDocument();
    });

    it('uses defaultLevel when spell has no level', () => {
      render(<MultiTargetCountPopup {...makeProps({ spell: { name: 'Cantrip' }, defaultLevel: 0 })} />);
      expect(screen.getByText(/— Level 0/)).toBeInTheDocument();
    });

    it('uses defaultLevel when spell is null', () => {
      render(<MultiTargetCountPopup {...makeProps({ spell: null, defaultLevel: 1 })} />);
      expect(screen.getByText(/— Level 1/)).toBeInTheDocument();
    });
  });
});
