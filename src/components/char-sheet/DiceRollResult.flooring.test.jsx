import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('d20 floor 10 / Trance of Order', () => {
        it.each`
            rollType   | rolls  | bonus | modifier | expectedTotal
            ${'check'} | ${[7]} | ${4}  | ${0}     | ${'14'}
            ${'save'}  | ${[3]} | ${2}  | ${0}     | ${'12'}
            ${'attack'}| ${[5]} | ${3}  | ${0}     | ${'13'}
            ${'skill'} | ${[9]} | ${2}  | ${0}     | ${'12'}
        `('shows floor message and uses 10 + bonus + modifier when d20Floor10 is true and d20 $rolls[0] <= 9 (rollType: $rollType)', ({ rollType, rolls, bonus, modifier, expectedTotal }) => {
            render(
                <DiceRollResult
                    name={rollType === 'check' ? 'Wisdom' : rollType === 'save' ? 'DEX Save' : rollType === 'attack' ? 'Attack' : 'Stealth'}
                    type="d20"
                    rolls={rolls}
                    bonus={bonus}
                    modifier={modifier}
                    rollType={rollType}
                    d20Floor10={true}
                />
            );
            expect(screen.getByText(expectedTotal)).toBeInTheDocument();
            expect(screen.getByText(new RegExp(`Trance of Order: d20 ${rolls[0]} → 10`))).toBeInTheDocument();
        });

        it('keeps normal total when d20Floor10 and roll > 9', () => {
            render(
                <DiceRollResult
                    name="Wisdom"
                    type="d20"
                    rolls={[14]}
                    bonus={4}
                    rollType="check"
                    d20Floor10={true}
                />
            );
            expect(screen.getByText('18')).toBeInTheDocument();
            expect(screen.queryByText(/Trance of Order/)).not.toBeInTheDocument();
        });

        it('does not floor when d20Floor10 is false', () => {
            render(
                <DiceRollResult
                    name="Wisdom"
                    type="d20"
                    rolls={[7]}
                    bonus={4}
                    rollType="check"
                    d20Floor10={false}
                />
            );
            expect(screen.getByText('11')).toBeInTheDocument();
        });

        it('does not floor at boundary value of 10', () => {
            render(
                <DiceRollResult
                    name="Wisdom"
                    type="d20"
                    rolls={[10]}
                    bonus={4}
                    rollType="check"
                    d20Floor10={true}
                />
            );
            expect(screen.getByText('14')).toBeInTheDocument();
            expect(screen.queryByText(/Trance of Order/)).not.toBeInTheDocument();
        });

        it('does not floor when d20Floor10 is undefined (treated as falsy)', () => {
            render(
                <DiceRollResult
                    name="Wisdom"
                    type="d20"
                    rolls={[7]}
                    bonus={4}
                    rollType="check"
                />
            );
            expect(screen.getByText('11')).toBeInTheDocument();
            expect(screen.queryByText(/Trance of Order/)).not.toBeInTheDocument();
        });

        it('shows floor indicator for condition-save rollType when roll <= 9', () => {
            render(
                <DiceRollResult
                    name="Stunned Save"
                    type="d20"
                    rolls={[4]}
                    bonus={2}
                    rollType="condition-save"
                    d20Floor10={true}
                />
            );
            expect(screen.getByText('12')).toBeInTheDocument();
            expect(screen.getByText(/Trance of Order: d20 4 → 10/)).toBeInTheDocument();
        });

        it('does not show floor indicator for condition-save rollType when roll > 9', () => {
            render(
                <DiceRollResult
                    name="Stunned Save"
                    type="d20"
                    rolls={[15]}
                    bonus={4}
                    rollType="condition-save"
                    d20Floor10={true}
                />
            );
            expect(screen.getByText('19')).toBeInTheDocument();
            expect(screen.queryByText(/Trance of Order/)).not.toBeInTheDocument();
        });

        it('shows floor indicator when stroke of luck is used (safeRolls[0] still <= 9)', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="attack"
                    d20Floor10={true}
                    strokeOfLuck={true}
                />
            );
            fireEvent.click(screen.getByText(/Stroke of Luck/));
            expect(container.querySelector('.dice-roll-reliable-talent')).toBeInTheDocument();
            expect(container.querySelector('.dice-roll-total').textContent).toBe('23');
        });

        it('shows floor indicator when autoReroll is used (safeRolls[0] still <= 9)', () => {
            const { container } = render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="attack"
                    d20Floor10={true}
                    autoReroll={true}
                />
            );
            fireEvent.click(screen.getByText(/Reroll/));
            expect(container.querySelector('.dice-roll-reliable-talent')).toBeInTheDocument();
        });

        it('shows floor indicator when bardic inspiration is used (safeRolls[0] still <= 9)', () => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="check"
                    d20Floor10={true}
                    bardicInspiration={true}
                    bardicInspirationDie="d6"
                />
            );
            fireEvent.click(screen.getByText(/Bardic Inspiration/));
            expect(container.querySelector('.dice-roll-reliable-talent')).toBeInTheDocument();
            expect(screen.getByText(/Trance of Order: d20 5 → 10/)).toBeInTheDocument();
        });
    });
});
