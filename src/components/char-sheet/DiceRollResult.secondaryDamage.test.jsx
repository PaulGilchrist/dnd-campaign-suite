// @improved-by-ai
import { render, screen } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('secondary damage display', () => {
        it('shows secondary damage section when secondaryFormula is provided', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                    secondaryModifier={0}
                />
            );
            expect(container.querySelector('.dice-roll-secondary-damage')).toBeInTheDocument();
            expect(screen.getByText(/Secondary Damage:/)).toBeInTheDocument();
        });

        it('shows secondary formula with rolls and total', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                    secondaryModifier={0}
                />
            );
            const formulaEl = container.querySelector('.dice-roll-secondary-formula');
            expect(formulaEl.textContent).toContain('1d8');
            expect(formulaEl.textContent).toContain('5');
            expect(formulaEl.textContent).toContain('= 5');
        });

        it('shows secondary modifier when non-zero (positive or negative)', () => {
            const positive = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    secondaryFormula="1d8" secondaryRolls={[5]}
                    secondaryTotal={8} secondaryModifier={3}
                />
            );
            expect(positive.container.querySelector('.dice-roll-secondary-formula').textContent).toContain('+3');

            const negative = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    secondaryFormula="1d6" secondaryRolls={[3]}
                    secondaryTotal={1} secondaryModifier={-2}
                />
            );
            expect(negative.container.querySelector('.dice-roll-secondary-formula').textContent).toContain('-2');
        });

        it('does not show secondary modifier when zero or undefined', () => {
            const zero = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    secondaryFormula="1d8" secondaryRolls={[5]}
                    secondaryTotal={5} secondaryModifier={0}
                />
            );
            expect(zero.container.querySelector('.dice-roll-secondary-formula').textContent).not.toContain('+0');

            const undef = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    secondaryFormula="1d8" secondaryRolls={[5]}
                    secondaryTotal={5}
                />
            );
            expect(undef.container.querySelector('.dice-roll-secondary-formula').textContent).not.toContain('+');
        });

        it('shows secondary formula without rolls when secondaryRolls is null', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    secondaryFormula="1d8"
                    secondaryRolls={null}
                    secondaryTotal={5}
                    secondaryModifier={0}
                />
            );
            const formulaEl = container.querySelector('.dice-roll-secondary-formula');
            expect(formulaEl.textContent).toContain('1d8');
            expect(formulaEl.textContent).toContain('= 5');
        });

        it('shows secondary save result based on success value', () => {
            const success = render(
                <DiceRollResult
                    name="Fireball" type="damage" rolls={[6]} bonus={0}
                    secondaryFormula="1d6" secondaryRolls={[4]}
                    secondaryTotal={4} secondaryModifier={0}
                    secondarySaveResult={{ success: true, total: 16, roll: 12, bonus: 4 }}
                    saveDc={14}
                />
            );
            const saveResultEl = success.container.querySelector('.dice-roll-secondary-save-result');
            expect(saveResultEl).toBeInTheDocument();
            expect(saveResultEl.textContent).toContain('SAVE SUCCESS');
            expect(saveResultEl.textContent).toContain('16 vs DC 14');

            const failure = render(
                <DiceRollResult
                    name="Fireball" type="damage" rolls={[6]} bonus={0}
                    secondaryFormula="1d6" secondaryRolls={[4]}
                    secondaryTotal={4} secondaryModifier={0}
                    secondarySaveResult={{ success: false, total: 10, roll: 6, bonus: 4 }}
                    saveDc={14}
                />
            );
            const failEl = failure.container.querySelector('.dice-roll-secondary-save-result');
            expect(failEl).toBeInTheDocument();
            expect(failEl.textContent).toContain('SAVE FAILURE');
        });

        it('does not show secondary save result when secondarySaveResult is null or undefined', () => {
            const nullResult = render(
                <DiceRollResult
                    name="Fireball" type="damage" rolls={[6]} bonus={0}
                    secondaryFormula="1d6" secondaryRolls={[4]}
                    secondaryTotal={4} secondaryModifier={0}
                    secondarySaveResult={null}
                />
            );
            expect(nullResult.container.querySelector('.dice-roll-secondary-save-result')).not.toBeInTheDocument();

            const undefResult = render(
                <DiceRollResult
                    name="Fireball" type="damage" rolls={[6]} bonus={0}
                    secondaryFormula="1d6" secondaryRolls={[4]}
                    secondaryTotal={4} secondaryModifier={0}
                />
            );
            expect(undefResult.container.querySelector('.dice-roll-secondary-save-result')).not.toBeInTheDocument();
        });

        it('shows secondary total damage line when both damages are defined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    finalDamage={10} damageType="slashing"
                    secondaryFinalDamage={5} secondaryDamageType="radiant"
                    damageApplied={true} targetName="Goblin"
                    secondaryFormula="1d8" secondaryRolls={[5]}
                    secondaryTotal={5} secondaryModifier={0}
                />
            );
            const totalEl = container.querySelector('.dice-roll-secondary-total');
            expect(totalEl).toBeInTheDocument();
            expect(totalEl.textContent).toContain('10 slashing damage');
            expect(totalEl.textContent).toContain('5 radiant damage');
            expect(totalEl.textContent).toContain('15 total damage');
        });

        it('shows secondary total damage without damage types when not provided', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    finalDamage={10} secondaryFinalDamage={5}
                    damageApplied={true} targetName="Goblin"
                    secondaryFormula="1d8" secondaryRolls={[5]}
                    secondaryTotal={5} secondaryModifier={0}
                />
            );
            const totalEl = container.querySelector('.dice-roll-secondary-total');
            expect(totalEl.textContent).toContain('15 total damage');
        });

        it('does not show secondary total when either damage is undefined', () => {
            render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    finalDamage={10}
                />
            );
            expect(screen.queryByText(/total damage/)).not.toBeInTheDocument();

            render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    secondaryFinalDamage={5} secondaryDamageType="radiant"
                />
            );
            expect(screen.queryByText(/total damage/)).not.toBeInTheDocument();
        });

        it('shows secondary damage applied with combined total', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    finalDamage={10} damageApplied={true}
                    secondaryFinalDamage={5} targetName="Goblin"
                    secondaryFormula="1d8" secondaryRolls={[5]}
                    secondaryTotal={5} secondaryModifier={0}
                />
            );
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            const damageEls = secondaryContainer.querySelectorAll('.dice-roll-damage-applied');
            const secondaryDamageEl = damageEls[damageEls.length - 1];
            expect(secondaryDamageEl.textContent).toContain('15 damage applied');
            expect(secondaryDamageEl.textContent).toContain('Goblin');
        });

        it('shows HP change with secondary damage combined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    finalDamage={10} damageApplied={true}
                    secondaryFinalDamage={5} targetName="Goblin"
                    targetCurrentHp={5}
                    secondaryFormula="1d8" secondaryRolls={[5]}
                    secondaryTotal={5} secondaryModifier={0}
                />
            );
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            const damageEls = secondaryContainer.querySelectorAll('.dice-roll-damage-applied');
            const secondaryDamageEl = damageEls[damageEls.length - 1];
            expect(secondaryDamageEl.textContent).toContain('HP: 20 → 5');
        });

        it('combines main damage and secondary damage applied HP calculation', () => {
            const { container } = render(
                <DiceRollResult
                    name="Eldritch Blast" type="attack" rolls={[18]} bonus={3}
                    finalDamage={12} damageApplied={true}
                    secondaryFinalDamage={8} secondaryDamageType="force"
                    targetName="Dragon" targetCurrentHp={100}
                    secondaryFormula="1d8" secondaryRolls={[8]}
                    secondaryTotal={8} secondaryModifier={0}
                />
            );
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            const damageEls = secondaryContainer.querySelectorAll('.dice-roll-damage-applied');
            const secondaryDamageEl = damageEls[damageEls.length - 1];
            expect(secondaryDamageEl.textContent).toContain('20 damage applied');
            expect(secondaryDamageEl.textContent).toContain('HP: 120 → 100');
        });

        it('does not show secondary damage applied when conditions are not met', () => {
            const noApplied = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    finalDamage={10} damageApplied={false}
                    secondaryFinalDamage={5} targetName="Goblin"
                    secondaryFormula="1d8" secondaryRolls={[5]}
                    secondaryTotal={5} secondaryModifier={0}
                />
            );
            expect(noApplied.container.querySelectorAll('.dice-roll-damage-applied').length).toBe(0);

            const noMainDamage = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    damageApplied={true}
                    secondaryFinalDamage={5} targetName="Goblin"
                    secondaryFormula="1d8" secondaryRolls={[5]}
                    secondaryTotal={5} secondaryModifier={0}
                />
            );
            expect(noMainDamage.container.querySelectorAll('.dice-roll-damage-applied').length).toBe(0);

            const noSecondaryDamage = render(
                <DiceRollResult
                    name="Longsword" type="attack" rolls={[18]} bonus={5}
                    finalDamage={10} damageApplied={true}
                    secondaryFormula="1d6" secondaryRolls={[3]}
                    secondaryTotal={3} secondaryModifier={0}
                    targetName="Goblin"
                />
            );
            const secondaryContainer = noSecondaryDamage.container.querySelector('.dice-roll-secondary-damage');
            expect(secondaryContainer.querySelectorAll('.dice-roll-damage-applied').length).toBe(0);
        });
    });
});
