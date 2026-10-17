import { render } from '@testing-library/react';
import DiceRollResult from './DiceRollResult.jsx';

// Ownership map for this lane within the DiceRollResult.* test family:
// OWNS  — SecondaryDamageSection (DiceRollResult.jsx): the whole
//         .dice-roll-secondary-damage tree — label, .dice-roll-secondary-formula,
//         .dice-roll-secondary-save-result, .dice-roll-secondary-total and the
//         combined secondary .dice-roll-damage-applied row — plus the
//         secondaryFormula presence gate that hides the entire section.
// DEFER — primary breakdown/totals/crit notices: DiceRollResult.rendering.test.jsx;
//         primary hit/miss, primary save-result line, primary damage-applied line:
//         DiceRollResult.combatDisplay.test.jsx; resistance/lore/cantrip info notices:
//         DiceRollResult.infoDisplay.test.jsx; feature offers, advantage toggles,
//         click flows and reroll result rows: DiceRollResult.interactive /
//         .toggles / .rerollResults / *.charge-bonus / *.two-handed /
//         *.ranged-variant / *.hit-choice chooser lanes.
// Seam is purely presentational: no fetch, timers, or Math.random path is hit
// here (the component's only dice roll is the psi-knack click, owned by the
// interactive lane), so there are no dice spies to restore in afterEach.

function renderSecondary(overrides = {}) {
    return render(
        <DiceRollResult
            name="Longsword"
            type="attack"
            rolls={[18]}
            bonus={5}
            secondaryFormula="1d8"
            secondaryRolls={[5]}
            secondaryTotal={5}
            secondaryModifier={0}
            {...overrides}
        />
    );
}

describe('DiceRollResult — secondary damage section (owned seam)', () => {
    const formulaCases = [
        { label: 'omits zero modifier', rolls: [5], modifier: 0, total: 5, exact: '1d8: 5 = 5' },
        { label: 'includes positive modifier', rolls: [5], modifier: 3, total: 8, exact: '1d8: 5 +3 = 8' },
        // Component template is `+${secondaryModifier}`, so a negative modifier
        // currently renders as "+-2" (cosmetic defect — flagged to product).
        { label: 'shows negative modifier as "+-2"', rolls: [3], modifier: -2, total: 1, exact: '1d8: 3 +-2 = 1' },
        { label: 'leaves rolls blank when secondaryRolls is null', rolls: null, modifier: 0, total: 5, exact: '1d8:  = 5' },
    ];

    it.each(formulaCases)('formats secondary formula — $label', ({ rolls, modifier, total, exact }) => {
        if (rolls) {
            expect(total).toBe(rolls.reduce((sum, r) => sum + r, 0) + modifier);
        }
        const { container } = renderSecondary({
            secondaryRolls: rolls,
            secondaryModifier: modifier,
            secondaryTotal: total,
        });
        expect(container.querySelector('.dice-roll-secondary-formula').textContent).toBe(exact);
    });

    // hasTotals = secondaryFinalDamage !== undefined && finalDamage !== undefined;
    // the applied row additionally requires damageApplied.
    const visibilityCases = [
        {
            label: 'renders total and applied rows when both totals are defined and damage applied',
            finalDamage: 10,
            secondaryFinalDamage: 5,
            damageApplied: true,
            totalText: '10 slashing damage + 5 radiant damage = 15 total damage',
            appliedText: '15 damage applied to Goblin',
        },
        {
            label: 'suppresses applied row when damageApplied is false',
            finalDamage: 10,
            secondaryFinalDamage: 5,
            damageApplied: false,
            totalText: '10 slashing damage + 5 radiant damage = 15 total damage',
            appliedText: null,
        },
        {
            label: 'suppresses total and applied rows when secondaryFinalDamage is undefined',
            finalDamage: 10,
            secondaryFinalDamage: undefined,
            damageApplied: true,
            totalText: null,
            appliedText: null,
        },
        {
            label: 'suppresses total and applied rows when finalDamage is undefined',
            finalDamage: undefined,
            secondaryFinalDamage: 5,
            damageApplied: true,
            totalText: null,
            appliedText: null,
        },
    ];

    it.each(visibilityCases)('gates total/applied rows — $label', ({ finalDamage, secondaryFinalDamage, damageApplied, totalText, appliedText }) => {
        const { container } = renderSecondary({
            damageType: 'slashing',
            secondaryDamageType: 'radiant',
            targetName: 'Goblin',
            finalDamage,
            secondaryFinalDamage,
            damageApplied,
        });
        const section = container.querySelector('.dice-roll-secondary-damage');
        expect(section.querySelector('.dice-roll-secondary-label').textContent).toBe('Secondary Damage:');
        expect(section.querySelector('.dice-roll-secondary-formula').textContent).toBe('1d8: 5 = 5');

        const totalEl = section.querySelector('.dice-roll-secondary-total');
        if (totalText) {
            expect(totalEl.textContent).toBe(totalText);
        } else {
            expect(totalEl).not.toBeInTheDocument();
        }

        const appliedEl = section.querySelector('.dice-roll-damage-applied');
        if (appliedText) {
            expect(appliedEl.textContent).toBe(appliedText);
        } else {
            expect(appliedEl).not.toBeInTheDocument();
        }
    });

    it('renders no secondary section without secondaryFormula', () => {
        const { container } = renderSecondary({
            secondaryFormula: undefined,
            secondaryRolls: undefined,
            secondaryTotal: undefined,
        });
        expect(container.querySelector('.dice-roll-secondary-damage')).not.toBeInTheDocument();
    });

    const saveCases = [
        { label: 'success', saveResult: { success: true, total: 16, roll: 12, bonus: 4 }, text: '✓ SAVE SUCCESS (16 vs DC 14)', cls: 'save-success' },
        { label: 'failure', saveResult: { success: false, total: 10, roll: 6, bonus: 4 }, text: '✗ SAVE FAILURE (10 vs DC 14)', cls: 'save-failure' },
    ];

    it.each(saveCases)('renders secondary save row — $label', ({ saveResult, text, cls }) => {
        expect(saveResult.total >= 14).toBe(saveResult.success); // save data consistent with DC 14
        const { container } = renderSecondary({
            name: 'Fireball',
            type: 'damage',
            rolls: [6],
            bonus: 0,
            secondaryFormula: '1d6',
            secondaryRolls: [4],
            secondaryTotal: 4,
            secondarySaveResult: saveResult,
            saveDc: 14,
        });
        const saveEl = container.querySelector('.dice-roll-secondary-save-result');
        expect(saveEl.textContent).toBe(text);
        expect(saveEl.className).toContain(cls);
    });

    it('omits the secondary save row when secondarySaveResult is null', () => {
        const { container } = renderSecondary({
            name: 'Fireball',
            type: 'damage',
            rolls: [6],
            bonus: 0,
            secondaryFormula: '1d6',
            secondaryRolls: [4],
            secondaryTotal: 4,
            secondarySaveResult: null,
        });
        expect(container.querySelector('.dice-roll-secondary-save-result')).not.toBeInTheDocument();
    });

    it('applies combined primary+secondary totals with HP cross-check', () => {
        const { container } = renderSecondary({
            name: 'Eldritch Blast',
            bonus: 3,
            finalDamage: 12,
            damageApplied: true,
            secondaryFinalDamage: 8,
            secondaryDamageType: 'force',
            secondaryRolls: [8],
            secondaryTotal: 8,
            targetName: 'Dragon',
            targetCurrentHp: 100,
        });
        const section = container.querySelector('.dice-roll-secondary-damage');
        expect(section.querySelector('.dice-roll-secondary-formula').textContent).toBe('1d8: 8 = 8');
        expect(section.querySelector('.dice-roll-secondary-total').textContent).toBe('12  damage + 8 force damage = 20 total damage');
        // 20 on the total line = 12 primary + 8 secondary, and 20 again on the
        // applied line with HP 100 + 20 → 100 — one consistent arithmetic story.
        expect(section.querySelector('.dice-roll-damage-applied').textContent).toBe('20 damage applied to Dragon — HP: 120 → 100');
        // The primary lane (combatDisplay-owned) renders its own row untouched.
        const primaryRow = [...container.querySelectorAll('.dice-roll-damage-applied')].find(el => !section.contains(el));
        expect(primaryRow.textContent).toBe('12 damage applied to Dragon — HP: 112 → 100');
    });
});
