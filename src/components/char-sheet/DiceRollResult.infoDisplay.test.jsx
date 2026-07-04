// @improved-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('breakdown display', () => {
        it('shows formula in breakdown when provided', () => {
            render(
                <DiceRollResult name="Fireball" type="damage" rolls={[6, 5, 4]} bonus={0} formula="8d6" />
            );
            expect(screen.getByText(/8d6/)).toBeInTheDocument();
        });

        it('shows d20 label in breakdown for d20 type', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} />
            );
            expect(screen.getByText(/d20/)).toBeInTheDocument();
        });

        it('shows formula with colon when formula is provided for d20 type', () => {
            render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={0} formula="d20" />
            );
            const breakdown = screen.getByText(/d20/);
            expect(breakdown.textContent).toMatch(/^d20:/);
        });

        it.each`
            bonus    | expected
            ${3}     | ${'+3'}
            ${-2}    | ${'-2'}
            ${3}     | ${'+3 proficient'}
        `('shows bonus $expected in breakdown when bonus is $bonus', ({ bonus, expected }) => {
            const { container } = render(
                <DiceRollResult name="Test" type="d20" rolls={[10]} bonus={bonus} bonusDetail={expected === '+3 proficient' ? 'proficient' : undefined} />
            );
            const breakdown = container.querySelector('.dice-roll-breakdown');
            expect(breakdown.textContent).toContain(expected);
        });

        it('shows advantage/disadvantage arrow notation in breakdown', () => {
            render(
                <DiceRollResult name="Attack" type="d20" rolls={[8, 15]} bonus={2} />
            );

            fireEvent.click(screen.getByLabelText(/Advantage/));
            expect(screen.getByText(/8, 15 → 15/)).toBeInTheDocument();
        });
    });

    describe('save info display', () => {
        it('shows save info when dc and dcType are provided', () => {
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

        it('shows no damage on save for dcSuccess "none"', () => {
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
    });

    describe('resistance notice', () => {
        it('shows resistance notice when provided', () => {
            render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    resistanceNotice="Target resistant to fire damage"
                />
            );
            expect(screen.getByText(/Target resistant to fire damage/)).toBeInTheDocument();
        });
    });

    describe('hunter lore notice', () => {
        it('shows hunter lore notice when provided', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    hunterLoreNotice="Favored Enemy: Beast"
                />
            );
            expect(screen.getByText(/Favored Enemy: Beast/)).toBeInTheDocument();
        });

        it('shows hunter lore notice with multiple lines', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    hunterLoreNotice="Favored Enemy: Beast\nSense Motive: +5"
                />
            );
            expect(screen.getByText(/Favored Enemy: Beast/)).toBeInTheDocument();
            expect(screen.getByText(/Sense Motive: \+5/)).toBeInTheDocument();
        });
    });

    describe('potent cantrip', () => {
        it('shows potent cantrip notice when isPotentCantrip is true', () => {
            render(
                <DiceRollResult
                    name="Ray of Frost"
                    type="attack"
                    rolls={[15]}
                    bonus={3}
                    isPotentCantrip={true}
                />
            );
            expect(screen.getByText(/Potent Cantrip/)).toBeInTheDocument();
            expect(screen.getByText(/half damage on miss/)).toBeInTheDocument();
        });
    });

    describe('reliable talent', () => {
        it('shows reliable talent message when roll is 9 or below', () => {
            render(
                <DiceRollResult
                    name="Persuasion"
                    type="d20"
                    rolls={[5]}
                    bonus={4}
                    rollType="check"
                    reliableTalent={true}
                />
            );
            expect(screen.getByText(/Reliable Talent/)).toBeInTheDocument();
            expect(screen.getByText(/d20 5 → 10/)).toBeInTheDocument();
        });

        it('does not show reliable talent when roll is above 9', () => {
            render(
                <DiceRollResult
                    name="Persuasion"
                    type="d20"
                    rolls={[12]}
                    bonus={4}
                    rollType="check"
                    reliableTalent={true}
                />
            );
            expect(screen.queryByText(/Reliable Talent/)).not.toBeInTheDocument();
        });

        it('does not show reliable talent for non-check/skill roll types', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={4}
                    rollType="attack"
                    reliableTalent={true}
                />
            );
            expect(screen.queryByText(/Reliable Talent/)).not.toBeInTheDocument();
        });
    });

    describe('str check/replace', () => {
        it('uses strScore when it exceeds display total for strSaveReplace on save', () => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[3]}
                    bonus={1}
                    rollType="save"
                    strSaveReplace={true}
                    strScore={15}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('15');
        });

        it('uses strScore when it exceeds display total for strCheckReplace on check', () => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[3]}
                    bonus={1}
                    rollType="check"
                    strCheckReplace={true}
                    strScore={15}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('15');
        });

        it('uses display total when strScore is lower', () => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[8]}
                    bonus={4}
                    rollType="check"
                    strCheckReplace={true}
                    strScore={10}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('12');
        });
    });

    describe('wis check replace', () => {
        it('uses wis bonus when wisCheckReplace is true for check', () => {
            const { container } = render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={2}
                    modifier={1}
                    rollType="check"
                    wisCheckReplace={true}
                    wisCheckMinBonus={4}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('10');
        });
    });

    describe('reliable talent total calculation', () => {
        it('uses reliable talent total when roll is 9 or below', () => {
            const { container } = render(
                <DiceRollResult
                    name="Stealth"
                    type="d20"
                    rolls={[7]}
                    bonus={3}
                    rollType="skill"
                    reliableTalent={true}
                />
            );
            expect(container.querySelector('.dice-roll-total').textContent).toBe('13');
        });
    });
});
