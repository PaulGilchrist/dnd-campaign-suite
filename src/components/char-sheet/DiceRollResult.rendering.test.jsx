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

        it('renders correct icon class for attack type', () => {
            const { container } = render(
                <DiceRollResult name="Sword" type="attack" rolls={[15]} bonus={2} />
            );
            expect(container.querySelector('.fa-crosshairs')).toBeInTheDocument();
        });

        it('renders correct icon class for save type', () => {
            const { container } = render(
                <DiceRollResult name="DEX Save" type="save" rolls={[14]} bonus={1} />
            );
            expect(container.querySelector('.fa-shield-halved')).toBeInTheDocument();
        });

        it('renders correct icon class for initiative type', () => {
            const { container } = render(
                <DiceRollResult name="Initiative" type="initiative" rolls={[18]} bonus={2} />
            );
            expect(container.querySelector('.fa-gavel')).toBeInTheDocument();
        });

        it('renders correct icon class for damage type', () => {
            const { container } = render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 6, 6]} bonus={0} />
            );
            expect(container.querySelector('.fa-bolt')).toBeInTheDocument();
        });

        it('renders correct icon class for save-damage type', () => {
            const { container } = render(
                <DiceRollResult name="Poison Cloud" type="save-damage" rolls={[5]} bonus={0} />
            );
            expect(container.querySelector('.fa-shield-halved')).toBeInTheDocument();
        });

        it('renders default icon class for unknown type', () => {
            const { container } = render(
                <DiceRollResult name="Weird" type="custom" rolls={[5]} bonus={0} />
            );
            expect(container.querySelector('.fa-bolt')).toBeInTheDocument();
        });
    });

    describe('totals', () => {
        it('shows correct total with bonus', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={5} modifier={0} />
            );
            expect(screen.getByText('15')).toBeInTheDocument();
        });

        it('shows correct total with modifier', () => {
            render(
                <DiceRollResult name="Test" type="damage" rolls={[6, 4]} bonus={0} modifier={3} />
            );
            expect(screen.getByText('13')).toBeInTheDocument();
        });

        it('shows correct total with both bonus and modifier', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[12]} bonus={2} modifier={3} />
            );
            expect(screen.getByText('17')).toBeInTheDocument();
        });

        it('shows correct total with negative modifier', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} modifier={-3} />
            );
            expect(screen.getByText('7')).toBeInTheDocument();
        });

        it('shows correct total with negative bonus', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={-2} modifier={0} />
            );
            expect(screen.getByText('8')).toBeInTheDocument();
        });

        it('handles null rolls gracefully', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={null} bonus={0} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('0');
        });

        it('handles undefined rolls gracefully', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={undefined} bonus={5} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('5');
        });

        it('handles empty rolls array for d20', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={[]} bonus={3} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('3');
        });

        it('handles empty rolls array for non-d20', () => {
            const { container } = render(
                <DiceRollResult name="Test" type="damage" rolls={[]} bonus={5} />
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

        it('uses max of two rolls when advantage is toggled', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText(/Advantage/));
            expect(screen.getByText('17')).toBeInTheDocument();
        });

        it('uses min of two rolls when disadvantage is toggled', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText(/Disadvantage/));
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

        it('uses first roll when both rolls are provided in normal mode', () => {
            const { container } = render(
                <DiceRollResult name="Check" type="d20" rolls={[3, 17]} bonus={0} />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('3');
        });

        it('shows advantage badge as active when forcedMode is advantage', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} forcedMode="advantage" />
            );
            expect(container.querySelector('.badge-toggle.active')).toBeInTheDocument();
        });

        it('shows disadvantage badge as active when forcedMode is disadvantage', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} forcedMode="disadvantage" />
            );
            expect(container.querySelector('.badge-toggle.active')).toBeInTheDocument();
        });

        it('shows forced mode badge with reason text', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} forcedMode="advantage" rangeReason="Ranged disadvantage" />
            );
            expect(container.querySelector('.forced-mode-badge')).toBeInTheDocument();
            expect(container.querySelector('.forced-mode-badge').textContent).toContain('Ranged disadvantage');
        });

        it('shows forced mode badge with default message when no reason', () => {
            const { container } = render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} forcedMode="advantage" />
            );
            const badge = container.querySelector('.forced-mode-badge');
            expect(badge).toBeInTheDocument();
            expect(badge.getAttribute('title')).toBe('Automatically set by active conditions');
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
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} />
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
        it('shows "Critical Hit!" when display roll is 20', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[20, 5]} bonus={3} />
            );
            expect(screen.getByText(/Critical Hit!/)).toBeInTheDocument();
        });

        it('shows "AUTO-CRIT" text when isAutoCrit is true', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[5, 3]} bonus={3} isAutoCrit={true} />
            );
            expect(screen.getByText(/AUTO-CRIT/)).toBeInTheDocument();
        });

        it('shows "target condition" text when isAutoCrit is true', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[5, 3]} bonus={3} isAutoCrit={true} />
            );
            expect(screen.getByText(/target condition/)).toBeInTheDocument();
        });

        it('does NOT show "Critical Hit!" when roll is not 20', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[19, 5]} bonus={3} />
            );
            expect(screen.queryByText(/Critical Hit!/)).not.toBeInTheDocument();
        });

        it('does NOT show "Critical Hit!" for non-d20 types', () => {
            render(
                <DiceRollResult name="Damage" type="damage" rolls={[20]} bonus={0} />
            );
            expect(screen.queryByText(/Critical Hit!/)).not.toBeInTheDocument();
        });

        it('does NOT show critical hit text for save or initiative types', () => {
            render(
                <DiceRollResult name="DEX Save" type="save" rolls={[20]} bonus={2} />
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

        it('does NOT show "Critical Miss!" when isNatural1 is false', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[15, 8]} bonus={3} rollType="attack" isNatural1={false} />
            );
            expect(screen.queryByText('Critical Miss!')).not.toBeInTheDocument();
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
