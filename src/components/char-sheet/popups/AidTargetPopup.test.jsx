import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AidTargetPopup from './AidTargetPopup.jsx';

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
        ...(overrides || {}),
    };
}

// ── Tests ──

describe('AidTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Initial render ──

    it('renders the popup overlay and modal', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
        expect(document.querySelector('.popup-modal')).toBeInTheDocument();
    });

    it('renders the metamagic-popup class on the modal', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup')).toBeInTheDocument();
    });

    it('renders the popup-inner wrapper', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-popup-inner')).toBeInTheDocument();
    });

    it('renders the "Aid" header with shield-halved icon', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const header = document.querySelector('h3');
        expect(header).toHaveTextContent('Aid');
        const icon = document.querySelector('.fa-solid.fa-shield-halved');
        expect(icon).toBeInTheDocument();
    });

    it('displays the spell name in the spell-name line', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const spellName = document.querySelector('.metamagic-spell-name strong');
        expect(spellName).toHaveTextContent('Aid');
    });

    it('displays the spell level in the spell-name line', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(screen.getByText(/Level 2/)).toBeInTheDocument();
    });

    it('displays the spell as Abjuration school', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(screen.getByText(/Abjuration/)).toBeInTheDocument();
    });

    it('displays the range in the instruction text', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(screen.getByText(/30 ft/)).toBeInTheDocument();
    });

    it('displays the max targets in the instruction text', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const instructionP = document.querySelector('p:not(.metamagic-spell-name)');
        expect(instructionP.textContent).toContain('Choose up to');
        expect(instructionP.textContent).toContain('creatures');
    });

    it('displays the HP increase amount in the instruction text', () => {
        render(<AidTargetPopup {...makeProps()} />);
        // Level 2 spell: hpIncrease = 5 + ((2-2)*5) = 5
        expect(screen.getByText(/5/)).toBeInTheDocument();
    });

    // ── Creature targets list ──

    it('renders the targets label with selection count', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(screen.getByText('Targets (0/3):')).toBeInTheDocument();
    });

    it('renders all creature targets in the target list', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(screen.getByText('Goblin')).toBeInTheDocument();
        expect(screen.getByText('Skeleton')).toBeInTheDocument();
        expect(screen.getByText('Orc')).toBeInTheDocument();
    });

    it('renders the metamagic-twin-target wrapper', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-twin-target')).toBeInTheDocument();
    });

    it('renders a scrollable container for targets', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const container = document.querySelector('.metamagic-twin-target div[style]');
        expect(container).toBeInTheDocument();
    });

    // ── Target selection ──

    it('shows checkmark prefix when target is selected', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        fireEvent.click(goblinEl);
        expect(screen.getByText('✓ Goblin')).toBeInTheDocument();
    });

    it('updates selection count when target is selected', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        fireEvent.click(goblinEl);
        expect(screen.getByText('Targets (1/3):')).toBeInTheDocument();
    });

    it('toggles target off when clicking an already selected target', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        fireEvent.click(goblinEl);
        expect(screen.getByText('Targets (1/3):')).toBeInTheDocument();
        fireEvent.click(screen.getByText('✓ Goblin'));
        expect(screen.getByText('Targets (0/3):')).toBeInTheDocument();
    });

    it('selects multiple targets up to maxTargets', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        const skeletonEl = screen.getByText('Skeleton');
        const orcEl = screen.getByText('Orc');
        fireEvent.click(goblinEl);
        fireEvent.click(skeletonEl);
        fireEvent.click(orcEl);
        expect(screen.getByText('Targets (3/3):')).toBeInTheDocument();
    });

    it('does not select beyond maxTargets', () => {
        render(<AidTargetPopup {...makeProps({ creatureTargets: ['Goblin', 'Skeleton', 'Orc', 'Zombie'] })} />);
        const goblinEl = screen.getByText('Goblin');
        const skeletonEl = screen.getByText('Skeleton');
        const orcEl = screen.getByText('Orc');
        const zombieEl = screen.getByText('Zombie');
        fireEvent.click(goblinEl);
        fireEvent.click(skeletonEl);
        fireEvent.click(orcEl);
        expect(screen.getByText('Targets (3/3):')).toBeInTheDocument();
        fireEvent.click(zombieEl);
        // Should still be 3/3 since maxTargets is 3
        expect(screen.getByText('Targets (3/3):')).toBeInTheDocument();
    });

    it('applies selected styling to selected targets', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        fireEvent.click(goblinEl);
        expect(goblinEl).toHaveStyle({
            backgroundColor: 'rgba(76, 175, 80, 0.3)',
            border: '1px solid #4CAF50',
        });
    });

    it('applies unselected styling to unselected targets', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        expect(goblinEl).toHaveStyle({
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
        });
        expect(goblinEl.style.borderColor).toBe('transparent');
    });

    // ── Action buttons ──

    it('renders "Cancel" button', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders "Cast Aid" button', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cast Aid')).toBeInTheDocument();
    });

    it('renders the metamagic-actions wrapper', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(document.querySelector('.metamagic-actions')).toBeInTheDocument();
    });

    it('disables "Cast Aid" button when no targets selected', () => {
        render(<AidTargetPopup {...makeProps()} />);
        expect(screen.getByText('Cast Aid')).toBeDisabled();
    });

    it('enables "Cast Aid" button when at least one target is selected', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        fireEvent.click(goblinEl);
        expect(screen.getByText('Cast Aid')).not.toBeDisabled();
    });

    // ── Confirm behavior ──

    it('calls onConfirm with selected targets when confirmed', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        const skeletonEl = screen.getByText('Skeleton');
        fireEvent.click(goblinEl);
        fireEvent.click(skeletonEl);
        fireEvent.click(screen.getByText('Cast Aid'));
        expect(mockOnConfirm).toHaveBeenCalledTimes(1);
        expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin', 'Skeleton']);
    });

    it('calls onConfirm with all selected targets', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const goblinEl = screen.getByText('Goblin');
        const skeletonEl = screen.getByText('Skeleton');
        const orcEl = screen.getByText('Orc');
        fireEvent.click(goblinEl);
        fireEvent.click(skeletonEl);
        fireEvent.click(orcEl);
        fireEvent.click(screen.getByText('Cast Aid'));
        expect(mockOnConfirm).toHaveBeenCalledWith(['Goblin', 'Skeleton', 'Orc']);
    });

    it('does not call onConfirm when confirmed without any target selected', () => {
        render(<AidTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Cast Aid'));
        expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    // ── Skip behavior ──

    it('calls onSkip when "Cancel" button is clicked', () => {
        render(<AidTargetPopup {...makeProps()} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('calls onSkip when clicking the overlay background', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onSkip when clicking inside the modal content', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const modal = document.querySelector('.popup-modal');
        fireEvent.click(modal);
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    // ── Keyboard: Escape ──

    it('calls onSkip when Escape key is pressed', () => {
        render(<AidTargetPopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });

    it('does not call onSkip for other keys', () => {
        render(<AidTargetPopup {...makeProps()} />);
        fireEvent.keyDown(document, { key: 'Enter' });
        expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('removes keydown listener on unmount', () => {
        const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
        const { unmount } = render(<AidTargetPopup {...makeProps()} />);
        unmount();
        expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    // ── Missing / optional spell ──

    it('throws when spell prop is null', () => {
        expect(() => render(<AidTargetPopup {...makeProps({ spell: null })} />)).toThrow();
    });

    it('shows "Spell" fallback when spell has no name', () => {
        render(<AidTargetPopup {...makeProps({ spell: {} })} />);
        expect(screen.getByText(/— Level/)).toBeInTheDocument();
    });

    it('shows default level 2 when spell has no level', () => {
        render(<AidTargetPopup {...makeProps({ spell: { name: 'Test' } })} />);
        expect(screen.getByText(/Level 2/)).toBeInTheDocument();
    });

    // ── Slot level affects HP increase ──

    it('calculates correct hpIncrease for level 3 spell', () => {
        render(<AidTargetPopup {...makeProps({ spell: { name: 'Aid', level: 3 } })} />);
        // hpIncrease = 5 + ((3-2)*5) = 10
        expect(screen.getByText(/10/)).toBeInTheDocument();
    });

    it('calculates correct hpIncrease for level 5 spell', () => {
        render(<AidTargetPopup {...makeProps({ spell: { name: 'Aid', level: 5 } })} />);
        // hpIncrease = 5 + ((5-2)*5) = 20
        expect(screen.getByText(/20/)).toBeInTheDocument();
    });

    // ── Empty creature targets ──

    it('renders empty target list when creatureTargets is empty', () => {
        render(<AidTargetPopup {...makeProps({ creatureTargets: [] })} />);
        expect(screen.getByText('Targets (0/3):')).toBeInTheDocument();
    });

    // ── Different maxTargets ──

    it('respects custom maxTargets value', () => {
        render(<AidTargetPopup {...makeProps({ maxTargets: 5 })} />);
        expect(screen.getByText('Targets (0/5):')).toBeInTheDocument();
    });

    it('disables confirm button when maxTargets not reached', () => {
        render(<AidTargetPopup {...makeProps({ maxTargets: 5 })} />);
        expect(screen.getByText('Cast Aid')).toBeDisabled();
    });

    // ── CSS class structure ──

    it('popup-overlay click triggers onSkip', () => {
        render(<AidTargetPopup {...makeProps()} />);
        const overlay = document.querySelector('.popup-overlay');
        fireEvent.click(overlay);
        expect(mockOnSkip).toHaveBeenCalledTimes(1);
    });
});
