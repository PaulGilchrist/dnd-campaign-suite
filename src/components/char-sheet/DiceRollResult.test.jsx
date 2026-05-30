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
            expect(screen.getByText('15')).toBeInTheDocument(); // 12 + 3
        });

        it('renders correct icon class for d20 type', () => {
            const { container } = render(
                <DiceRollResult name="Check" type="d20" rolls={[10]} bonus={0} />
            );
            expect(container.querySelector('.fa-dice-d20')).toBeInTheDocument();
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
            expect(screen.getByText('13')).toBeInTheDocument(); // 10 + 3
        });

        it('shows correct total with both bonus and modifier', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[12]} bonus={2} modifier={3} />
            );
            expect(screen.getByText('17')).toBeInTheDocument(); // 12 + 2 + 3
        });
    });

    describe('advantage and disadvantage', () => {
        it('shows advantage toggle: clicking it uses max of two rolls', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            // Normal mode: uses first roll (8) + 2 = 10
            expect(screen.getByText('10')).toBeInTheDocument();

            // Click advantage
            fireEvent.click(screen.getByLabelText(/Advantage/));

            // Advantage mode: uses max(8,15)=15 + 2 = 17
            expect(screen.getByText('17')).toBeInTheDocument();
        });

        it('shows disadvantage toggle: clicking it uses min of two rolls', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            // Click disadvantage
            fireEvent.click(screen.getByLabelText(/Disadvantage/));

            // Disadvantage mode: uses min(8,15)=8 + 2 = 10
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
    });

    describe('critical hit', () => {
        it('shows "Critical Hit!" when roll is 20', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[20, 5]} bonus={3} />
            );
            expect(screen.getByText('Critical Hit!')).toBeInTheDocument();
        });

        it('does NOT show "Critical Hit!" when roll is not 20', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[19, 5]} bonus={3} />
            );
            expect(screen.queryByText('Critical Hit!')).not.toBeInTheDocument();
        });

        it('does NOT show "Critical Hit!" for non-d20 types', () => {
            render(
                <DiceRollResult name="Damage" type="damage" rolls={[20]} bonus={0} />
            );
            expect(screen.queryByText('Critical Hit!')).not.toBeInTheDocument();
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
            expect(screen.getByText('15')).toBeInTheDocument(); // 6 + 5 + 4
        });
    });

    describe('breakdown', () => {
        it('shows formula in breakdown when provided', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} formula="8d6" />
            );
            expect(screen.getByText(/8d6/)).toBeInTheDocument();
        });

        it('shows rolls for non-d20 type', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} />
            );
            expect(screen.getByText(/6, 5, 4/)).toBeInTheDocument();
        });

        it('shows click to dismiss hint', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} />
            );
            expect(screen.getByText('click to dismiss')).toBeInTheDocument();
        });
    });

    describe('save info display', () => {
        it('shows save info when dc and dcType are provided without success', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    dc={16}
                    dcType="DEX"
                    dcSuccess="half"
                />
            );
            expect(screen.getByText(/Save DC 16 DEX/)).toBeInTheDocument();
            expect(screen.getByText(/half damage on save/)).toBeInTheDocument();
        });

        it('shows no damage on save for dc_success "none"', () => {
            render(
                <DiceRollResult
                    name="Sacred Flame"
                    type="damage"
                    rolls={[4]}
                    bonus={0}
                    dc={14}
                    dcType="DEX"
                    dcSuccess="none"
                />
            );
            expect(screen.getByText(/no damage on save/)).toBeInTheDocument();
        });

        it('does not show save info when dc is undefined', () => {
            render(
                <DiceRollResult
                    name="Fire Bolt"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                />
            );
            expect(screen.queryByText(/Save DC/)).not.toBeInTheDocument();
        });

        it('does not show save info when success is also provided (resolved save)', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    dc={16}
                    success={true}
                />
            );
            expect(screen.queryByText(/Save DC/)).not.toBeInTheDocument();
        });
    });
});
