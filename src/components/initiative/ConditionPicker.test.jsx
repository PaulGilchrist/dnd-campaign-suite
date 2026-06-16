import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
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

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe('rendering', () => {
        it('should render the overlay wrapper', () => {
            render(<ConditionPicker {...props} />);
            expect(document.querySelector('.condition-picker-overlay')).toBeInTheDocument();
        });

        it('should render the modal container', () => {
            render(<ConditionPicker {...props} />);
            expect(document.querySelector('.condition-picker-modal')).toBeInTheDocument();
        });

        it('should display the target name in the heading', () => {
            render(<ConditionPicker {...props} />);
            expect(screen.getByText('Add Condition to Goblin')).toBeInTheDocument();
        });

        it('should render all condition badges', () => {
            render(<ConditionPicker {...props} />);
            expect(screen.getByText('Blinded')).toBeInTheDocument();
            expect(screen.getByText('Charmed')).toBeInTheDocument();
            expect(screen.getByText('Cursed')).toBeInTheDocument();
            expect(screen.getByText('Deafened')).toBeInTheDocument();
            expect(screen.getByText('Frightened')).toBeInTheDocument();
            expect(screen.getByText('Grappled')).toBeInTheDocument();
            expect(screen.getByText('Incapacitated')).toBeInTheDocument();
            expect(screen.getByText('Paralyzed')).toBeInTheDocument();
            expect(screen.getByText('Petrified')).toBeInTheDocument();
            expect(screen.getByText('Poisoned')).toBeInTheDocument();
            expect(screen.getByText('Prone')).toBeInTheDocument();
            expect(screen.getByText('Restrained')).toBeInTheDocument();
            expect(screen.getByText('Stunned')).toBeInTheDocument();
            expect(screen.getByText('Unconscious')).toBeInTheDocument();
        });

        it('should render a DC input with default value', () => {
            render(<ConditionPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            expect(dcInput).toBeInTheDocument();
            expect(dcInput.value).toBe('10');
        });

        it('should render a save ability select', () => {
            render(<ConditionPicker {...props} />);
            const select = document.querySelector('.condition-picker-fields select');
            expect(select).toBeInTheDocument();
            expect(select.value).toBe('str');
        });

        it('should render all six ability options in the select', () => {
            render(<ConditionPicker {...props} />);
            const select = document.querySelector('.condition-picker-fields select');
            expect(select.querySelector('option[value="str"]')).toHaveTextContent('Strength');
            expect(select.querySelector('option[value="dex"]')).toHaveTextContent('Dexterity');
            expect(select.querySelector('option[value="con"]')).toHaveTextContent('Constitution');
            expect(select.querySelector('option[value="int"]')).toHaveTextContent('Intelligence');
            expect(select.querySelector('option[value="wis"]')).toHaveTextContent('Wisdom');
            expect(select.querySelector('option[value="cha"]')).toHaveTextContent('Charisma');
        });

        it('should render Cancel and Apply buttons', () => {
            render(<ConditionPicker {...props} />);
            expect(screen.getByText('Cancel')).toBeInTheDocument();
            expect(screen.getByText('Apply')).toBeInTheDocument();
        });

        it('should disable the Apply button when no condition is selected', () => {
            render(<ConditionPicker {...props} />);
            const applyBtn = screen.getByText('Apply');
            expect(applyBtn).toBeDisabled();
        });

        it('should enable the Apply button when a condition is selected', () => {
            render(<ConditionPicker {...props} selected="blinded" />);
            const applyBtn = screen.getByText('Apply');
            expect(applyBtn).not.toBeDisabled();
        });
    });

    describe('condition badge selection', () => {
        it('should add selected class to the selected condition badge', () => {
            render(<ConditionPicker {...props} selected="blinded" />);
            const selectedBadge = screen.getByText('Blinded');
            expect(selectedBadge).toHaveClass('condition-picker-badge--selected');
        });

        it('should not add selected class to unselected condition badges', () => {
            render(<ConditionPicker {...props} selected="blinded" />);
            const unselectedBadge = screen.getByText('Charmed');
            expect(unselectedBadge).not.toHaveClass('condition-picker-badge--selected');
        });

        it('should call onSelect with condition key when a badge is clicked', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText('Blinded'));
            expect(props.onSelect).toHaveBeenCalledWith('blinded');
        });

        it('should call onAbilityChange with default ability for grappled (str)', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText('Grappled'));
            expect(props.onAbilityChange).toHaveBeenCalledWith('str');
        });

        it('should call onAbilityChange with default ability for charmed (wis)', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText('Charmed'));
            expect(props.onAbilityChange).toHaveBeenCalledWith('wis');
        });

        it('should call onAbilityChange with default ability for cursed (con)', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText('Cursed'));
            expect(props.onAbilityChange).toHaveBeenCalledWith('con');
        });

        it('should call onAbilityChange with str fallback for conditions with no default ability', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText('Blinded'));
            expect(props.onAbilityChange).toHaveBeenCalledWith('str');
        });

        it('should call onAbilityChange with str fallback for conditions with no default ability (prone)', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText('Prone'));
            expect(props.onAbilityChange).toHaveBeenCalledWith('str');
        });
    });

    describe('DC input interaction', () => {
        it('should call onDcChange when DC input changes', () => {
            render(<ConditionPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            fireEvent.change(dcInput, { target: { value: '15' } });
            expect(props.onDcChange).toHaveBeenCalledWith(15);
        });

        it('should use default DC of 10 when input is empty', () => {
            render(<ConditionPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            fireEvent.change(dcInput, { target: { value: '' } });
            expect(props.onDcChange).toHaveBeenCalledWith(10);
        });

        it('should use default DC of 10 when input is invalid', () => {
            render(<ConditionPicker {...props} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            fireEvent.change(dcInput, { target: { value: 'abc' } });
            expect(props.onDcChange).toHaveBeenCalledWith(10);
        });

        it('should respect custom initial DC value', () => {
            render(<ConditionPicker {...props} dc={14} />);
            const dcInput = document.querySelector('.condition-picker-fields input[type="number"]');
            expect(dcInput.value).toBe('14');
        });
    });

    describe('ability select interaction', () => {
        it('should call onAbilityChange when ability select changes', () => {
            render(<ConditionPicker {...props} />);
            const select = document.querySelector('.condition-picker-fields select');
            fireEvent.change(select, { target: { value: 'dex' } });
            expect(props.onAbilityChange).toHaveBeenCalledWith('dex');
        });

        it('should reflect custom initial ability value', () => {
            render(<ConditionPicker {...props} ability="dex" />);
            const select = document.querySelector('.condition-picker-fields select');
            expect(select.value).toBe('dex');
        });
    });

    describe('cancel interaction', () => {
        it('should call onCancel when Cancel button is clicked', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText('Cancel'));
            expect(props.onCancel).toHaveBeenCalled();
        });

        it('should call onCancel when overlay is clicked outside the modal', () => {
            render(<ConditionPicker {...props} />);
            const overlay = document.querySelector('.condition-picker-overlay');
            fireEvent.click(overlay);
            expect(props.onCancel).toHaveBeenCalled();
        });

        it('should NOT call onCancel when modal content is clicked', () => {
            render(<ConditionPicker {...props} />);
            const modal = document.querySelector('.condition-picker-modal');
            fireEvent.click(modal);
            expect(props.onCancel).not.toHaveBeenCalled();
        });
    });

    describe('apply interaction', () => {
        it('should call onApply when Apply button is clicked with selection', () => {
            render(<ConditionPicker {...props} selected="blinded" />);
            fireEvent.click(screen.getByText('Apply'));
            expect(props.onApply).toHaveBeenCalled();
        });

        it('should NOT call onApply when Apply button is clicked without selection', () => {
            render(<ConditionPicker {...props} />);
            fireEvent.click(screen.getByText('Apply'));
            expect(props.onApply).not.toHaveBeenCalled();
        });
    });

    describe('different target names', () => {
        it('should display different target names', () => {
            render(<ConditionPicker {...props} targetName="Player Character" />);
            expect(screen.getByText('Add Condition to Player Character')).toBeInTheDocument();
        });

        it('should work with empty target name', () => {
            render(<ConditionPicker {...props} targetName="" />);
            expect(screen.getByText('Add Condition to')).toBeInTheDocument();
        });
    });
});
