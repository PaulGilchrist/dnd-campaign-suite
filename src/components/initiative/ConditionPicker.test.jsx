import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionPicker from './ConditionPicker.jsx';

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
        it('should render the heading, cancel button, and apply button', () => {
            render(<ConditionPicker {...props} />);
            expect(screen.getByRole('heading', { name: /add condition to/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
        });

        it.each([
            { key: 'blinded', label: 'Blinded', expectedAbility: 'str' },
            { key: 'charmed', label: 'Charmed', expectedAbility: 'wis' },
            { key: 'cursed', label: 'Cursed', expectedAbility: 'con' },
            { key: 'grappled', label: 'Grappled', expectedAbility: 'str' },
            { key: 'prone', label: 'Prone', expectedAbility: 'str' },
        ])(
            'should select "$label" and set ability to "$expectedAbility" when clicked',
            ({ label, expectedAbility }) => {
                render(<ConditionPicker {...props} />);
                fireEvent.click(screen.getByText(label));
                const conditionKey = label.toLowerCase();
                expect(props.onSelect).toHaveBeenCalledWith(conditionKey);
                expect(props.onAbilityChange).toHaveBeenCalledWith(expectedAbility);
            },
        );

        it('should disable the Apply button when no condition is selected', () => {
            render(<ConditionPicker {...props} />);
            expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
        });
    });

    describe('DC input', () => {
        it('should call onDcChange when DC input changes', () => {
            render(<ConditionPicker {...props} />);
            const dcInput = screen.getByRole('spinbutton');
            fireEvent.change(dcInput, { target: { value: '15' } });
            expect(props.onDcChange).toHaveBeenCalledWith(15);
        });
    });
});
