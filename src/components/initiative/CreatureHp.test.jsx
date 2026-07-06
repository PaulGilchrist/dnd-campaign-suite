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
        it.each`
            currentHp | maxHp   | expectedStatus
            ${7}      | ${7}    | ${'OK'}
            ${3}      | ${7}    | ${'BLOODIED'}
            ${10}     | ${20}   | ${'BLOODIED'}
            ${11}     | ${20}   | ${'OK'}
            ${9}      | ${20}   | ${'BLOODIED'}
            ${4}      | ${7}    | ${'OK'}
            ${0}      | ${7}    | ${'DEAD'}
            ${-5}     | ${7}    | ${'DEAD'}
        `('should show $expectedStatus status badge when currentHp is $currentHp / maxHp $maxHp', ({ currentHp, maxHp, expectedStatus }) => {
            const creature = { ...defaultNpcCreature, currentHp, maxHp };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText(expectedStatus)).toBeInTheDocument();
        });
    });

    describe('NPC creatures - localhost', () => {
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
            expect(props.onChange).toHaveBeenCalledWith('Goblin', 5);
        });
    });

    describe('player creatures', () => {
        it('should render readonly HP display for non-localhost player', () => {
            render(<CreatureHp {...props} isLocalhost={false} />);
            expect(screen.getByText('15/20')).toBeInTheDocument();
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
