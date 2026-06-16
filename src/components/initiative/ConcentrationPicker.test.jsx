import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
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

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe('rendering', () => {
        it('should render the overlay container', () => {
            render(<ConcentrationPicker {...props} />);
            expect(document.querySelector('.condition-picker-overlay')).toBeInTheDocument();
        });

        it('should render the modal container', () => {
            render(<ConcentrationPicker {...props} />);
            expect(document.querySelector('.condition-picker-modal')).toBeInTheDocument();
        });

        it('should render the target name in the heading', () => {
            render(<ConcentrationPicker {...props} />);
            expect(screen.getByText('Concentration for Goblin')).toBeInTheDocument();
        });

        it('should render the spell label', () => {
            render(<ConcentrationPicker {...props} />);
            expect(screen.getByText('Spell')).toBeInTheDocument();
        });

        it('should render the DC label', () => {
            render(<ConcentrationPicker {...props} />);
            expect(screen.getByText('DC')).toBeInTheDocument();
        });

        it('should render the spell input with the provided value', () => {
            render(<ConcentrationPicker {...props} />);
            const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
            expect(spellInput).toBeInTheDocument();
            expect(spellInput).toHaveValue('Fireball');
        });

        it('should render the DC input with the provided value', () => {
            render(<ConcentrationPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            expect(dcInput).toBeInTheDocument();
            expect(dcInput).toHaveValue(15);
        });

        it('should set the spell input placeholder', () => {
            render(<ConcentrationPicker {...props} />);
            const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
            expect(spellInput).toHaveAttribute('placeholder', 'Spell name');
        });

        it('should set min=1 on the DC input', () => {
            render(<ConcentrationPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            expect(dcInput).toHaveAttribute('min', '1');
        });

        it('should render the cancel button', () => {
            render(<ConcentrationPicker {...props} />);
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });

        it('should render the apply button', () => {
            render(<ConcentrationPicker {...props} />);
            expect(screen.getByText('Apply')).toBeInTheDocument();
        });

        it('should disable the apply button when spellName is empty', () => {
            render(<ConcentrationPicker {...props} spellName='' />);
            const applyBtn = screen.getByText('Apply');
            expect(applyBtn).toBeDisabled();
        });

        it('should disable the apply button when spellName is whitespace only', () => {
            render(<ConcentrationPicker {...props} spellName='   ' />);
            const applyBtn = screen.getByText('Apply');
            expect(applyBtn).toBeDisabled();
        });

        it('should enable the apply button when spellName has content', () => {
            render(<ConcentrationPicker {...props} spellName='Fireball' />);
            const applyBtn = screen.getByText('Apply');
            expect(applyBtn).not.toBeDisabled();
        });

        it('should autoFocus the spell input', () => {
            render(<ConcentrationPicker {...props} />);
            const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
            expect(spellInput).toHaveFocus();
        });
    });

    describe('spell name input interaction', () => {
        it('should call onSpellNameChange when spell input changes', () => {
            render(<ConcentrationPicker {...props} />);
            const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
            fireEvent.change(spellInput, { target: { value: 'Lightning Bolt' } });
            expect(props.onSpellNameChange).toHaveBeenCalledWith('Lightning Bolt');
        });

        it('should update apply button disabled state when spell name changes', () => {
            render(<ConcentrationPicker {...props} spellName='' onSpellNameChange={props.onSpellNameChange} />);
            const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
            const applyBtn = screen.getByText('Apply');
            expect(applyBtn).toBeDisabled();
            fireEvent.change(spellInput, { target: { value: 'Fireball' } });
            expect(props.onSpellNameChange).toHaveBeenCalledWith('Fireball');
        });
    });

    describe('DC input interaction', () => {
        it('should call onDcChange with parsed integer when DC input changes', () => {
            render(<ConcentrationPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            fireEvent.change(dcInput, { target: { value: '20' } });
            expect(props.onDcChange).toHaveBeenCalledWith(20);
        });

        it('should call onDcChange with 10 when DC input is empty', () => {
            render(<ConcentrationPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            fireEvent.change(dcInput, { target: { value: '' } });
            expect(props.onDcChange).toHaveBeenCalledWith(10);
        });

        it('should call onDcChange with 10 when DC input is invalid', () => {
            render(<ConcentrationPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            fireEvent.change(dcInput, { target: { value: 'abc' } });
            expect(props.onDcChange).toHaveBeenCalledWith(10);
        });

        it('should call onDcChange with 10 when DC input is 0', () => {
            render(<ConcentrationPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            fireEvent.change(dcInput, { target: { value: '0' } });
            expect(props.onDcChange).toHaveBeenCalledWith(10);
        });
    });

    describe('cancel interaction', () => {
        it('should call onCancel when cancel button is clicked', () => {
            render(<ConcentrationPicker {...props} />);
            fireEvent.click(screen.getByText('Cancel'));
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
        it('should call onApply when apply button is clicked with valid spell name', () => {
            render(<ConcentrationPicker {...props} />);
            fireEvent.click(screen.getByText('Apply'));
            expect(props.onApply).toHaveBeenCalled();
        });

        it('should not call onApply when apply button is disabled', () => {
            render(<ConcentrationPicker {...props} spellName='' />);
            fireEvent.click(screen.getByText('Apply'));
            expect(props.onApply).not.toHaveBeenCalled();
        });
    });

    describe('different target names', () => {
        it('should render different target names correctly', () => {
            render(<ConcentrationPicker {...props} targetName='Alice' />);
            expect(screen.getByText('Concentration for Alice')).toBeInTheDocument();
        });

        it('should render empty target name gracefully', () => {
            render(<ConcentrationPicker {...props} targetName='' />);
            expect(screen.getByText(/Concentration for/)).toBeInTheDocument();
        });
    });

    describe('different spell names', () => {
        it('should render different spell names in the input', () => {
            render(<ConcentrationPicker {...props} spellName='Shield' />);
            const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
            expect(spellInput).toHaveValue('Shield');
        });

        it('should render long spell names in the input', () => {
            render(<ConcentrationPicker {...props} spellName='Wish' />);
            const spellInput = document.querySelector('.condition-picker-fields input[type="text"]');
            expect(spellInput).toHaveValue('Wish');
        });
    });

    describe('different DC values', () => {
        it('should render DC 10 by default', () => {
            render(<ConcentrationPicker {...props} dc={10} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            expect(dcInput).toHaveValue(10);
        });

        it('should render high DC values', () => {
            render(<ConcentrationPicker {...props} dc={25} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            expect(dcInput).toHaveValue(25);
        });
    });
});
