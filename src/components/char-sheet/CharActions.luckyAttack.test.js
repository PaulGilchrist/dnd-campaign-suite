// @maintained-by-ai
// CLA-216 — Halfling Lucky attack lane: plumb ce.autoRerollForAttack → ctx.autoReroll
import { describe, it, expect } from 'vitest';
import { applyAttackFeatureContext } from './CharActions.attackFeatureContext.js';

describe('applyAttackFeatureContext — Halfling Lucky attack lane (CLA-216)', () => {
    it('arms ctx.autoReroll for roll_equals_1, carries bonus, never touches the Boon gate', () => {
        const armed = applyAttackFeatureContext({ name: 'Shortsword' }, {
            autoRerollForAttack: true,
            autoRerollCondition: 'roll_equals_1',
            autoRerollBonus: '+5',
        });
        expect(armed.autoReroll).toBe(true);
        expect(armed.autoRerollCondition).toBe('roll_equals_1');
        expect(armed.autoRerollBonus).toBe('+5');

        const noBonus = applyAttackFeatureContext({}, {
            autoRerollForAttack: true,
            autoRerollCondition: 'roll_equals_1',
        });
        expect(noBonus.autoReroll).toBe(true);
        expect(noBonus.autoRerollBonus).toBeNull();

        // Manual Boon-of-Combat-Prowess button must stay fed only by boonOfCombatProwess
        expect(armed.autoRerollForAttack).toBeUndefined();
    });

    it.each([
        ['convert_miss_to_hit (Boon lane untouched)', { autoRerollForAttack: true, autoRerollCondition: 'convert_miss_to_hit' }],
        ['missing autoRerollForAttack flag', { autoRerollCondition: 'roll_equals_1' }],
        ['empty conditionEffects', {}],
        ['null conditionEffects', null],
    ])('is a no-op for %s', (_label, ce) => {
        const ctx = applyAttackFeatureContext({}, ce);
        expect(ctx.autoReroll).toBeUndefined();
        expect(ctx.autoRerollCondition).toBeUndefined();
        expect(ctx.autoRerollBonus).toBeUndefined();
    });
});
