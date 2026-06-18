// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MultiTargetPopup from './MultiTargetPopup.jsx';

// ── Test fixtures ──

const mockSpell = { name: 'Create Water', level: 1 };
const mockRange = '30 ft';
const mockCreatureTargets = ['Goblin', 'Skeleton', 'Orc'];
const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

function makeProps(overrides) {
    return {
        spell: mockSpell,
        _playerStats: { name: 'Throg' },
        _campaignName: 'test-campaign',
        range: mockRange,
        creatureTargets: mockCreatureTargets,
        onConfirm: mockOnConfirm,
        onSkip: mockOnSkip,
        ...(overrides || {}),
    };
}

// ── Tests ──

describe('MultiTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── Initial render ──

    describe('initial render', () => {
        it('renders the popup overlay with modal, header, and spell info', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
            expect(document.querySelector('.popup-modal')).toBeInTheDocument();
            expect(screen.getByText('Words of Creation')).toBeInTheDocument();
            expect(screen.getByText('Create Water')).toBeInTheDocument();
            expect(screen.getByText(/Spread to Second Target/)).toBeInTheDocument();
            expect(screen.getByText(/30 ft/)).toBeInTheDocument();
            expect(screen.getByText(/Select a second creature within/)).toBeInTheDocument();
        });

        it('renders the users icon in the header', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const icon = document.querySelector('.fa-solid.fa-users');
            expect(icon).toBeInTheDocument();
        });

        it('renders the Second Target label with select dropdown and placeholder', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            expect(screen.getByText('Second Target:')).toBeInTheDocument();
            const select = document.querySelector('select');
            expect(select).toBeInTheDocument();
            expect(screen.getByText('-- Select target --')).toBeInTheDocument();
        });

        it('renders all creature targets as select options', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Skeleton')).toBeInTheDocument();
            expect(screen.getByText('Orc')).toBeInTheDocument();
        });

        it('renders both action buttons', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            expect(screen.getByText('Cast on First Target Only')).toBeInTheDocument();
            expect(screen.getByText('Cast on Both Targets')).toBeInTheDocument();
        });
    });

    // ── Spell name rendering ──

    describe('spell name rendering', () => {
        it('shows spell name when spell prop is provided', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            expect(screen.getByText('Create Water')).toBeInTheDocument();
        });

        it('shows "Spell" fallback when spell prop is null', () => {
            render(<MultiTargetPopup {...makeProps({ spell: null })} />);
            expect(screen.getByText(/— Spread to Second Target/)).toBeInTheDocument();
            const spellNameEl = document.querySelector('.metamagic-spell-name strong');
            expect(spellNameEl).toHaveTextContent('Spell');
        });

        it('shows "Spell" fallback when spell has no name property', () => {
            render(<MultiTargetPopup {...makeProps({ spell: {} })} />);
            expect(screen.getByText(/— Spread to Second Target/)).toBeInTheDocument();
            const spellNameEl = document.querySelector('.metamagic-spell-name strong');
            expect(spellNameEl).toHaveTextContent('Spell');
        });
    });

    // ── Creature targets edge cases ──

    describe('creature targets edge cases', () => {
        it('renders select with only the placeholder when creatureTargets is empty', () => {
            render(<MultiTargetPopup {...makeProps({ creatureTargets: [] })} />);
            const select = document.querySelector('select');
            expect(select).toBeInTheDocument();
            const options = select.querySelectorAll('option');
            expect(options).toHaveLength(1);
            expect(options[0].value).toBe('');
        });
    });

    // ── Confirm button state ──

    describe('confirm button state', () => {
        it('disables "Cast on Both Targets" when no second target is selected', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            expect(screen.getByText('Cast on Both Targets')).toBeDisabled();
        });

        it('enables "Cast on Both Targets" after selecting a target', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const select = document.querySelector('select');
            fireEvent.change(select, { target: { value: 'Goblin' } });
            expect(screen.getByText('Cast on Both Targets')).not.toBeDisabled();
        });

        it('disables confirm button when target selection is cleared', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const select = document.querySelector('select');
            fireEvent.change(select, { target: { value: 'Goblin' } });
            expect(screen.getByText('Cast on Both Targets')).not.toBeDisabled();
            fireEvent.change(select, { target: { value: '' } });
            expect(screen.getByText('Cast on Both Targets')).toBeDisabled();
        });

        it('updates select value when switching between targets', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const select = document.querySelector('select');
            fireEvent.change(select, { target: { value: 'Goblin' } });
            expect(select.value).toBe('Goblin');
            fireEvent.change(select, { target: { value: 'Skeleton' } });
            expect(select.value).toBe('Skeleton');
        });
    });

    // ── Confirm behavior ──

    describe('confirm behavior', () => {
        it('calls onConfirm with selected second target', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const select = document.querySelector('select');
            fireEvent.change(select, { target: { value: 'Goblin' } });
            fireEvent.click(screen.getByText('Cast on Both Targets'));
            expect(mockOnConfirm).toHaveBeenCalledTimes(1);
            expect(mockOnConfirm).toHaveBeenCalledWith({ secondTarget: 'Goblin' });
        });

        it('calls onConfirm with the other creature names', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const select = document.querySelector('select');
            fireEvent.change(select, { target: { value: 'Orc' } });
            fireEvent.click(screen.getByText('Cast on Both Targets'));
            expect(mockOnConfirm).toHaveBeenCalledWith({ secondTarget: 'Orc' });
            fireEvent.change(select, { target: { value: 'Skeleton' } });
            fireEvent.click(screen.getByText('Cast on Both Targets'));
            expect(mockOnConfirm).toHaveBeenCalledWith({ secondTarget: 'Skeleton' });
        });

        it('does not call onConfirm when clicked without a target selected', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            fireEvent.click(screen.getByText('Cast on Both Targets'));
            expect(mockOnConfirm).not.toHaveBeenCalled();
        });
    });

    // ── Skip behavior ──

    describe('skip behavior', () => {
        it('calls onSkip when "Cast on First Target Only" button is clicked', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            fireEvent.click(screen.getByText('Cast on First Target Only'));
            expect(mockOnSkip).toHaveBeenCalledTimes(1);
        });

        it('calls onSkip when clicking the overlay background', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const overlay = document.querySelector('.popup-overlay');
            fireEvent.click(overlay);
            expect(mockOnSkip).toHaveBeenCalledTimes(1);
        });

        it('does NOT call onSkip when clicking inside the modal content', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const modal = document.querySelector('.popup-modal');
            fireEvent.click(modal);
            expect(mockOnSkip).not.toHaveBeenCalled();
        });
    });

    // ── Keyboard: Escape ──

    describe('keyboard handling', () => {
        it('calls onSkip when Escape key is pressed', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(mockOnSkip).toHaveBeenCalledTimes(1);
        });

        it('does not call onSkip for other keys', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            fireEvent.keyDown(document, { key: 'Enter' });
            expect(mockOnSkip).not.toHaveBeenCalled();
        });

        it('removes keydown listener on unmount', () => {
            const removeListenerSpy = vi.spyOn(document, 'removeEventListener');
            const { unmount } = render(<MultiTargetPopup {...makeProps()} />);
            unmount();
            expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        });
    });
});
