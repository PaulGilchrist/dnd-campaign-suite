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
            expect(screen.getByText('Words of Creation')).toBeInTheDocument();
            expect(screen.getByText('Create Water')).toBeInTheDocument();
            expect(screen.getByText(/— Spread to Second Target/)).toBeInTheDocument();
            expect(screen.getByText(/30 ft/)).toBeInTheDocument();
            expect(screen.getByText(/Select a second creature within/)).toBeInTheDocument();
            expect(screen.getByText('Second Target:')).toBeInTheDocument();
            expect(screen.getByRole('combobox')).toBeInTheDocument();
            expect(screen.getByText('-- Select target --')).toBeInTheDocument();
            expect(screen.getByText('Goblin')).toBeInTheDocument();
            expect(screen.getByText('Skeleton')).toBeInTheDocument();
            expect(screen.getByText('Orc')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cast on First Target Only' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cast on Both Targets' })).toBeInTheDocument();
        });

        it('shows "Spell" fallback when spell is null or missing a name', () => {
            render(<MultiTargetPopup {...makeProps({ spell: null })} />);
            expect(screen.getByText(/— Spread to Second Target/)).toBeInTheDocument();
            expect(screen.getByText('Spell')).toBeInTheDocument();
        });

        it('renders select with only placeholder when creatureTargets is empty', () => {
            render(<MultiTargetPopup {...makeProps({ creatureTargets: [] })} />);
            const select = screen.getByRole('combobox');
            expect(select.querySelectorAll('option')).toHaveLength(1);
            expect(select.querySelector('option').value).toBe('');
        });
    });

    describe('confirm button state', () => {
        it('is disabled by default, enabled after selecting a target, and disabled again when cleared', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const btn = screen.getByRole('button', { name: 'Cast on Both Targets' });
            expect(btn).toBeDisabled();
            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: 'Goblin' } });
            expect(btn).not.toBeDisabled();
            fireEvent.change(select, { target: { value: '' } });
            expect(btn).toBeDisabled();
        });
    });

    describe('confirm behavior', () => {
        it('calls onConfirm with selected second target', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: 'Orc' } });
            fireEvent.click(screen.getByRole('button', { name: 'Cast on Both Targets' }));
            expect(mockOnConfirm).toHaveBeenCalledWith({ secondTarget: 'Orc' });
        });

        it('does not call onConfirm when clicked without a target selected', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cast on Both Targets' }));
            expect(mockOnConfirm).not.toHaveBeenCalled();
        });
    });

    describe('skip behavior', () => {
        it('calls onSkip when "Cast on First Target Only" button is clicked', () => {
            render(<MultiTargetPopup {...makeProps()} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cast on First Target Only' }));
            expect(mockOnSkip).toHaveBeenCalledTimes(1);
        });
    });
});
