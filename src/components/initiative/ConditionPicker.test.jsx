// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConditionPicker from './ConditionPicker.jsx';
describe('ConditionPicker', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
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

    // ------------------------------------------------------------------
    // Rendering — heading
    // ------------------------------------------------------------------

    describe('heading', () => {
        it.each`
            targetName
            ${'Alice'}
            ${''}
            ${'Dragon'}
        `('should include target name "$targetName" in heading', ({ targetName }) => {
            render(<ConditionPicker {...props} targetName={targetName} />);
            const heading = screen.getByRole('heading', { level: 3 });
            expect(heading.textContent).toContain(`Add Condition to ${targetName}`);
        });
    });

    // ------------------------------------------------------------------
    // Rendering — DC and ability fields
    // ------------------------------------------------------------------

    describe('DC and ability fields', () => {
        it('should render the DC input with the provided dc value', () => {
            render(<ConditionPicker {...props} dc={15} />);
            const dcInput = screen.getByRole('spinbutton');
            expect(dcInput.value).toBe('15');
        });

        it('should render the ability select with the provided ability value', () => {
            render(<ConditionPicker {...props} ability="dex" />);
            const select = screen.getByRole('combobox');
            expect(select.value).toBe('dex');
        });
    });

    // ------------------------------------------------------------------
    // Apply button — disabled state
    // ------------------------------------------------------------------

    describe('Apply button disabled state', () => {
        it.each`
            selected  | expected
            ${null}   | ${false}
            ${'blinded'} | ${true}
        `('should be enabled=$expected when selected is "$selected"', ({ selected, expected }) => {
            render(<ConditionPicker {...props} selected={selected} />);
            const applyBtn = screen.getByRole('button', { name: 'Apply' });
            if (expected) {
                expect(applyBtn).toBeEnabled();
            } else {
                expect(applyBtn).toBeDisabled();
            }
        });
    });

    // ------------------------------------------------------------------
    // Condition selection
    // ------------------------------------------------------------------

    describe('condition selection', () => {
        it('should call onSelect with the condition key when a condition is clicked', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText('Blinded'));
            expect(props.onSelect).toHaveBeenCalledWith('blinded');
        });

        it.each`
            conditionKey   | expectedAbility
            ${'blinded'}   | ${'str'}
            ${'charmed'}   | ${'wis'}
            ${'cursed'}    | ${'con'}
            ${'deafened'}  | ${'str'}
            ${'frightened'}| ${'wis'}
            ${'grappled'}  | ${'str'}
            ${'paralyzed'} | ${'con'}
            ${'poisoned'}  | ${'con'}
            ${'restrained'}| ${'str'}
            ${'slow'}      | ${'wis'}
            ${'stunned'}   | ${'con'}
        `('clicking "$conditionKey" should set ability to "$expectedAbility"', ({ conditionKey, expectedAbility }) => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText(conditionKey.charAt(0).toUpperCase() + conditionKey.slice(1)));
            expect(props.onAbilityChange).toHaveBeenCalledWith(expectedAbility);
        });
    });

    // ------------------------------------------------------------------
    // Cancel interaction
    // ------------------------------------------------------------------

    describe('cancel', () => {
        it('should call onCancel when Cancel button is clicked', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(props.onCancel).toHaveBeenCalled();
        });

        it('should NOT call onCancel when overlay background is clicked', () => {
            render(<ConditionPicker {...props} />);
            const overlay = document.querySelector('.condition-picker-overlay');
            fireEvent.click(overlay);
            expect(props.onCancel).not.toHaveBeenCalled();
            expect(document.querySelector('.condition-picker-modal')).toBeInTheDocument();
        });

        it('should NOT call onCancel when modal content is clicked', () => {
            render(<ConditionPicker {...props} />);
            const modal = document.querySelector('.condition-picker-modal');
            fireEvent.click(modal);
            expect(props.onCancel).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // Apply button click
    // ------------------------------------------------------------------

    describe('apply', () => {
        it('should call onApply when Apply button is clicked', () => {
            render(<ConditionPicker {...props} selected="blinded" />);
            fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
            expect(props.onApply).toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // DC input interaction
    // ------------------------------------------------------------------

    describe('DC input', () => {
        it.each`
            inputValue | expected
            ${'15'}    | ${15}
            ${''}      | ${10}
            ${'abc'}   | ${10}
            ${'0'}     | ${10}
        `('should call onDcChange with $expected when input is "$inputValue"', ({ inputValue, expected }) => {
            render(<ConditionPicker {...props} />);
            const dcInput = screen.getByRole('spinbutton');
            fireEvent.change(dcInput, { target: { value: inputValue } });
            expect(props.onDcChange).toHaveBeenCalledWith(expected);
        });
    });

    // ------------------------------------------------------------------
    // Ability select interaction
    // ------------------------------------------------------------------

    describe('ability select', () => {
        it.each`
            ability
            ${'str'}
            ${'dex'}
            ${'con'}
            ${'int'}
            ${'wis'}
            ${'cha'}
        `('should call onAbilityChange with "$ability" when selected', ({ ability }) => {
            render(<ConditionPicker {...props} />);
            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: ability } });
            expect(props.onAbilityChange).toHaveBeenCalledWith(ability);
        });
    });
});
