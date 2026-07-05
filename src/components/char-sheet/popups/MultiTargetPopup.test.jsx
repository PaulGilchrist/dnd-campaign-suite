// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MultiTargetPopup from './MultiTargetPopup.jsx';

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

describe('MultiTargetPopup', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders the popup with header, spell info, creature select, and action buttons', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            expect(document.querySelector('.popup-overlay')).toBeInTheDocument();
            expect(document.querySelector('.popup-modal')).toBeInTheDocument();
            expect(screen.getByText('Words of Creation')).toBeInTheDocument();
            expect(screen.getByText('Create Water')).toBeInTheDocument();
            expect(screen.getByText(/Spread to Second Target/)).toBeInTheDocument();
            expect(screen.getByText(/30 ft/)).toBeInTheDocument();
            expect(screen.getByText(/Select a second creature within/)).toBeInTheDocument();
            expect(screen.getByText('Second Target:')).toBeInTheDocument();
            expect(document.querySelector('select')).toBeInTheDocument();
            expect(screen.getByText('-- Select target --')).toBeInTheDocument();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Skeleton')).toBeInTheDocument();
            expect(screen.getByText('Orc')).toBeInTheDocument();
            expect(screen.getByText('Cast on First Target Only')).toBeInTheDocument();
            expect(screen.getByText('Cast on Both Targets')).toBeInTheDocument();
        });

        it('shows "Spell" fallback when spell is null or missing a name', () => {
            render(<MultiTargetPopup {...makeProps({ spell: null })} />);
            expect(screen.getByText(/— Spread to Second Target/)).toBeInTheDocument();
            expect(document.querySelector('.metamagic-spell-name strong')).toHaveTextContent('Spell');
        });

        it('renders select with only placeholder when creatureTargets is empty', () => {
            render(<MultiTargetPopup {...makeProps({ creatureTargets: [] })} />);
            const select = document.querySelector('select');
            expect(select).toBeInTheDocument();
            expect(select.querySelectorAll('option')).toHaveLength(1);
            expect(select.querySelector('option').value).toBe('');
        });
    });

    describe('confirm button state', () => {
        it('is disabled by default and enabled after selecting a target', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            expect(screen.getByText('Cast on Both Targets')).toBeDisabled();
            const select = document.querySelector('select');
            fireEvent.change(select, { target: { value: 'Goblin' } });
            expect(screen.getByText('Cast on Both Targets')).not.toBeDisabled();
        });

        it('is disabled again when target selection is cleared', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const select = document.querySelector('select');
            fireEvent.change(select, { target: { value: 'Goblin' } });
            expect(screen.getByText('Cast on Both Targets')).not.toBeDisabled();
            fireEvent.change(select, { target: { value: '' } });
            expect(screen.getByText('Cast on Both Targets')).toBeDisabled();
        });
    });

    describe('confirm behavior', () => {
        it('calls onConfirm with selected second target', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const select = document.querySelector('select');
            fireEvent.change(select, { target: { value: 'Orc' } });
            fireEvent.click(screen.getByText('Cast on Both Targets'));
            expect(mockOnConfirm).toHaveBeenCalledWith({ secondTarget: 'Orc' });
        });

        it('does not call onConfirm when clicked without a target selected', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            fireEvent.click(screen.getByText('Cast on Both Targets'));
            expect(mockOnConfirm).not.toHaveBeenCalled();
        });
    });

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

        it('calls onSkip when Escape key is pressed', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(mockOnSkip).toHaveBeenCalledTimes(1);
        });
    });
});
