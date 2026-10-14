import { render } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

describe('DiceRollResult', () => {
    describe('secondary damage display', () => {
        it('renders secondary formula with rolls when secondaryRolls is null', () => {
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
            expect(formulaEl).toBeInTheDocument();
            expect(formulaEl.textContent).toContain('1d8');
            expect(formulaEl.textContent).toContain('= 5');
            expect(formulaEl.textContent).not.toContain('+');
        });

        it('omits modifier from secondary formula when secondaryModifier is zero', () => {
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
            expect(container.querySelector('.dice-roll-secondary-formula').textContent).not.toContain('+0');
        });

        it('includes negative modifier in secondary formula', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    secondaryFormula="1d8"
                    secondaryRolls={[3]}
                    secondaryTotal={1}
                    secondaryModifier={-2}
                />
            );
            expect(container.querySelector('.dice-roll-secondary-formula').textContent).toContain('-2');
        });

        it('includes positive modifier in secondary formula', () => {
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
            expect(container.querySelector('.dice-roll-secondary-formula').textContent).toContain('+3');
        });

        it('shows combined damage applied and HP change when both damages are defined', () => {
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
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            expect(secondaryContainer.querySelectorAll('.dice-roll-damage-applied').length).toBe(0);
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
                    targetName="Goblin"
                    secondaryFormula="1d8"
                    secondaryRolls={[5]}
                    secondaryTotal={5}
                    secondaryModifier={0}
                />
            );
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            expect(secondaryContainer.querySelectorAll('.dice-roll-damage-applied').length).toBe(0);
        });

        it('shows secondary total damage line with damage types when both damages are defined', () => {
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

        it('omits secondary total when only primary damageType is missing', () => {
            const { container } = render(
                <DiceRollResult
                    name="Longsword"
                    type="attack"
                    rolls={[18]}
                    bonus={5}
                    finalDamage={10}
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
            expect(totalEl.textContent).toContain('radiant damage');
            expect(totalEl.textContent).toContain('total damage');
        });

        it('shows secondary save result with success class on save success', () => {
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
            const saveEl = container.querySelector('.dice-roll-secondary-save-result');
            expect(saveEl).toBeInTheDocument();
            expect(saveEl.textContent).toContain('SAVE SUCCESS');
            expect(saveEl.textContent).toContain('16 vs DC 14');
            expect(saveEl.className).toContain('save-success');
        });

        it('shows secondary save result with failure class on save failure', () => {
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
            const saveEl = container.querySelector('.dice-roll-secondary-save-result');
            expect(saveEl).toBeInTheDocument();
            expect(saveEl.textContent).toContain('SAVE FAILURE');
            expect(saveEl.textContent).toContain('10 vs DC 14');
            expect(saveEl.className).toContain('save-failure');
        });

        it('does not render secondary save result element when secondarySaveResult is null', () => {
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

        it('renders secondary formula section when only secondaryFormula is provided without finalDamage', () => {
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
            const secondaryContainer = container.querySelector('.dice-roll-secondary-damage');
            expect(secondaryContainer).toBeInTheDocument();
            expect(secondaryContainer.querySelector('.dice-roll-secondary-label')).toBeInTheDocument();
            expect(secondaryContainer.querySelector('.dice-roll-secondary-formula')).toBeInTheDocument();
        });

    });
});
