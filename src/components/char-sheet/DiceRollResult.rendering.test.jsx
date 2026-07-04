// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('basic rendering', () => {
        it('renders name and total for a basic d20 roll', () => {
            render(
                <DiceRollResult
                    name="Attack Roll"
                    type="d20"
                    rolls={[12, 8]}
                    bonus={3}
                    modifier={0}
                />
            );

            expect(screen.getByText('Attack Roll')).toBeInTheDocument();
            expect(screen.getByText('15')).toBeInTheDocument();
        });

        it.each`
            type           | iconClass
            ${'attack'}    | ${'fa-crosshairs'}
            ${'save'}      | ${'fa-shield-halved'}
            ${'save-damage'} | ${'fa-shield-halved'}
            ${'initiative'}| ${'fa-gavel'}
            ${'damage'}    | ${'fa-bolt'}
        `('renders correct icon class for type: $type', ({ type, iconClass }) => {
            const { container } = render(
                <DiceRollResult name="Roll" type={type} rolls={[15]} bonus={2} />
            );
            expect(container.querySelector(`.${iconClass}`)).toBeInTheDocument();
        });
    });

    describe('totals', () => {
        it.each`
            rolls       | bonus | modifier | expected
            ${[10]}     | ${5}  | ${0}     | ${15}
            ${[12]}     | ${2}  | ${3}     | ${17}
            ${[10]}     | ${0}  | ${-3}    | ${7}
            ${[10]}     | ${-2} | ${0}     | ${8}
        `('shows correct total with rolls: $rolls, bonus: $bonus, modifier: $modifier', ({ rolls, bonus, modifier, expected }) => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={rolls} bonus={bonus} modifier={modifier} />
            );
            expect(screen.getByText(String(expected))).toBeInTheDocument();
        });

        it('shows total prop for damage type (uses total directly instead of calculating)', () => {
            render(
                <DiceRollResult name="Test" type="damage" rolls={[6, 4]} bonus={0} total={10} modifier={3} />
            );
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it.each`
            rolls          | type     | bonus | expected
            ${null}        | ${'d20'} | ${0}  | ${'0'}
            ${undefined}   | ${'d20'} | ${5}  | ${'5'}
            ${[]}          | ${'d20'} | ${3}  | ${'3'}
        `('handles rolls: $rolls gracefully with type: $type', ({ rolls, type, bonus, expected }) => {
            const { container } = render(
                <DiceRollResult name="Test" type={type} rolls={rolls} bonus={bonus} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe(expected);
        });

        it('handles empty rolls for damage type using total prop', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="damage" rolls={[]} bonus={0} total={5} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('5');
        });
    });

    describe('advantage and disadvantage', () => {
        it('uses first roll in normal mode', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('10');
        });

        it('toggles to advantage when clicked', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText('Advantage'));
            expect(screen.getByText('17')).toBeInTheDocument();
        });

        it('toggles to disadvantage when clicked', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText('Disadvantage'));
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('toggles advantage off when clicked again', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            const advButton = screen.getByLabelText(/Advantage/);
            fireEvent.click(advButton);
            expect(screen.getByText('17')).toBeInTheDocument();

            fireEvent.click(advButton);
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it('switches from advantage to disadvantage', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText(/Advantage/));
            expect(screen.getByText('17')).toBeInTheDocument();

            fireEvent.click(screen.getByLabelText(/Disadvantage/));
            expect(screen.getByText('10')).toBeInTheDocument();
        });

        it.each`
            forcedMode     | rangeReason
            ${'advantage'} | ${'Ranged disadvantage'}
            ${'disadvantage'} | ${null}
        `('shows forced mode badge with reason: $rangeReason', ({ forcedMode, rangeReason }) => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} forcedMode={forcedMode} rangeReason={rangeReason} />
            );
            const badge = container.querySelector('.forced-mode-badge');
            expect(badge).toBeInTheDocument();
            if (rangeReason) {
                expect(badge.textContent).toContain(rangeReason);
            } else {
                expect(badge.getAttribute('title')).toBe('Automatically set by active conditions');
            }
        });
    });

    describe('non-d20 types', () => {
        it('does NOT show advantage/disadvantage toggles for non-d20 types', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4, 3, 2, 1]} bonus={0} />
            );
            expect(screen.queryByLabelText(/Advantage/)).not.toBeInTheDocument();
            expect(screen.queryByLabelText(/Disadvantage/)).not.toBeInTheDocument();
        });

        it('shows sum of all rolls for non-d20 type', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} total={15} />
            );
            expect(screen.getByText('15')).toBeInTheDocument();
        });

        it('shows rolls separated by commas in breakdown for non-d20 type', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} />
            );
            expect(screen.getByText(/6, 5, 4/)).toBeInTheDocument();
        });
    });

    describe('critical hit', () => {
        it.each`
            rolls        | isAutoCrit | expected
            ${[20, 5]}   | ${false}   | ${true}
            ${[5, 3]}    | ${true}    | ${true}
        `('shows "Critical Hit!" when roll is 20 or isAutoCrit is true', ({ rolls, isAutoCrit }) => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={rolls} bonus={3} isAutoCrit={isAutoCrit} />
            );
            expect(screen.getByText(/Critical Hit!/)).toBeInTheDocument();
            expect(screen.getByText(/damage dice doubled/)).toBeInTheDocument();
        });

        it.each`
            rolls        | type       | name
            ${[19, 5]}   | ${'d20'}   | ${'Attack'}
            ${[20]}      | ${'damage'}| ${'Damage'}
            ${[20]}      | ${'save'}  | ${'DEX Save'}
        `('does NOT show "Critical Hit!" for rolls: $rolls, type: $type', ({ rolls, type }) => {
            render(
                <DiceRollResult name="Roll" type={type} rolls={rolls} bonus={3} />
            );
            expect(screen.queryByText(/Critical Hit!/)).not.toBeInTheDocument();
        });
    });

    describe('critical miss', () => {
        it('shows "Critical Miss!" when isNatural1 is true and rollType is attack', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[1, 15]} bonus={3} rollType="attack" isNatural1={true} />
            );
            expect(screen.getByText('Critical Miss!')).toBeInTheDocument();
        });

        it.each`
            rollType       | name
            ${'initiative'}| ${'Initiative'}
            ${'check'}     | ${'Athletics'}
            ${'skill'}     | ${'Stealth'}
            ${'save'}      | ${'DEX Save'}
        `('does NOT show "Critical Miss!" for rollType: $name', ({ rollType }) => {
            render(
                <DiceRollResult name={rollType} type="d20" rolls={[1, 10]} bonus={2} rollType={rollType} isNatural1={true} />
            );
            expect(screen.queryByText('Critical Miss!')).not.toBeInTheDocument();
        });
    });
});
