// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
        props = {
            creature: defaultPlayerCreature,
            isLocalhost: true,
            onChange: vi.fn(),
        };
    });

    describe('NPC creatures - non-localhost', () => {
        it('should render hp-bar, hp-inline-row, and creature-hp container', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(screen.getByTestId('hp-bar')).toBeInTheDocument();
            expect(document.querySelector('.hp-inline-row')).toBeInTheDocument();
            expect(document.querySelector('.creature-hp')).toBeInTheDocument();
        });

        it('should render no input fields for non-localhost NPC', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={false} />);
            expect(document.querySelector('.hp-inline-input')).not.toBeInTheDocument();
        });

        it.each`
            currentHp | expectedStatus
            ${7}      | ${'OK'}
            ${3}      | ${'BLOODIED'}
            ${0}      | ${'DEAD'}
            ${-5}     | ${'DEAD'}
        `('should show $expectedStatus status badge when currentHp is $currentHp', ({ currentHp, expectedStatus }) => {
            const creature = { ...defaultNpcCreature, currentHp };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText(expectedStatus)).toBeInTheDocument();
        });
    });

    describe('NPC creatures - localhost', () => {
        it('should render hp-bar, hp-inline-row, HP label, slash, and two inputs', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            expect(screen.getByTestId('hp-bar')).toBeInTheDocument();
            expect(screen.getByText('HP')).toBeInTheDocument();
            expect(screen.getByText('/')).toBeInTheDocument();
            expect(document.querySelectorAll('.hp-inline-input').length).toBe(2);
        });

        it.each`
            field          | expectedValue
            ${'currentHp'} | ${7}
            ${'maxHp'}     | ${7}
        `('should display $field value in input', ({ field, expectedValue }) => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const idx = field === 'currentHp' ? 0 : 1;
            expect(document.querySelectorAll('.hp-inline-input')[idx]).toHaveValue(expectedValue);
        });

        it.each`
            inputValue | expectedCall
            ${'5'}     | ${['Goblin', 5]}
            ${'abc'}   | ${['Goblin', 0]}
        `('should call onChange with $expectedCall when current HP input is "$inputValue"', ({ inputValue, expectedCall }) => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const currentInput = document.querySelectorAll('.hp-inline-input')[0];
            fireEvent.change(currentInput, { target: { value: inputValue } });
            expect(props.onChange).toHaveBeenCalledWith(...expectedCall);
        });

        it('should update creature.maxHp and cap currentHp when max HP input decreases below current', () => {
            const creature = { ...defaultNpcCreature, currentHp: 10, maxHp: 10 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            fireEvent.change(maxInput, { target: { value: '5' } });
            expect(creature.maxHp).toBe(5);
            expect(creature.currentHp).toBe(5);
            expect(props.onChange).toHaveBeenCalledWith('Goblin', 5);
        });

        it('should default maxHp to 1 when null', () => {
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

        it.each`
            field          | expectedAriaLabel             | expectedMin | expectedClass
            ${'currentHp'} | ${'Goblin current HP'}        | ${'0'}      | ${''}
            ${'maxHp'}     | ${'Goblin max HP'}            | ${'1'}      | ${'hp-max-input'}
        `('should set aria-label, min, and class on $field input', ({ expectedAriaLabel, expectedMin, expectedClass }) => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const idx = expectedAriaLabel.includes('current') ? 0 : 1;
            const input = document.querySelectorAll('.hp-inline-input')[idx];
            expect(input).toHaveAttribute('aria-label', expectedAriaLabel);
            expect(input).toHaveAttribute('min', expectedMin);
            expect(input).toHaveAttribute('type', 'number');
            if (expectedClass) {
                expect(input).toHaveClass(expectedClass);
            }
        });
    });

    describe('player creatures', () => {
        it('should render hp-bar, hp-inline-row, HP label, slash, current input, and max span for localhost', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            expect(screen.getByTestId('hp-bar')).toBeInTheDocument();
            expect(screen.getByText('HP')).toBeInTheDocument();
            expect(screen.getByText('/')).toBeInTheDocument();
            expect(document.querySelector('.hp-inline-input')).toBeInTheDocument();
            expect(screen.getByText('20')).toBeInTheDocument();
        });

        it('should render readonly HP display for non-localhost player', () => {
            render(<CreatureHp {...props} isLocalhost={false} />);
            expect(screen.getByTestId('hp-bar')).toBeInTheDocument();
            expect(document.querySelector('.hp-inline-input')).not.toBeInTheDocument();
            expect(screen.getByText('15/20')).toBeInTheDocument();
        });

        it('should not render hp-status span or max input for player', () => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            expect(document.querySelector('.hp-status')).not.toBeInTheDocument();
            expect(document.querySelector('.hp-max-input')).not.toBeInTheDocument();
        });

        it.each`
            inputValue | expectedCall
            ${'10'}    | ${['Alice', 10]}
            ${'xyz'}   | ${['Alice', 0]}
        `('should call onChange with $expectedCall when current HP input is "$inputValue" for localhost', ({ inputValue, expectedCall }) => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            fireEvent.change(currentInput, { target: { value: inputValue } });
            expect(props.onChange).toHaveBeenCalledWith(...expectedCall);
        });

        it.each`
            attribute    | expectedValue
            ${'aria-label'} | ${'Alice current HP'}
            ${'min'}        | ${'0'}
            ${'type'}       | ${'number'}
        `('should set $attribute on player current HP input for localhost', ({ attribute, expectedValue }) => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            expect(currentInput).toHaveAttribute(attribute, expectedValue);
        });
    });

    describe('null/undefined handling', () => {
        it.each`
            field        | creatureValue | expectedDisplay | inputSelector
            ${'currentHp'} | ${null}      | ${0}            | ${'.hp-inline-input'}
            ${'currentHp'} | ${undefined} | ${0}            | ${'.hp-inline-input'}
            ${'maxHp'}     | ${null}      | ${1}            | ${null}
            ${'maxHp'}     | ${undefined} | ${1}            | ${null}
        `('should default $field to $expectedDisplay when $creatureValue', ({ field, creatureValue, expectedDisplay, inputSelector }) => {
            const creature = field === 'currentHp'
                ? { ...defaultPlayerCreature, currentHp: creatureValue }
                : { ...defaultPlayerCreature, maxHp: creatureValue };
            if (inputSelector) {
                render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
                expect(document.querySelector(inputSelector)).toHaveValue(expectedDisplay);
            } else {
                render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
                expect(screen.getByText(String(expectedDisplay))).toBeInTheDocument();
            }
        });
    });

    describe('bloodied threshold', () => {
        it.each`
            currentHp | maxHp | expectedStatus
            ${10}     | ${20} | ${'BLOODIED'}
            ${9}      | ${20} | ${'BLOODIED'}
            ${11}     | ${20} | ${'OK'}
            ${3}      | ${7}  | ${'BLOODIED'}
            ${4}      | ${7}  | ${'OK'}
        `('should show $expectedStatus when currentHp=$currentHp maxHp=$maxHp', ({ currentHp, maxHp, expectedStatus }) => {
            const creature = { ...defaultNpcCreature, currentHp, maxHp };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText(expectedStatus)).toBeInTheDocument();
        });
    });

    describe('render structure', () => {
        it.each`
            creatureType  | isLocalhost | hasHpStatus
            ${'npc'}      | ${false}    | ${true}
            ${'npc'}      | ${true}     | ${false}
            ${'player'}   | ${true}     | ${false}
        `('should $hasHpStatus hp-status span for $creatureType (isLocalhost: $isLocalhost)', ({ creatureType, isLocalhost, hasHpStatus }) => {
            const creature = creatureType === 'player' ? defaultPlayerCreature : defaultNpcCreature;
            render(<CreatureHp {...props} creature={creature} isLocalhost={isLocalhost} />);
            if (hasHpStatus) {
                expect(document.querySelector('.hp-status')).toBeInTheDocument();
            } else {
                expect(document.querySelector('.hp-status')).not.toBeInTheDocument();
            }
        });
    });
});
