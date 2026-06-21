// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionPicker from './ConditionPicker.jsx';

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
    CONDITIONS: [
        { key: 'blinded', label: 'Blinded' },
        { key: 'charmed', label: 'Charmed' },
        { key: 'cursed', label: 'Cursed' },
        { key: 'deafened', label: 'Deafened' },
        { key: 'frightened', label: 'Frightened' },
        { key: 'grappled', label: 'Grappled' },
        { key: 'incapacitated', label: 'Incapacitated' },
        { key: 'paralyzed', label: 'Paralyzed' },
        { key: 'petrified', label: 'Petrified' },
        { key: 'poisoned', label: 'Poisoned' },
        { key: 'prone', label: 'Prone' },
        { key: 'restrained', label: 'Restrained' },
        { key: 'stunned', label: 'Stunned' },
        { key: 'unconscious', label: 'Unconscious' },
    ],
    getDefaultAbility: (key) => {
        const map = {
            blinded: null,
            charmed: 'wis',
            cursed: 'con',
            deafened: null,
            frightened: 'wis',
            grappled: 'str',
            incapacitated: null,
            paralyzed: 'con',
            petrified: null,
            poisoned: 'con',
            prone: null,
            restrained: 'str',
            stunned: 'con',
            unconscious: null,
        };
        return map[key] || null;
    },
}));

const CONDITIONS = [
    { key: 'blinded', label: 'Blinded' },
    { key: 'charmed', label: 'Charmed' },
    { key: 'cursed', label: 'Cursed' },
    { key: 'deafened', label: 'Deafened' },
    { key: 'frightened', label: 'Frightened' },
    { key: 'grappled', label: 'Grappled' },
    { key: 'incapacitated', label: 'Incapacitated' },
    { key: 'paralyzed', label: 'Paralyzed' },
    { key: 'petrified', label: 'Petrified' },
    { key: 'poisoned', label: 'Poisoned' },
    { key: 'prone', label: 'Prone' },
    { key: 'restrained', label: 'Restrained' },
    { key: 'stunned', label: 'Stunned' },
    { key: 'unconscious', label: 'Unconscious' },
];

const ABILITY_OPTIONS = [
    { value: 'str', label: 'Strength' },
    { value: 'dex', label: 'Dexterity' },
    { value: 'con', label: 'Constitution' },
    { value: 'int', label: 'Intelligence' },
    { value: 'wis', label: 'Wisdom' },
    { value: 'cha', label: 'Charisma' },
];

describe('ConditionPicker', () => {
    let props;

    beforeEach(() => {
        props = {
            targetName: 'Goblin',
            selected: null,
            dc: 10,
            ability: 'str',
            onSelect: vi.fn(),
            onDcChange: vi.fn(),
            onAbilityChange: vi.fn(),
            onCancel: vi.fn(),
            onApply: vi.fn(),
        };
    });

    describe('rendering', () => {
        it('should render the overlay and modal container', () => {
            render(<ConditionPicker {...props} />);
            expect(screen.getByRole('heading', { name: /add condition to/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
        });

        it.each(CONDITIONS.map(({ label }) => ({ label })))(
            'should render the "$label" condition badge',
            ({ label }) => {
                render(<ConditionPicker {...props} />);
                expect(screen.getByText(label)).toBeInTheDocument();
            },
        );

        it('should render a DC input with default value', () => {
            render(<ConditionPicker {...props} />);
            const dcInput = screen.getByRole('spinbutton', { name: /dc/i });
            expect(dcInput.value).toBe('10');
        });

        it('should render a save ability select with all options', () => {
            render(<ConditionPicker {...props} />);
            const select = screen.getByRole('combobox', { name: /save/i });
            expect(select.value).toBe('str');
            ABILITY_OPTIONS.forEach(({ value, label }) => {
                expect(select.querySelector(`option[value="${value}"]`)).toHaveTextContent(label);
            });
        });

        it('should disable the Apply button when no condition is selected', () => {
            render(<ConditionPicker {...props} />);
            expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
        });

        it('should enable the Apply button when a condition is selected', () => {
            render(<ConditionPicker {...props} selected="blinded" />);
            expect(screen.getByRole('button', { name: 'Apply' })).not.toBeDisabled();
        });

        it.each([
            { targetName: 'Player Character', expected: 'Add Condition to Player Character' },
            { targetName: '', expected: 'Add Condition to' },
            { targetName: 'Tiamat', expected: 'Add Condition to Tiamat' },
        ])(
            'should display "$expected" as the heading for targetName="$targetName"',
            ({ expected }) => {
                render(<ConditionPicker {...props} targetName={expected.replace('Add Condition to ', '') || ''} />);
                expect(screen.getByRole('heading', { name: new RegExp(expected, 'i') })).toBeInTheDocument();
            },
        );
    });

    describe('condition badge selection', () => {
        it('should add selected class to the selected condition badge', () => {
            render(<ConditionPicker {...props} selected="blinded" />);
            expect(screen.getByText('Blinded')).toHaveClass('condition-picker-badge--selected');
        });

        it('should not add selected class to unselected condition badges', () => {
            render(<ConditionPicker {...props} selected="blinded" />);
            expect(screen.getByText('Charmed')).not.toHaveClass('condition-picker-badge--selected');
        });

        it.each([
            { condition: 'grappled', expectedAbility: 'str' },
            { condition: 'charmed', expectedAbility: 'wis' },
            { condition: 'cursed', expectedAbility: 'con' },
        ])(
            'should call onAbilityChange with "$expectedAbility" when clicking "$condition"',
            ({ condition, expectedAbility }) => {
                render(<ConditionPicker {...props} />);
                fireEvent.click(screen.getByText(condition.charAt(0).toUpperCase() + condition.slice(1)));
                expect(props.onSelect).toHaveBeenCalledWith(condition);
                expect(props.onAbilityChange).toHaveBeenCalledWith(expectedAbility);
            },
        );

        it.each([
            { condition: 'blinded' },
            { condition: 'prone' },
        ])(
            'should call onAbilityChange with "str" fallback when clicking "$condition" (no default)',
            ({ condition }) => {
                render(<ConditionPicker {...props} />);
                fireEvent.click(screen.getByText(condition.charAt(0).toUpperCase() + condition.slice(1)));
                expect(props.onSelect).toHaveBeenCalledWith(condition);
                expect(props.onAbilityChange).toHaveBeenCalledWith('str');
            },
        );
    });

    describe('DC input interaction', () => {
        it('should call onDcChange when DC input changes', () => {
            render(<ConditionPicker {...props} />);
            const dcInput = screen.getByRole('spinbutton', { name: /dc/i });
            fireEvent.change(dcInput, { target: { value: '15' } });
            expect(props.onDcChange).toHaveBeenCalledWith(15);
        });

        it.each([
            { input: '', expected: 10 },
            { input: 'abc', expected: 10 },
        ])(
            'should use default DC of 10 when input is "$input"',
            ({ input, expected }) => {
                render(<ConditionPicker {...props} />);
                const dcInput = screen.getByRole('spinbutton', { name: /dc/i });
                fireEvent.change(dcInput, { target: { value: input } });
                expect(props.onDcChange).toHaveBeenCalledWith(expected);
            },
        );

        it('should respect custom initial DC value', () => {
            render(<ConditionPicker {...props} dc={14} />);
            const dcInput = screen.getByRole('spinbutton', { name: /dc/i });
            expect(dcInput.value).toBe('14');
        });
    });

    describe('ability select interaction', () => {
        it('should call onAbilityChange when ability select changes', () => {
            render(<ConditionPicker {...props} />);
            const select = screen.getByRole('combobox', { name: /save/i });
            fireEvent.change(select, { target: { value: 'dex' } });
            expect(props.onAbilityChange).toHaveBeenCalledWith('dex');
        });

        it('should reflect custom initial ability value', () => {
            render(<ConditionPicker {...props} ability="dex" />);
            const select = screen.getByRole('combobox', { name: /save/i });
            expect(select.value).toBe('dex');
        });
    });

    describe('cancel interaction', () => {
        it('should call onCancel when Cancel button is clicked', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(props.onCancel).toHaveBeenCalled();
        });

        it('should call onCancel when overlay is clicked outside the modal', () => {
            render(<ConditionPicker {...props} />);
            const overlay = screen.getByRole('heading', { name: /add condition to/i }).closest('.condition-picker-overlay');
            fireEvent.click(overlay);
            expect(props.onCancel).toHaveBeenCalled();
        });

        it('should NOT call onCancel when modal content is clicked', () => {
            render(<ConditionPicker {...props} />);
            const modal = screen.getByRole('heading', { name: /add condition to/i }).closest('.condition-picker-modal');
            fireEvent.click(modal);
            expect(props.onCancel).not.toHaveBeenCalled();
        });
    });

    describe('apply interaction', () => {
        it('should call onApply when Apply button is clicked with a selection', () => {
            render(<ConditionPicker {...props} selected="blinded" />);
            fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
            expect(props.onApply).toHaveBeenCalled();
        });

        it('should NOT call onApply when Apply button is clicked without a selection', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
            expect(props.onApply).not.toHaveBeenCalled();
        });
    });
});
