// CLA-216 — Halfling Lucky attack lane: plumb ce.autoRerollForAttack → ctx.autoReroll
import { describe, it, expect } from 'vitest';
import { applyAttackFeatureContext } from './CharActions.attackFeatureContext.js';

describe('applyAttackFeatureContext — Halfling Lucky attack lane (CLA-216)', () => {
    it('arms ctx.autoReroll when ce.autoRerollForAttack + roll_equals_1', () => {
        const ctx = { name: 'Shortsword' };
        const ce = { autoRerollForAttack: true, autoRerollCondition: 'roll_equals_1' };
        applyAttackFeatureContext(ctx, ce);
        expect(ctx.autoReroll).toBe(true);
        expect(ctx.autoRerollCondition).toBe('roll_equals_1');
        expect(ctx.autoRerollBonus).toBeNull();
    });

    it('carries autoRerollBonus when provided', () => {
        const ctx = {};
        const ce = { autoRerollForAttack: true, autoRerollCondition: 'roll_equals_1', autoRerollBonus: '+5' };
        applyAttackFeatureContext(ctx, ce);
        expect(ctx.autoRerollBonus).toBe('+5');
    });

    it('does NOT arm ctx.autoReroll for convert_miss_to_hit (Boon of Combat Prowess lane untouched)', () => {
        const ctx = {};
        const ce = { autoRerollForAttack: true, autoRerollCondition: 'convert_miss_to_hit' };
        applyAttackFeatureContext(ctx, ce);
        expect(ctx.autoReroll).toBeUndefined();
        expect(ctx.autoRerollCondition).toBeUndefined();
    });

    it('does NOT arm ctx.autoRerollForAttack (preserves manual Boon-button gate)', () => {
        const ctx = {};
        const ce = { autoRerollForAttack: true, autoRerollCondition: 'roll_equals_1' };
        applyAttackFeatureContext(ctx, ce);
        expect(ctx.autoRerollForAttack).toBeUndefined();
    });

    it('is a no-op for empty conditionEffects', () => {
        const ctx = {};
        applyAttackFeatureContext(ctx, {});
        expect(ctx.autoReroll).toBeUndefined();
        expect(ctx.autoRerollCondition).toBeUndefined();
    });

    it('is a no-op when conditionEffects is null', () => {
        const ctx = {};
        applyAttackFeatureContext(ctx, null);
        expect(ctx.autoReroll).toBeUndefined();
    });
});
