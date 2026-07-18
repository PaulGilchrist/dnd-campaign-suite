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
            ${0}      | ${7}    | ${'DEAD'}
            ${3}      | ${7}    | ${'BLOODIED'}
            ${11}     | ${20}   | ${'OK'}
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
            fireEvent.blur(currentInput, { target: { value: inputValue } });
            expect(props.onChange).toHaveBeenCalledWith(...expectedCall);
        });

        it('should update creature.maxHp and cap currentHp when max HP input blurs below current', () => {
            const creature = { ...defaultNpcCreature, currentHp: 10, maxHp: 10 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            fireEvent.blur(maxInput, { target: { value: '5' } });
            expect(props.onChange).toHaveBeenCalledWith('Goblin', 5);
        });
    });

    describe('player creatures - localhost', () => {
        it.each`
            inputValue | expectedCall
            ${'10'}    | ${['Alice', 10]}
            ${'xyz'}   | ${['Alice', 0]}
        `('should call onChange with $expectedCall when current HP input is "$inputValue"', ({ inputValue, expectedCall }) => {
            render(<CreatureHp {...props} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            fireEvent.blur(currentInput, { target: { value: inputValue } });
            expect(props.onChange).toHaveBeenCalledWith(...expectedCall);
        });
    });
});
