// @maintained-by-ai
import { render } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

// Regression lane for the lethal-blow popup misreport: the damage-applied line used to
// reconstruct pre-hit HP as targetCurrentHp + finalDamage. applyDamage.js clamps HP at 0
// (Math.max(0, oldHp - damage)), so on a killing blow with overkill the reconstruction
// exceeded the target's real pre-attack HP — a 7/7 goblin killed by 12 damage rendered
// "HP: 12 → 0". The damage feeds now thread the applier's true pre-hit HP as targetOldHp
// (applyResult.oldHp), and this lane pins that the transition prefers it on every
// damage-applied row (primary, reduced, and combined primary+secondary).
// Feeds with no applyResult (immunity popups, pre-apply fallbacks) keep the additive
// reconstruction — pinned by DiceRollResult.combatDisplay/.secondaryDamage.test.jsx.

const renderDamage = (props = {}) => render(
    <DiceRollResult
        name="Longsword"
        type="damage"
        rolls={[6]}
        bonus={0}
        targetName="Goblin"
        {...props}
    />
);

const appliedLines = (container) =>
    [...container.querySelectorAll('.dice-roll-damage-applied')].map(el => el.textContent);

describe('damage-applied HP transition on lethal blows', () => {
    it('renders the threaded pre-hit HP, not newHp + finalDamage (7/7 goblin, 12 overkill)', () => {
        const { container } = renderDamage({
            finalDamage: 12,
            damageApplied: true,
            targetCurrentHp: 0,
            targetOldHp: 7,
        });
        expect(appliedLines(container)[0]).toBe('12 damage applied to Goblin — HP: 7 → 0');
    });

    it('uses the threaded pre-hit HP on the reduced-damage variant too', () => {
        const { container } = renderDamage({
            total: 15,
            finalDamage: 8,
            damageApplied: true,
            damageReduced: true,
            targetCurrentHp: 0,
            targetOldHp: 5,
        });
        expect(appliedLines(container)[0]).toBe('8 damage applied to Goblin (reduced from 15) — HP: 5 → 0');
    });

    it('renders the transition unchanged when HP was not clamped (non-lethal hit)', () => {
        const { container } = renderDamage({
            finalDamage: 4,
            damageApplied: true,
            targetCurrentHp: 3,
            targetOldHp: 7,
        });
        expect(appliedLines(container)[0]).toBe('4 damage applied to Goblin — HP: 7 → 3');
    });

    it('threads the pre-hit HP through the combined primary+secondary row', () => {
        const { container } = render(
            <DiceRollResult
                name="Smelting Charge"
                type="save-damage"
                rolls={[6]}
                bonus={0}
                targetName="Goblin"
                secondaryFormula="1d8"
                secondaryRolls={[5]}
                secondaryTotal={5}
                secondaryModifier={0}
                finalDamage={12}
                secondaryFinalDamage={5}
                damageApplied={true}
                targetCurrentHp={0}
                targetOldHp={7}
            />
        );
        const section = container.querySelector('.dice-roll-secondary-damage');
        expect(section.querySelector('.dice-roll-damage-applied').textContent)
            .toBe('17 damage applied to Goblin — HP: 7 → 0');
    });

    it('keeps the additive reconstruction when no pre-hit HP is threaded', () => {
        const { container } = renderDamage({
            finalDamage: 8,
            damageApplied: true,
            targetCurrentHp: 5,
        });
        expect(appliedLines(container)[0]).toBe('8 damage applied to Goblin — HP: 13 → 5');
    });
});
