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

        it('shows secondary modifier when non-zero', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={8}
                    secondaryModifier={3}
                />
            );
            const formulaEl = container.querySelector('.dice-roll-secondary-formula');
            expect(formulaEl.textContent).toContain('+3');
        });

        it('does not show secondary modifier when zero', () => {
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
            expect(formulaEl.textContent).not.toContain('+0');
        });

        it('does not show secondary modifier when undefined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                />
            );
            const formulaEl = container.querySelector('.dice-roll-secondary-formula');
            expect(formulaEl.textContent).not.toContain('+');
        });

        it('shows secondary save result when success is true', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    secondaryFormula="1d6"
                    secondaryRolls={[4]}
                    secondaryTotal={4}
                    secondaryModifier={0}
                    secondarySaveResult={{ success: true, total: 16, roll: 12, bonus: 4 }}
                    saveDc={14}
                />
            );
            const saveResultEl = container.querySelector('.dice-roll-secondary-save-result');
            expect(saveResultEl).toBeInTheDocument();
            expect(saveResultEl.textContent).toContain('SAVE SUCCESS');
            expect(saveResultEl.textContent).toContain('16 vs DC 14');
        });

        it('shows secondary save result when success is false', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    secondaryFormula="1d6"
                    secondaryRolls={[4]}
                    secondaryTotal={4}
                    secondaryModifier={0}
                    secondarySaveResult={{ success: false, total: 10, roll: 6, bonus: 4 }}
                    saveDc={14}
                />
            );
            const saveResultEl = container.querySelector('.dice-roll-secondary-save-result');
            expect(saveResultEl).toBeInTheDocument();
            expect(saveResultEl.textContent).toContain('SAVE FAILURE');
        });

        it('does not show secondary save result when secondarySaveResult is null', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    secondaryFormula="1d6"
                    secondaryRolls={[4]}
                    secondaryTotal={4}
                    secondaryModifier={0}
                    secondarySaveResult={null}
                />
            );
            expect(container.querySelector('.dice-roll-secondary-save-result')).not.toBeInTheDocument();
        });

        it('does not show secondary save result when secondarySaveResult is undefined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6]}
                    bonus={0}
                    secondaryFormula="1d6"
                    secondaryRolls={[4]}
                    secondaryTotal={4}
                    secondaryModifier={0}
                />
            );
            expect(container.querySelector('.dice-roll-secondary-save-result')).not.toBeInTheDocument();
        });

        it('shows secondary total damage line when both damages are defined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    finalDamage={10}
                    damageType="slashing"
                    secondaryFinalDamage={5}
                    secondaryDamageType="radiant"
                    damageApplied={true}
                    targetName="Goblin"
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                    secondaryModifier={0}
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
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    finalDamage={10}
                    secondaryFinalDamage={5}
                    damageApplied={true}
                    targetName="Goblin"
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                    secondaryModifier={0}
                />
            );
            const totalEl = container.querySelector('.dice-roll-secondary-total');
            expect(totalEl.textContent).toContain('15 total damage');
        });

        it('does not show secondary total when secondaryFinalDamage is undefined', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    finalDamage={10}
                />
            );
            expect(screen.queryByText(/total damage/)).not.toBeInTheDocument();
        });

        it('does not show secondary total when finalDamage is undefined', () => {
            render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    secondaryFinalDamage={5}
                    secondaryDamageType="radiant"
                />
            );
            expect(screen.queryByText(/total damage/)).not.toBeInTheDocument();
        });

        it('shows secondary damage applied with combined total', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    finalDamage={10}
                    damageApplied={true}
                    secondaryFinalDamage={5}
                    targetName="Goblin"
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                    secondaryModifier={0}
                />
            );
            // The secondary damage applied section is inside .dice-roll-secondary-damage
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            const damageEls = secondaryContainer.querySelectorAll('.dice-roll-damage-applied');
            const secondaryDamageEl = damageEls[damageEls.length - 1]; // last one is the secondary one
            expect(secondaryDamageEl.textContent).toContain('15 damage applied');
            expect(secondaryDamageEl.textContent).toContain('Goblin');
        });

        it('shows HP change with secondary damage combined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    finalDamage={10}
                    damageApplied={true}
                    secondaryFinalDamage={5}
                    targetName="Goblin"
                    targetCurrentHp={5}
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                    secondaryModifier={0}
                />
            );
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            const damageEls = secondaryContainer.querySelectorAll('.dice-roll-damage-applied');
            const secondaryDamageEl = damageEls[damageEls.length - 1];
            expect(secondaryDamageEl.textContent).toContain('HP: 20 → 5');
        });

        it('does not show secondary damage applied when damageApplied is false', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    finalDamage={10}
                    damageApplied={false}
                    secondaryFinalDamage={5}
                    targetName="Goblin"
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                    secondaryModifier={0}
                />
            );
            // The secondary damage applied section should not exist
            const damageEls = container.querySelectorAll('.dice-roll-damage-applied');
            expect(damageEls.length).toBe(0);
        });

        it('does not show secondary damage applied when finalDamage is undefined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    damageApplied={true}
                    secondaryFinalDamage={5}
                    targetName="Goblin"
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                    secondaryModifier={0}
                />
            );
            const damageEls = container.querySelectorAll('.dice-roll-damage-applied');
            expect(damageEls.length).toBe(0);
        });

        it('does not show secondary damage applied when secondaryFinalDamage is undefined', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    finalDamage={10}
                    damageApplied={true}
                    secondaryFormula="1d6"
                    secondaryRolls={[3]}
                    secondaryTotal={3}
                    secondaryModifier={0}
                    targetName="Goblin"
                />
            );
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            const damageEls = secondaryContainer.querySelectorAll('.dice-roll-damage-applied');
            expect(damageEls.length).toBe(0);
        });

        it('shows secondary damage with negative modifier', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    secondaryFormula="1d6"
                    secondaryRolls={[3]}
                    secondaryTotal={1}
                    secondaryModifier={-2}
                />
            );
            const formulaEl = container.querySelector('.dice-roll-secondary-formula');
            expect(formulaEl.textContent).toContain('-2');
            expect(formulaEl.textContent).toContain('= 1');
        });

        it('shows secondary damage with multiple rolls', () => {
            const { container } = render(
                <DiceRollResult
                    name="Fireball"
                    type="damage"
                    rolls={[6, 5, 4]}
                    bonus={0}
                    secondaryFormula="2d6"
                    secondaryRolls={[3, 6]}
                    secondaryTotal={9}
                    secondaryModifier={0}
                />
            );
            const formulaEl = container.querySelector('.dice-roll-secondary-formula');
            expect(formulaEl.textContent).toContain('3, 6');
        });

        it('combines main damage and secondary damage applied HP calculation', () => {
            const { container } = render(
                <DiceRollResult
                    name="Eldritch Blast"
                    type="attack"
                    rolls={[18]}
                    bonus={3}
                    finalDamage={12}
                    damageApplied={true}
                    secondaryFinalDamage={8}
                    secondaryDamageType="force"
                    targetName="Dragon"
                    targetCurrentHp={100}
                    secondaryFormula="1d8"
                    secondaryRolls={[8]}
                    secondaryTotal={8}
                    secondaryModifier={0}
                />
            );
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            const damageEls = secondaryContainer.querySelectorAll('.dice-roll-damage-applied');
            const secondaryDamageEl = damageEls[damageEls.length - 1];
            expect(secondaryDamageEl.textContent).toContain('20 damage applied');
            expect(secondaryDamageEl.textContent).toContain('HP: 120 → 100');
        });
    });
});
