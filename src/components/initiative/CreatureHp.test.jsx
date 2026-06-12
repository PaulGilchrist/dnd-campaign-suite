import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CreatureHp from './CreatureHp.jsx';

vi.mock('./HpBar.jsx', () => ({
    default: vi.fn(({ current, max }) => {
        const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
        return <div data-testid="hp-bar" className="hp-bar-container"><div className="hp-bar-fill" style={{ width: `${pct}%` }} /></div>;
    }),
}));

describe('CreatureHp', () => {
    let props;

    const defaultPlayerCreature = {
        name: 'Alice',
        type: 'player',
        currentHp: 15,
        maxHp: 20,
    };

    const defaultNpcCreature = {
        name: 'Goblin',
        type: 'npc',
        currentHp: 7,
        maxHp: 7,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        props = {
            creature: defaultPlayerCreature,
            isLocalhost: true,
            onChange: vi.fn(),
        };
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    describe('NPC creatures - non-localhost', () => {
        it('should render hp-bar-row with HpBar', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(screen.getByTestId('hp-bar')).toBeInTheDocument();
        });

        it('should render hp-inline-row', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(document.querySelector('.hp-inline-row')).toBeInTheDocument();
        });

        it('should show OK status badge when healthy', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(screen.getByText('OK')).toBeInTheDocument();
        });

        it('should show BLOODIED status badge when bloodied', () => {
            const bloodiedCreature = { ...defaultNpcCreature, currentHp: 3 };
            render(<CreatureHp {...props} creature={bloodiedCreature} isLocalhost={false} />);
            expect(screen.getByText('BLOODIED')).toBeInTheDocument();
        });

        it('should show DEAD status badge when currentHp <= 0', () => {
            const deadCreature = { ...defaultNpcCreature, currentHp: 0 };
            render(<CreatureHp {...props} creature={deadCreature} isLocalhost={false} />);
            expect(screen.getByText('DEAD')).toBeInTheDocument();
        });

        it('should show DEAD status badge when currentHp < 0', () => {
            const deadCreature = { ...defaultNpcCreature, currentHp: -5 };
            render(<CreatureHp {...props} creature={deadCreature} isLocalhost={false} />);
            expect(screen.getByText('DEAD')).toBeInTheDocument();
        });

        it('should apply dead class to status badge', () => {
            const deadCreature = { ...defaultNpcCreature, currentHp: 0 };
            render(<CreatureHp {...props} creature={deadCreature} isLocalhost={false} />);
            const badge = document.querySelector('.status-badge.dead');
            expect(badge).toBeInTheDocument();
        });

        it('should apply bloodied class to status badge', () => {
            const bloodiedCreature = { ...defaultNpcCreature, currentHp: 3 };
            render(<CreatureHp {...props} creature={bloodiedCreature} isLocalhost={false} />);
            const badge = document.querySelector('.status-badge.bloodied');
            expect(badge).toBeInTheDocument();
        });

        it('should apply healthy class to status badge', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            const badge = document.querySelector('.status-badge.healthy');
            expect(badge).toBeInTheDocument();
        });

        it('should only show one status badge at a time', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            const badges = document.querySelectorAll('.status-badge');
            expect(badges.length).toBe(1);
        });

        it('should not render input fields for non-localhost NPC', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(document.querySelector('.hp-inline-input')).not.toBeInTheDocument();
        });

        it('should render creature-hp container div', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(document.querySelector('.creature-hp')).toBeInTheDocument();
        });
    });

    describe('NPC creatures - localhost', () => {
        it('should render input fields for localhost NPC', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            expect(document.querySelectorAll('.hp-inline-input').length).toBe(2);
        });

        it('should render HP label', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            expect(screen.getByText('HP')).toBeInTheDocument();
        });

        it('should render hp-sep slash', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            expect(screen.getByText('/')).toBeInTheDocument();
        });

        it('should display current HP value in input', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const currentInput = document.querySelectorAll('.hp-inline-input')[0];
            expect(currentInput).toHaveValue(7);
        });

        it('should display max HP value in input', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            expect(maxInput).toHaveValue(7);
        });

        it('should call onChange when current HP input changes', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const currentInput = document.querySelectorAll('.hp-inline-input')[0];
            fireEvent.change(currentInput, { target: { value: '5' } });
            expect(props.onChange).toHaveBeenCalledWith('Goblin', 5);
        });

        it('should call onChange with 0 when current HP input is invalid', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const currentInput = document.querySelectorAll('.hp-inline-input')[0];
            fireEvent.change(currentInput, { target: { value: 'abc' } });
            expect(props.onChange).toHaveBeenCalledWith('Goblin', 0);
        });

        it('should update creature.maxHp when max HP input changes', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            fireEvent.change(maxInput, { target: { value: '10' } });
            expect(defaultNpcCreature.maxHp).toBe(10);
        });

        it('should cap creature.currentHp to new max when current exceeds it', () => {
            const creature = { ...defaultNpcCreature, currentHp: 10, maxHp: 10 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            fireEvent.change(maxInput, { target: { value: '5' } });
            expect(creature.currentHp).toBe(5);
        });

        it('should call onChange with capped currentHp when max is reduced below current', () => {
            const creature = { ...defaultNpcCreature, currentHp: 10, maxHp: 10 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            fireEvent.change(maxInput, { target: { value: '5' } });
            expect(props.onChange).toHaveBeenCalledWith('Goblin', 5);
        });

        it('should pass maxHp=1 as default when maxHp is null', () => {
            const creature = { ...defaultNpcCreature, maxHp: null };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            expect(maxInput).toHaveValue(1);
        });

        it('should use max value 1 when maxHp input is empty', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            fireEvent.change(maxInput, { target: { value: '' } });
            expect(defaultNpcCreature.maxHp).toBe(1);
        });

        it('should set aria-label on current HP input with creature name', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const currentInput = document.querySelectorAll('.hp-inline-input')[0];
            expect(currentInput).toHaveAttribute('aria-label', 'Goblin current HP');
        });

        it('should set aria-label on max HP input with creature name', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            expect(maxInput).toHaveAttribute('aria-label', 'Goblin max HP');
        });

        it('should have min="0" on current HP input', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const currentInput = document.querySelectorAll('.hp-inline-input')[0];
            expect(currentInput).toHaveAttribute('min', '0');
        });

        it('should have min="1" on max HP input', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            expect(maxInput).toHaveAttribute('min', '1');
        });

        it('should have type="number" on both inputs', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const inputs = document.querySelectorAll('.hp-inline-input');
            expect(inputs[0]).toHaveAttribute('type', 'number');
            expect(inputs[1]).toHaveAttribute('type', 'number');
        });

        it('should apply hp-max-input class to max HP input', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            expect(maxInput).toHaveClass('hp-max-input');
        });
    });

    describe('player creatures', () => {
        it('should render input fields for player creatures', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            expect(document.querySelectorAll('.hp-inline-input').length).toBe(1);
        });

        it('should render HP label for player creatures', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            expect(screen.getByText('HP')).toBeInTheDocument();
        });

        it('should render hp-sep slash for player creatures', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            expect(screen.getByText('/')).toBeInTheDocument();
        });

        it('should display current HP value in input for player', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            expect(currentInput).toHaveValue(15);
        });

        it('should NOT render a max HP input for player creatures', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            expect(document.querySelector('.hp-max-input')).not.toBeInTheDocument();
        });

        it('should render max HP as a span value for player creatures', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            expect(screen.getByText('20')).toBeInTheDocument();
        });

        it('should have hp-max-val class on max HP span', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const maxVal = document.querySelector('.hp-max-val');
            expect(maxVal).toBeInTheDocument();
        });

        it('should call onChange when current HP input changes for player', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            fireEvent.change(currentInput, { target: { value: '10' } });
            expect(props.onChange).toHaveBeenCalledWith('Alice', 10);
        });

        it('should call onChange with 0 when current HP input is invalid for player', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            fireEvent.change(currentInput, { target: { value: 'xyz' } });
            expect(props.onChange).toHaveBeenCalledWith('Alice', 0);
        });

        it('should set aria-label on current HP input with creature name for player', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            expect(currentInput).toHaveAttribute('aria-label', 'Alice current HP');
        });

        it('should have min="0" on player current HP input', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            expect(currentInput).toHaveAttribute('min', '0');
        });

        it('should have type="number" on player current HP input', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            expect(currentInput).toHaveAttribute('type', 'number');
        });
    });

    describe('HpBar behavior', () => {
        it('should pass current and max HP to HpBar for player creatures', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            expect(screen.getByTestId('hp-bar')).toBeInTheDocument();
        });

        it('should pass current and max HP to HpBar for NPC creatures', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(screen.getByTestId('hp-bar')).toBeInTheDocument();
        });

        it('should pass current and max HP to HpBar for localhost NPC', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            expect(screen.getByTestId('hp-bar')).toBeInTheDocument();
        });
    });

    describe('null/undefined handling', () => {
        it('should default currentHp to 0 when null', () => {
            const creature = { ...defaultPlayerCreature, currentHp: null };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            expect(currentInput).toHaveValue(0);
        });

        it('should default maxHp to 1 when null for player', () => {
            const creature = { ...defaultPlayerCreature, maxHp: null };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            expect(screen.getByText('1')).toBeInTheDocument();
        });

        it('should default maxHp to 1 when null for NPC localhost', () => {
            const creature = { ...defaultNpcCreature, maxHp: null };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            expect(maxInput).toHaveValue(1);
        });

        it('should default currentHp to 0 when undefined', () => {
            const creature = { ...defaultPlayerCreature, currentHp: undefined };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            expect(currentInput).toHaveValue(0);
        });

        it('should default maxHp to 1 when undefined', () => {
            const creature = { ...defaultPlayerCreature, maxHp: undefined };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            expect(screen.getByText('1')).toBeInTheDocument();
        });
    });

    describe('bloodied threshold', () => {
        it('should show BLOODIED when currentHp equals half maxHp', () => {
            const creature = { ...defaultNpcCreature, currentHp: 10, maxHp: 20 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText('BLOODIED')).toBeInTheDocument();
        });

        it('should show BLOODIED when currentHp is one below half maxHp', () => {
            const creature = { ...defaultNpcCreature, currentHp: 9, maxHp: 20 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText('BLOODIED')).toBeInTheDocument();
        });

        it('should show OK when currentHp is one above half maxHp', () => {
            const creature = { ...defaultNpcCreature, currentHp: 11, maxHp: 20 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText('OK')).toBeInTheDocument();
        });

        it('should use Math.floor for bloodied threshold calculation', () => {
            const creature = { ...defaultNpcCreature, currentHp: 3, maxHp: 7 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            // Math.floor(7/2) = 3, so 3 <= 3 means bloodied
            expect(screen.getByText('BLOODIED')).toBeInTheDocument();
        });

        it('should show OK when currentHp equals Math.floor(maxHp/2) + 1', () => {
            const creature = { ...defaultNpcCreature, currentHp: 4, maxHp: 7 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            // Math.floor(7/2) = 3, so 4 > 3 means not bloodied
            expect(screen.getByText('OK')).toBeInTheDocument();
        });
    });

    describe('dead threshold', () => {
        it('should show DEAD when currentHp is exactly 0', () => {
            const creature = { ...defaultNpcCreature, currentHp: 0 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText('DEAD')).toBeInTheDocument();
        });

        it('should show DEAD when currentHp is negative', () => {
            const creature = { ...defaultNpcCreature, currentHp: -1 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText('DEAD')).toBeInTheDocument();
        });

        it('should show DEAD when currentHp is -100', () => {
            const creature = { ...defaultNpcCreature, currentHp: -100 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText('DEAD')).toBeInTheDocument();
        });

        it('should show OK when currentHp is 1', () => {
            const creature = { ...defaultNpcCreature, currentHp: 1 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText('OK')).toBeInTheDocument();
        });
    });

    describe('render structure', () => {
        it('should render hp-bar-row div', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(document.querySelector('.hp-bar-row')).toBeInTheDocument();
        });

        it('should render hp-inline-row div', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(document.querySelector('.hp-inline-row')).toBeInTheDocument();
        });

        it('should render hp-status span for non-localhost NPC', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(document.querySelector('.hp-status')).toBeInTheDocument();
        });

        it('should not render hp-status span for localhost NPC', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            expect(document.querySelector('.hp-status')).not.toBeInTheDocument();
        });

        it('should not render hp-status span for player', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            expect(document.querySelector('.hp-status')).not.toBeInTheDocument();
        });
    });
});
