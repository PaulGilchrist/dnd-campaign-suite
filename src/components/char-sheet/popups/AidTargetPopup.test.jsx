// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MultiTargetCountPopup from './MultiTargetCountPopup.jsx';

// ── Test fixtures ──

const mockSpell = { name: 'Aid', level: 2 };
const mockRange = '30 ft';
const mockMaxTargets = 3;
const mockCreatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
    return {
        spell: mockSpell,
        _playerStats: { name: 'Throg' },
        _campaignName: 'test-campaign',
        range: mockRange,
        _rangeFt: 30,
        creatureTargets: mockCreatureTargets,
        maxTargets: mockMaxTargets,
        _attackerPos: { x: 0, y: 0 },
        onConfirm: mockOnConfirm,
        onSkip: mockOnSkip,
        icon: 'fa-solid fa-shield-halved',
        title: 'Aid',
        school: 'Abjuration',
        defaultLevel: 2,
        description: `Choose up to ${mockMaxTargets} creatures within ${mockRange}. Each target's hit point maximum and current hit points increase by 5 for the duration.`,
        confirmLabel: 'Cast Aid',
        ...(overrides || {}),
    };
}

// ── Tests ──

describe('MultiTargetCountPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Initial render ──

    it('renders the popup with spell info and creature targets', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        const headers = screen.getAllByText('Aid');
        expect(headers.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Level 2/)).toBeInTheDocument();
        expect(screen.getByText(/Abjuration/)).toBeInTheDocument();
        expect(screen.getByText(/30 ft/)).toBeInTheDocument();
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Skeleton')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
        expect(screen.getByText('Cast Aid')).toBeInTheDocument();
        expect(screen.getByText('Targets (0/3):')).toBeInTheDocument();
    });

    it('renders the popup header with shield icon', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        const header = document.querySelector('h3');
        expect(header).toHaveTextContent('Aid');
        const icon = document.querySelector('.fa-solid.fa-shield-halved');
        expect(icon).toBeInTheDocument();
    });

    // ── Spell prop edge cases ──

    it('renders with fallback when spell prop is null', () => {
        render(<MultiTargetCountPopup {...makeProps({ spell: null })} />);
        expect(screen.getByRole('heading', { name: 'Aid' })).toBeInTheDocument();
    });

    it('shows "Spell" fallback when spell has no name', () => {
        render(<MultiTargetCountPopup {...makeProps({ spell: {} })} />);
        const spellNameEl = document.querySelector('.metamagic-spell-name strong');
        expect(spellNameEl.textContent).toBe('Spell');
    });

    it('shows default level 2 when spell has no level', () => {
        render(<MultiTargetCountPopup {...makeProps({ spell: { name: 'Test' } })} />);
        expect(screen.getByText(/Level 2/)).toBeInTheDocument();
    });

    // ── Creature targets list ──

    it('renders an empty target list when creatureTargets is empty', () => {
        render(<MultiTargetCountPopup {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText('Targets (0/3):')).toBeInTheDocument();
        expect(screen.queryByText('Goblin')).not.toBeInTheDocument();
    });

    it('respects custom maxTargets value in the label', () => {
        render(<MultiTargetCountPopup {...makeProps({ maxTargets: 5 })} />);
        expect(screen.getByText('Targets (0/5):')).toBeInTheDocument();
    });

    // ── Target selection ──

    it('selects a target on click and shows checkmark prefix', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        fireEvent.click(goblinEl);
        expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
    });

    it('toggles target off when clicking an already selected target', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        fireEvent.click(goblinEl);
        expect(screen.getByText('Targets (1/3):')).toBeInTheDocument();
        fireEvent.click(screen.getByText('✓ Goblin'));
        expect(screen.getByText('Targets (0/3):')).toBeInTheDocument();
    });

    it('selects multiple targets up to maxTargets', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Skeleton'));
        fireEvent.click(screen.getByText('Orc'));
        expect(screen.getByText('Targets (3/3):')).toBeInTheDocument();
    });

    it('does not select beyond maxTargets', () => {
        render(<MultiTargetCountPopup {...makeProps({ creatureTargets: ['Goblin', 'Skeleton', 'Orc', 'Zombie'] })} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Skeleton'));
        fireEvent.click(screen.getByText('Orc'));
        expect(screen.getByText('Targets (3/3):')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Zombie'));
        expect(screen.getByText('Targets (3/3):')).toBeInTheDocument();
    });

    it('selects targets in click order for the confirm callback', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Skeleton'));
        fireEvent.click(screen.getByText('Cast Aid'));
        expect(mockOnConfirm).toHaveBeenCalledWith(['Orc', 'Goblin', 'Skeleton']);
    });

    it('allows deselecting and reselecting a target', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        fireEvent.click(goblinEl);
        expect(screen.getByText('Targets (1/3):')).toBeInTheDocument();
        fireEvent.click(goblinEl);
        expect(screen.getByText('Targets (0/3):')).toBeInTheDocument();
        fireEvent.click(goblinEl);
        expect(screen.getByText('Targets (1/3):')).toBeInTheDocument();
    });

    // ── Action buttons ──

    it('disables "Cast Aid" button when no targets selected', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        expect(screen.getByText('Cast Aid')).toBeDisabled();
    });

    it('enables "Cast Aid" button when at least one target is selected', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText('Cast Aid')).not.toBeDisabled();
    });

    it('disables "Cast Aid" button when maxTargets reached with custom max', () => {
        render(<MultiTargetCountPopup {...makeProps({ maxTargets: 5 })} />);
        expect(screen.getByText('Cast Aid')).toBeDisabled();
    });

    it('enables "Cast Aid" button when custom maxTargets is reached', () => {
        render(<MultiTargetCountPopup {...makeProps({ maxTargets: 2 })} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Skeleton'));
        expect(screen.getByText('Cast Aid')).not.toBeDisabled();
    });

    // ── Confirm behavior ──

    it('calls onConfirm with selected targets when confirmed', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Skeleton'));
        fireEvent.click(screen.getByText('Cast Aid'));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin', 'Skeleton']);
    });

    it('calls onConfirm with all selected targets', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Skeleton'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Cast Aid'));
        expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin', 'Skeleton', 'Orc']);
    });

    it('does not call onConfirm when confirmed without any target selected', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Cast Aid'));
        expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('confirms with maxTargets reached and extra creature unselected', () => {
        render(<MultiTargetCountPopup {...makeProps({ creatureTargets: ['Goblin', 'Skeleton', 'Orc', 'Zombie'] })} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Skeleton'));
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Cast Aid'));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin', 'Skeleton', 'Orc']);
    });

    // ── Skip behavior ──

    it('calls onSkip when "Cancel" button is clicked', () => {
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

    it('does not call onSkip when clicking on the modal inner content', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        const inner = document.querySelector('.metamagic-popup-inner');
        fireEvent.click(inner);
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard: Escape ──

    it('calls onSkip when Escape key is pressed', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for other keys', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('removes keydown listener on unmount', () => {
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
        const { unmount } = render(<MultiTargetCountPopup {...makeProps()} />);
        unmount();
        expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    // ── maxTargets edge cases ──

    it('handles maxTargets of 1', () => {
        render(<MultiTargetCountPopup {...makeProps({ maxTargets: 1 })} />);
        expect(screen.getByText('Targets (0/1):')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText('Targets (1/1):')).toBeInTheDocument();
        expect(screen.getByText('Cast Aid')).not.toBeDisabled();
        // Selecting another should be blocked
        fireEvent.click(screen.getByText('Skeleton'));
        expect(screen.getByText('Targets (1/1):')).toBeInTheDocument();
    });

    it('handles maxTargets of 0 by keeping button disabled', () => {
        render(<MultiTargetCountPopup {...makeProps({ maxTargets: 0 })} />);
        expect(screen.getByText('Targets (0/0):')).toBeInTheDocument();
        expect(screen.getByText('Cast Aid')).toBeDisabled();
        // Cannot select any targets
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText('Targets (0/0):')).toBeInTheDocument();
    });

    // ── creatureTargets edge cases ──

    it('throws when creatureTargets is undefined (no null safety in component)', () => {
        expect(() => render(<MultiTargetCountPopup {...makeProps({ creatureTargets: undefined })} />)).toThrow();
    });

    it('throws when creatureTargets is null (no null safety in component)', () => {
        expect(() => render(<MultiTargetCountPopup {...makeProps({ creatureTargets: null })} />)).toThrow();
    });

    // ── Combined selection and confirm ──

    it('confirms with a single target', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Orc'));
        fireEvent.click(screen.getByText('Cast Aid'));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith(['Orc']);
    });

    it('skips after selecting some targets', () => {
        render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        fireEvent.click(screen.getByText('Skeleton'));
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('resets selection state on unmount and re-render', () => {
        const { unmount } = render(<MultiTargetCountPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Goblin'));
        expect(screen.getByText('Targets (1/3):')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
        unmount();
        // A fresh render with same props starts with no selections
        render(<MultiTargetCountPopup {...makeProps()} />);
        expect(screen.getByText('Targets (0/3):')).toBeInTheDocument();
    });
});
