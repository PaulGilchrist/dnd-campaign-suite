import { render, screen, fireEvent } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('dice type icons', () => {
        it.each`
            type               | rollType         | expectedIcon
            ${'d20'}           | ${undefined}     | ${'fa-dice-d20'}
            ${'attack'}        | ${'attack'}      | ${'fa-crosshairs'}
            ${'save'}          | ${'save'}        | ${'fa-shield-halved'}
            ${'save-damage'}   | ${undefined}     | ${'fa-shield-halved'}
            ${'initiative'}    | ${undefined}     | ${'fa-gavel'}
            ${'heal'}          | ${undefined}     | ${'fa-heart'}
            ${'damage'}        | ${undefined}     | ${'fa-bolt'}
            ${'aoe-damage'}    | ${undefined}     | ${'fa-bolt'}
            ${'graze-damage'}  | ${undefined}     | ${'fa-bolt'}
            ${'overchannel-damage'} | ${undefined} | ${'fa-bolt'}
        `('shows correct icon for type: $type', ({ type, rollType, expectedIcon }) => {
            const { container } = render(
                <DiceRollResult
                    name="Roll"
                    type={type}
                    rolls={[10]}
                    bonus={0}
                    rollType={rollType}
                />
            );
            const icon = container.querySelector('.fa-solid');
            expect(icon).toHaveClass(expectedIcon);
        });
    });

    describe('gwf (Great Weapon Fighting) display', () => {
        it('shows GWF display when gwfApplied and gwfOriginalRolls are provided', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="damage"
                    rolls={[2, 4]}
                    bonus={0}
                    gwfApplied={true}
                    gwfOriginalRolls={[1, 4]}
                    gwfDisplayRolls={[2, 4]}
                />
            );
            const gwf = container.querySelector('.dice-roll-gwf');
            expect(gwf).toBeInTheDocument();
            expect(gwf.textContent).toContain('Great Weapon Fighting');
            expect(gwf.textContent).toContain('1, 4');
            expect(gwf.textContent).toContain('2, 4');
        });

        it('falls back to safeRolls when gwfDisplayRolls is not provided', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="damage"
                    rolls={[2, 4]}
                    bonus={0}
                    gwfApplied={true}
                    gwfOriginalRolls={[1, 4]}
                />
            );
            const gwf = container.querySelector('.dice-roll-gwf');
            expect(gwf.textContent).toContain('2, 4');
        });

        it('does not show GWF when gwfApplied is false', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="damage"
                    rolls={[2, 4]}
                    bonus={0}
                    gwfApplied={false}
                    gwfOriginalRolls={[1, 4]}
                />
            );
            expect(screen.queryByText(/Great Weapon Fighting/)).not.toBeInTheDocument();
        });
    });

    describe('reliable talent display', () => {
        it('shows reliable talent indicator when d20 roll is 9 or less', () => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[3]}
                    bonus={5}
                    rollType="skill"
                    reliableTalent={true}
                />
            );
            const rt = container.querySelector('.dice-roll-reliable-talent');
            expect(rt).toBeInTheDocument();
            expect(rt.textContent).toContain('Reliable Talent');
            expect(rt.textContent).toContain('d20 3');
            expect(rt.textContent).toContain('10');
        });

        it('does not show reliable talent indicator when d20 roll is 10 or more', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[12]}
                    bonus={5}
                    rollType="skill"
                    reliableTalent={true}
                />
            );
            expect(screen.queryByText(/Reliable Talent/)).not.toBeInTheDocument();
        });

        it('does not show reliable talent for non-check/non-skill roll types', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[3]}
                    bonus={5}
                    rollType="attack"
                    reliableTalent={true}
                />
            );
            expect(screen.queryByText(/Reliable Talent/)).not.toBeInTheDocument();
        });
    });

    describe('heal display', () => {
        it('shows heal applied without reduction', () => {
            const { container } = render(
                <DiceRollResult
                    name="Cure Wounds"
                    type="heal"
                    rolls={[5, 3]}
                    bonus={0}
                    total={8}
                    finalHeal={8}
                    targetName="Ally"
                />
            );
            const heal = container.querySelector('.dice-roll-heal-applied');
            expect(heal.textContent).toContain('8');
            expect(heal.textContent).toContain('healing applied');
            expect(heal.textContent).toContain('Ally');
            expect(heal.textContent).not.toContain('reduced');
        });

        it('shows heal applied with reduction and HP change', () => {
            const { container } = render(
                <DiceRollResult
                    name="Cure Wounds"
                    type="heal"
                    rolls={[5, 3]}
                    bonus={0}
                    total={10}
                    finalHeal={6}
                    healReduced={true}
                    targetName="Ally"
                    targetCurrentHp={2}
                />
            );
            const heal = container.querySelector('.dice-roll-heal-applied');
            expect(heal.textContent).toContain('6');
            expect(heal.textContent).toContain('reduced from 10');
            expect(heal.textContent).toContain('HP:');
        });

        it('shows bonus heal when bonusHeal is greater than 0', () => {
            const { container } = render(
                <DiceRollResult
                    name="Cure Wounds"
                    type="heal"
                    rolls={[5, 3]}
                    bonus={0}
                    total={8}
                    finalHeal={8}
                    bonusHeal={3}
                    bonusHealDetail="Divine Spark"
                    targetName="Ally"
                />
            );
            const bonus = container.querySelector('.dice-roll-heal-bonus');
            expect(bonus).toBeInTheDocument();
            expect(bonus.textContent).toContain('+3');
            expect(bonus.textContent).toContain('Divine Spark');
        });

        it('does not show bonus heal when bonusHeal is 0', () => {
            const { container } = render(
                <DiceRollResult
                    name="Cure Wounds"
                    type="heal"
                    rolls={[5, 3]}
                    bonus={0}
                    total={8}
                    finalHeal={8}
                    bonusHeal={0}
                    targetName="Ally"
                />
            );
            expect(container.querySelector('.dice-roll-heal-bonus')).not.toBeInTheDocument();
        });
    });

    describe('psi-bolstered knack full flow', () => {
        it('shows psi-bolstered knack button for check/skill roll types', () => {
            render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="skill"
                    psiBolsteredKnack={true}
                    psiBolsteredKnackDieSize={6}
                />
            );
            expect(screen.getByText(/Psi-Bolstered Knack/)).toBeInTheDocument();
        });

        it('does not show psi-bolstered knack for non-check/non-skill roll types', () => {
            render(
                <DiceRollResult
                    name="Attack"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="attack"
                    psiBolsteredKnack={true}
                />
            );
            expect(screen.queryByText(/Psi-Bolstered Knack/)).not.toBeInTheDocument();
        });

        it('shows psi-bolstered knack result with succeed/failed buttons after clicking', () => {
            const { container } = render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="skill"
                    psiBolsteredKnack={true}
                    psiBolsteredKnackDieSize={6}
                />
            );
            fireEvent.click(screen.getByText(/Psi-Bolstered Knack/));
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
            expect(screen.getByText(/Succeeded/)).toBeInTheDocument();
            expect(screen.getByText(/Still Failed/)).toBeInTheDocument();
        });

        it('shows consumed state after clicking succeeded', () => {
            const { container } = render(
                <DiceRollResult
                    name="Insight"
                    type="d20"
                    rolls={[5]}
                    bonus={3}
                    rollType="skill"
                    psiBolsteredKnack={true}
                    psiBolsteredKnackDieSize={6}
                />
            );
            fireEvent.click(screen.getByText(/Psi-Bolstered Knack/));
            expect(container.querySelector('.dice-roll-reroll-result')).toBeInTheDocument();
            fireEvent.click(screen.getByText(/Succeeded/));
            // consumed state should still show the result but without buttons
            expect(container.querySelectorAll('.dice-roll-reroll-result').length).toBeGreaterThanOrEqual(1);
        });
    });
});
