import { render, screen } from '@testing-library/react';
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
            const icon = container.querySelector('.dice-roll-header .fa-solid');
            expect(icon).toHaveClass(expectedIcon);
        });
    });

    describe('elemental adept display', () => {
        it('shows 0× count when bonus > 0 but no 1s in rolls', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fire Bolt"
                    type="damage"
                    rolls={[3, 6, 4]}
                    bonus={0}
                    elementalAdeptBonus={1}
                />
            );
            const el = container.querySelector('.dice-roll-elemental-adept');
            expect(el.textContent).toContain('0× 1 → 2');
            expect(el.textContent).toContain('+1');
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

        it('does not show GWF when gwfOriginalRolls is missing', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="damage"
                    rolls={[2, 4]}
                    bonus={0}
                    gwfApplied={true}
                />
            );
            expect(screen.queryByText(/Great Weapon Fighting/)).not.toBeInTheDocument();
        });
    });

    describe('reliable talent display', () => {
        it.each`
            roll   | expectedRoll
            ${3}   | ${'d20 3'}
            ${9}   | ${'d20 9'}
        `('shows reliable talent indicator for d20 roll $roll (≤9)', ({ roll, expectedRoll }) => {
            const { container } = render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[roll]}
                    bonus={5}
                    rollType="skill"
                    reliableTalent={true}
                />
            );
            const rt = container.querySelector('.dice-roll-reliable-talent');
            expect(rt).toBeInTheDocument();
            expect(rt.textContent).toContain('Reliable Talent');
            expect(rt.textContent).toContain(expectedRoll);
            expect(rt.textContent).toContain('10');
        });

        it('does not show reliable talent indicator when d20 roll is 10', () => {
            render(
                <DiceRollResult
                    name="Athletics"
                    type="d20"
                    rolls={[10]}
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

        it('does not show reliable talent for save rollType', () => {
            render(
                <DiceRollResult
                    name="DEX Save"
                    type="d20"
                    rolls={[3]}
                    bonus={5}
                    rollType="save"
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

        it.each`
            finalHeal
            ${0}
            ${-3}
        `('shows already at full HP when finalHeal is $finalHeal', ({ finalHeal }) => {
            const { container } = render(
                <DiceRollResult
                    name="Cure Wounds"
                    type="heal"
                    rolls={[5, 3]}
                    bonus={0}
                    total={8}
                    finalHeal={finalHeal}
                    targetName="Ally"
                />
            );
            const heal = container.querySelector('.dice-roll-heal-applied');
            expect(heal.textContent).toContain('already at full HP');
            expect(heal.textContent).not.toContain('healing applied');
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

        it.each`
            bonusHeal
            ${0}
            ${undefined}
        `('does not show bonus heal when bonusHeal is $bonusHeal', ({ bonusHeal }) => {
            const { container } = render(
                <DiceRollResult
                    name="Cure Wounds"
                    type="heal"
                    rolls={[5, 3]}
                    bonus={0}
                    total={8}
                    finalHeal={8}
                    bonusHeal={bonusHeal}
                    targetName="Ally"
                />
            );
            expect(container.querySelector('.dice-roll-heal-bonus')).not.toBeInTheDocument();
        });
    });
});
