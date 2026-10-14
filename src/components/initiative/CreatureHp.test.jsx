import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreatureHp from './CreatureHp.jsx';

vi.mock('./HpBar.jsx', () => ({
    default: vi.fn(() => <div data-testid="hp-bar" />),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    useRuntimeValue: vi.fn(() => null),
}));

import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

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

    describe('NPC summoned creatures - non-localhost', () => {
        it('should show HP text without status badges for summoned creatures', () => {
            const creature = { ...defaultNpcCreature, currentHp: 3, maxHp: 7 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} isPlayerSummoned={true} />);
            expect(screen.getByText('HP')).toBeInTheDocument();
            expect(screen.getByText('3/7')).toBeInTheDocument();
            expect(screen.queryByText('BLOODIED')).not.toBeInTheDocument();
        });
    });

    describe('NPC creatures - localhost', () => {
        it.each`
            inputValue | expectedCurrent | expectedCall
            ${'5'}     | ${5}            | ${['Goblin', 5]}
            ${'abc'}   | ${0}            | ${['Goblin', 0]}
        `('should call onChange with $expectedCall when current HP input is "$inputValue"', ({ inputValue, expectedCall }) => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const currentInput = document.querySelectorAll('.hp-inline-input')[0];
            currentInput.value = inputValue;
            fireEvent.blur(currentInput);
            expect(props.onChange).toHaveBeenCalledWith(...expectedCall);
        });

        it('should call onChange when max HP input blurs below current', () => {
            const creature = { ...defaultNpcCreature, currentHp: 10, maxHp: 10 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            maxInput.value = '5';
            fireEvent.blur(maxInput);
            expect(props.onChange).toHaveBeenCalledWith('Goblin', 5);
        });

        it('should pass negative values through unchanged (no clamping)', () => {
            render(<CreatureHp {...props} creature={defaultNpcCreature} isLocalhost={true} />);
            const currentInput = document.querySelectorAll('.hp-inline-input')[0];
            currentInput.value = '-5';
            fireEvent.blur(currentInput);
            expect(props.onChange).toHaveBeenCalledWith('Goblin', -5);
        });
    });

    describe('player creatures - localhost', () => {
        it.each`
            inputValue | expectedCall
            ${'10'}    | ${['Alice', 10]}
            ${'xyz'}   | ${['Alice', 0]}
        `('should call onChange with $expectedCall when current HP input is "$inputValue"', ({ inputValue, expectedCall }) => {
            render(<CreatureHp {...props} creature={defaultPlayerCreature} isLocalhost={true} />);
            const currentInput = document.querySelector('.hp-inline-input');
            currentInput.value = inputValue;
            fireEvent.blur(currentInput);
            expect(props.onChange).toHaveBeenCalledWith(...expectedCall);
        });

        it('should display max HP as a non-editable span', () => {
            render(<CreatureHp {...props} creature={defaultPlayerCreature} isLocalhost={true} />);
            expect(screen.getByText('HP')).toBeInTheDocument();
            expect(screen.getByText('20')).toBeInTheDocument();
            const currentInput = document.querySelector('.hp-inline-input');
            expect(currentInput).toBeInTheDocument();
            expect(currentInput.value).toBe('15');
        });
    });

    describe('player creatures - non-localhost', () => {
        it('should show HP text without editable inputs', () => {
            render(<CreatureHp {...props} isLocalhost={false} />);
            expect(screen.getByText('HP')).toBeInTheDocument();
            expect(screen.getByText('15/20')).toBeInTheDocument();
            expect(document.querySelector('.hp-inline-input')).not.toBeInTheDocument();
        });
    });

    describe('missing HP values fallback', () => {
        it('should default currentHp to 0 when undefined (localhost, shows editable)', () => {
            const creature = { ...defaultNpcCreature, currentHp: undefined, maxHp: 10 };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const currentInput = document.querySelectorAll('.hp-inline-input')[0];
            expect(currentInput).toBeInTheDocument();
            expect(currentInput.value).toBe('0');
        });

        it('should default maxHp to 1 when undefined (localhost, shows editable)', () => {
            const creature = { ...defaultNpcCreature, currentHp: 5, maxHp: undefined };
            render(<CreatureHp {...props} creature={creature} isLocalhost={true} />);
            const maxInput = document.querySelectorAll('.hp-inline-input')[1];
            expect(maxInput).toBeInTheDocument();
            expect(maxInput.value).toBe('1');
        });

        it('should default both to 0/1 when both are undefined (non-localhost shows DEAD)', () => {
            const creature = { ...defaultNpcCreature, currentHp: undefined, maxHp: undefined };
            render(<CreatureHp {...props} creature={creature} isLocalhost={false} />);
            expect(screen.getByText('DEAD')).toBeInTheDocument();
        });
    });

    describe('runtime HP max increases (Aid, Heroes Feast)', () => {
        beforeEach(() => {
            vi.clearAllMocks();
            useRuntimeValue.mockReturnValue(null);
        });

        it('displays effective max HP with aidHpMaxIncrease for player creature (localhost)', () => {
            useRuntimeValue.mockImplementation((_, prop) => {
                if (prop === 'aidHpMaxIncrease') return 5;
                return null;
            });

            render(<CreatureHp {...props} creature={defaultPlayerCreature} isLocalhost={true} />);
            expect(screen.getByText('25')).toBeInTheDocument();
        });

        it('displays effective max HP with aidHpMaxIncrease for player creature (non-localhost)', () => {
            useRuntimeValue.mockImplementation((_, prop) => {
                if (prop === 'aidHpMaxIncrease') return 5;
                return null;
            });

            render(<CreatureHp {...props} creature={defaultPlayerCreature} isLocalhost={false} />);
            expect(screen.getByText('15/25')).toBeInTheDocument();
        });

        it('displays effective max HP with both aid and heroesFeast increases', () => {
            useRuntimeValue.mockImplementation((_, prop) => {
                if (prop === 'aidHpMaxIncrease') return 5;
                if (prop === 'heroesFeastHpMaxIncrease') return 3;
                return null;
            });

            render(<CreatureHp {...props} creature={defaultPlayerCreature} isLocalhost={false} />);
            expect(screen.getByText('15/28')).toBeInTheDocument();
        });

        it('displays effective max HP for NPC non-localhost with aid', () => {
            useRuntimeValue.mockImplementation((_, prop) => {
                if (prop === 'aidHpMaxIncrease') return 5;
                return null;
            });

            const npcCreature = { ...defaultNpcCreature, currentHp: 7, maxHp: 7 };
            render(<CreatureHp {...props} creature={npcCreature} isLocalhost={false} />);
            expect(screen.getByText('OK')).toBeInTheDocument();
        });

        it('displays effective max HP for summoned creature with aid', () => {
            useRuntimeValue.mockImplementation((_, prop) => {
                if (prop === 'aidHpMaxIncrease') return 5;
                return null;
            });

            const npcCreature = { ...defaultNpcCreature, currentHp: 7, maxHp: 7 };
            render(<CreatureHp {...props} creature={npcCreature} isLocalhost={false} isPlayerSummoned={true} />);
            expect(screen.getByText('7/12')).toBeInTheDocument();
        });

        it('uses effective max HP for bloodied threshold calculation', () => {
            useRuntimeValue.mockImplementation((_, prop) => {
                if (prop === 'aidHpMaxIncrease') return 10;
                return null;
            });

            const npcCreature = { ...defaultNpcCreature, currentHp: 8, maxHp: 7 };
            render(<CreatureHp {...props} creature={npcCreature} isLocalhost={false} />);
            expect(screen.getByText('BLOODIED')).toBeInTheDocument();
        });

        it('shows base max HP when no runtime increases are active', () => {
            useRuntimeValue.mockReturnValue(null);

            render(<CreatureHp {...props} creature={defaultPlayerCreature} isLocalhost={false} />);
            expect(screen.getByText('15/20')).toBeInTheDocument();
        });
    });
});
