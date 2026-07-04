import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConcentrationPicker from './ConcentrationPicker.jsx';

describe('ConcentrationPicker', () => {
    let props;

    beforeEach(() => {
        vi.clearAllMocks();
        props = {
            targetName: 'Goblin',
            spellName: 'Fireball',
            dc: 15,
            onSpellNameChange: vi.fn(),
            onDcChange: vi.fn(),
            onCancel: vi.fn(),
            onApply: vi.fn(),
        };
    });

    describe('rendering', () => {
        it('should render the overlay, modal, labels and buttons', () => {
            render(<ConcentrationPicker {...props} />);
            expect(screen.getByRole('heading', { name: 'Concentration for Goblin' })).toBeInTheDocument();
            expect(document.querySelector('.condition-picker-overlay')).toBeInTheDocument();
            expect(document.querySelector('.condition-picker-modal')).toBeInTheDocument();
            expect(screen.getByText('Spell')).toBeInTheDocument();
            expect(screen.getByText('DC')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
        });

        it('should autoFocus the spell input', () => {
            render(<ConcentrationPicker {...props} />);
            const spellInput = screen.getByLabelText('Spell');
            expect(spellInput).toHaveFocus();
        });

        it.each`
            spellName        | expectedDisabled
            ${''}            | ${true}
            ${'   '}         | ${true}
            ${'Fireball'}    | ${false}
        `('should $expectedDisabled the apply button when spellName is "$spellName"',
            ({ spellName, expectedDisabled }) => {
                render(<ConcentrationPicker {...props} spellName={spellName} />);
                const applyBtn = screen.getByRole('button', { name: 'Apply' });
                expect(applyBtn.disabled).toBe(expectedDisabled);
            });

        it.each`
            targetName
            ${'Alice'}
            ${''}
            ${'Dragon'}
        `('should render target name "$targetName" in the heading', ({ targetName }) => {
            render(<ConcentrationPicker {...props} targetName={targetName} />);
            const heading = screen.getByRole('heading', { level: 3 });
            expect(heading.textContent).toContain(`Concentration for ${targetName}`);
        });

        it.each`
            dc
            ${10}
            ${20}
            ${25}
        `('should render DC input with value $dc', ({ dc }) => {
            render(<ConcentrationPicker {...props} dc={dc} />);
            const dcInput = screen.getByLabelText('DC');
            expect(dcInput).toHaveValue(dc);
        });

        it.each`
            spellName
            ${'Shield'}
            ${'Wish'}
        `('should render spell input with value "$spellName"', ({ spellName }) => {
            render(<ConcentrationPicker {...props} spellName={spellName} />);
            const spellInput = screen.getByLabelText('Spell');
            expect(spellInput).toHaveValue(spellName);
        });
    });

    describe('spell name input interaction', () => {
        it('should call onSpellNameChange when spell input changes', () => {
            render(<ConcentrationPicker {...props} />);
            const spellInput = screen.getByLabelText('Spell');
            fireEvent.change(spellInput, { target: { value: 'Lightning Bolt' } });
            expect(props.onSpellNameChange).toHaveBeenCalledWith('Lightning Bolt');
        });
    });

    describe('DC input interaction', () => {
        it('should call onDcChange with parsed integer when DC input changes', () => {
            render(<ConcentrationPicker {...props} />);
            const dcInput = screen.getByLabelText('DC');
            fireEvent.change(dcInput, { target: { value: '20' } });
            expect(props.onDcChange).toHaveBeenCalledWith(20);
        });

        it.each`
            inputValue | expected
            ${''}      | ${10}
            ${'abc'}   | ${10}
            ${'0'}     | ${10}
        `('should call onDcChange with $expected when input is "$inputValue"', ({ inputValue, expected }) => {
            render(<ConcentrationPicker {...props} />);
            const dcInput = screen.getByLabelText('DC');
            fireEvent.change(dcInput, { target: { value: inputValue } });
            expect(props.onDcChange).toHaveBeenCalledWith(expected);
        });
    });

    describe('cancel interaction', () => {
        it('should call onCancel when Cancel button is clicked', () => {
            render(<ConcentrationPicker {...props} />);
            fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(props.onCancel).toHaveBeenCalled();
        });

        it('should call onCancel when overlay background is clicked', () => {
            render(<ConcentrationPicker {...props} />);
            const overlay = document.querySelector('.condition-picker-overlay');
            fireEvent.click(overlay);
            expect(props.onCancel).toHaveBeenCalled();
        });

        it('should NOT call onCancel when modal content is clicked', () => {
            render(<ConcentrationPicker {...props} />);
            const modal = document.querySelector('.condition-picker-modal');
            fireEvent.click(modal);
            expect(props.onCancel).not.toHaveBeenCalled();
        });
    });

    describe('apply interaction', () => {
        it('should call onApply when Apply button is clicked with valid spell name', () => {
            render(<ConcentrationPicker {...props} />);
            fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
            expect(props.onApply).toHaveBeenCalled();
        });
    });
});
