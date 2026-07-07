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

    it('should render the heading, cancel button, and apply button', () => {
        render(<ConditionPicker {...props} />);
        expect(screen.getByRole('heading', { name: /add condition to/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    });

    it('should call onSelect and onAbilityChange when a condition is clicked', () => {
        render(<ConditionPicker {...props} />);
        fireEvent.click(screen.getByText('Blinded'));
        expect(props.onSelect).toHaveBeenCalledWith('blinded');
        expect(props.onAbilityChange).toHaveBeenCalled();
    });

    it('should disable the Apply button when no condition is selected', () => {
        render(<ConditionPicker {...props} />);
        expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    });

    it('should call onDcChange when DC input changes', () => {
        render(<ConditionPicker {...props} />);
        const dcInput = screen.getByRole('spinbutton');
        fireEvent.change(dcInput, { target: { value: '15' } });
        expect(props.onDcChange).toHaveBeenCalledWith(15);
    });
});
